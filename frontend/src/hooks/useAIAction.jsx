import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Sparkles, Loader2, X } from "lucide-react";
import axios from "axios";
import { useToast } from "../contexts/ToastContext";
import { useConfirm } from "../components/ui/ConfirmDialog";
import { getAIUsage } from "../services/profilerService";
import { translateError } from "../i18n";
import { getStoredSettings } from "./useSettings";

function getSkipConfirmDateKey() {
  const today = new Date().toISOString().slice(0, 10);
  return `datamind_ai_skip_confirm_${today}`;
}

export function getSkipConfirmToday() {
  try {
    return localStorage.getItem(getSkipConfirmDateKey()) === "true";
  } catch (_) {
    return false;
  }
}

export function setSkipConfirmToday(val) {
  try {
    if (val) {
      localStorage.setItem(getSkipConfirmDateKey(), "true");
    } else {
      localStorage.removeItem(getSkipConfirmDateKey());
    }
  } catch (_) {}
}

/**
 * AI Confirm Dialog
 */
export function AIConfirmDialog({
  isOpen,
  onConfirm,
  onCancel,
  remaining,
  limit,
  dontAskToday,
  setDontAskToday,
}) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 border border-border">
        <h3 className="text-sm font-bold text-ink mb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-forest" />
          {t("usage.confirm_dialog_title", { defaultValue: "Xác nhận sử dụng AI" })}
        </h3>
        <p className="text-xs text-muted leading-relaxed mb-4">
          {t("usage.confirm_dialog_desc", {
            remaining: remaining ?? 0,
            limit: limit ?? 0,
            defaultValue: `Thao tác này dùng 1 lượt AI. Hôm nay còn ${remaining ?? 0}/${limit ?? 0} lượt.`,
          })}
        </p>

        <label className="flex items-center gap-2 text-xs text-muted mb-5 cursor-pointer select-none hover:text-ink">
          <input
            type="checkbox"
            checked={dontAskToday}
            onChange={(e) => setDontAskToday(e.target.checked)}
            className="rounded border-border text-forest focus:ring-forest/30"
          />
          <span>{t("usage.dont_ask_today", { defaultValue: "Không hỏi lại trong hôm nay" })}</span>
        </label>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-xs font-medium text-muted hover:text-ink hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
          >
            {t("common.cancel", { defaultValue: "Hủy" })}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3.5 py-1.5 text-xs font-semibold bg-forest text-white hover:bg-forest/90 rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            {t("common.continue", { defaultValue: "Tiếp tục" })}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Running Indicator with live seconds + Cancel button + 25s warning hint
 */
export function AIRunningIndicator({ seconds, onCancel, className = "" }) {
  const { t } = useTranslation();

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="inline-flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-forest-50 border border-forest-200 text-forest-800 text-xs font-medium">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-forest" />
          <span>
            {t("usage.running_analyzing", {
              s: seconds,
              defaultValue: `Đang phân tích… ${seconds} giây`,
            })}
          </span>
        </span>
        <button
          type="button"
          onClick={onCancel}
          className="px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:border-red-300 text-xs font-medium transition-colors cursor-pointer"
        >
          {t("common.cancel", { defaultValue: "Hủy" })}
        </button>
      </div>

      {seconds >= 25 && (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md leading-relaxed animate-in fade-in duration-200">
          {t("usage.running_long_hint", {
            defaultValue: "Lâu hơn bình thường. Bạn có thể Hủy và thử lại — không bị trừ lượt.",
          })}
        </p>
      )}
    </div>
  );
}

/**
 * Shared hook: useAIAction
 */
export function useAIAction({
  actionFn,
  usage,
  onUsageUpdated,
  onUpgradeClick,
  getPreviousContent,
  onRestore,
  onSuccess,
  onError,
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const confirmDialog = useConfirm();

  const [loading, setLoading] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [dontAskToday, setDontAskToday] = useState(false);

  const abortControllerRef = useRef(null);
  const timerRef = useRef(null);
  const pendingParamsRef = useRef(null);
  const previousContentRef = useRef(null);

  // Clear timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const refreshUsage = useCallback(async () => {
    try {
      const res = await getAIUsage();
      if (res?.data && onUsageUpdated) {
        onUsageUpdated(res.data);
      }
    } catch (_) {}
  }, [onUsageUpdated]);

  const runAction = useCallback(
    async (params = {}) => {
      setLoading(true);
      setSeconds(0);
      previousContentRef.current = getPreviousContent ? getPreviousContent() : null;

      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Start live timer
      if (timerRef.current) clearInterval(timerRef.current);
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      try {
        const result = await actionFn({
          ...params,
          signal: controller.signal,
        });

        if (timerRef.current) clearInterval(timerRef.current);
        setLoading(false);

        if (onSuccess) {
          onSuccess(result);
        }

        // Usage counter refreshes after success
        refreshUsage();
        return result;
      } catch (err) {
        if (timerRef.current) clearInterval(timerRef.current);
        setLoading(false);

        const isCancelled =
          axios.isCancel(err) ||
          err?.name === "CanceledError" ||
          err?.code === "ERR_CANCELED" ||
          err?.message === "canceled";

        if (isCancelled) {
          // Restore previous content
          if (onRestore) {
            onRestore(previousContentRef.current);
          }
          showToast(t("usage.toast_cancelled", { defaultValue: "Đã hủy. Không bị trừ lượt." }), "info");
        } else {
          if (onError) {
            onError(err);
          }
        }

        // Usage counter refreshes after failure or cancel
        refreshUsage();
      } finally {
        abortControllerRef.current = null;
      }
    },
    [actionFn, getPreviousContent, onSuccess, onError, onRestore, refreshUsage, showToast, t]
  );

  const execute = useCallback(
    async (params = {}) => {
      if (loading) return;

      // If action is free (e.g. reopening cached result without API spend)
      if (params?.isFree) {
        runAction(params);
        return;
      }

      // Check quota exhaustion
      if (usage?.remaining !== undefined && usage.remaining <= 0 && !usage.is_pro) {
        if (onUpgradeClick) {
          onUpgradeClick();
        }
        showToast(translateError("ERR_AI_QUOTA_EXCEEDED"), "error");
        return;
      }

      // Check if user disabled AI confirm in settings
      const settings = getStoredSettings();
      if (settings.aiConfirm === false) {
        runAction(params);
        return;
      }

      // Check if user chose "Don't ask again today"
      if (getSkipConfirmToday()) {
        runAction(params);
        return;
      }

      // Show confirm dialog via themed ConfirmDialog
      try {
        const res = await confirmDialog({
          icon: <Sparkles className="w-4 h-4 text-forest" />,
          title: t("usage.confirm_dialog_title", { defaultValue: "Xác nhận sử dụng AI" }),
          message: t("usage.confirm_dialog_desc", {
            remaining: usage?.remaining ?? 0,
            limit: usage?.limit ?? 0,
            defaultValue: `Thao tác này dùng 1 lượt AI. Hôm nay còn ${usage?.remaining ?? 0}/${usage?.limit ?? 0} lượt.`,
          }),
          confirmText: t("common.continue", { defaultValue: "Tiếp tục" }),
          cancelText: t("common.cancel", { defaultValue: "Hủy" }),
          tone: "default",
          checkbox: {
            label: t("usage.dont_ask_today", { defaultValue: "Không hỏi lại trong hôm nay" }),
            defaultChecked: false,
          },
        });

        if (res?.ok) {
          if (res.checked) {
            setSkipConfirmToday(true);
            setDontAskToday(true);
          }
          runAction(params);
        }
      } catch (err) {
        console.error("AI confirm dialog error:", err);
      }
    },
    [loading, usage, onUpgradeClick, runAction, showToast, confirmDialog, t]
  );

  const confirm = useCallback(() => {
    if (dontAskToday) {
      setSkipConfirmToday(true);
    }
    setIsConfirmOpen(false);
    const p = pendingParamsRef.current || {};
    pendingParamsRef.current = null;
    runAction(p);
  }, [dontAskToday, runAction]);

  const cancelConfirm = useCallback(() => {
    setIsConfirmOpen(false);
    pendingParamsRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Return null because ConfirmProvider now handles rendering dialog at root
  const AIConfirmModal = null;

  const AIRunningBar = (
    <AIRunningIndicator
      seconds={seconds}
      onCancel={cancel}
    />
  );

  return {
    loading,
    seconds,
    execute,
    cancel,
    isConfirmOpen,
    confirm,
    cancelConfirm,
    dontAskToday,
    setDontAskToday,
    AIConfirmModal,
    AIRunningBar,
  };
}

export default useAIAction;

