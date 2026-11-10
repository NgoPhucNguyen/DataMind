import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Settings as SettingsIcon,
  Palette,
  Sparkles,
  Database,
  User,
  Crown,
  Trash2,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

import PageHeader from "../components/PageHeader";
import LanguageSelect from "../components/LanguageSelect";
import { useAuth } from "../contexts/AuthContext";
import { useFileSession } from "../contexts/FileSessionContext";
import { useToast } from "../contexts/ToastContext";
import { useConfirm } from "../components/ui/ConfirmDialog";
import { useSettings } from "../hooks/useSettings";
import { PALETTE_LIST } from "../utils/chartPalettes";
import { getAIUsage } from "../services/profilerService";
import { getCurrentLang } from "../i18n";

export default function Settings() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, subscription } = useAuth();
  const { fileSession, updateFileSession, clearFileSession } = useFileSession();
  const { settings, updateSettings } = useSettings();
  const { showToast } = useToast();
  const confirm = useConfirm();

  const currentLang = getCurrentLang();
  const [aiUsage, setAiUsage] = useState(null);
  const [loadingUsage, setLoadingUsage] = useState(true);

  // Fetch AI usage statistics on mount
  useEffect(() => {
    let isMounted = true;
    setLoadingUsage(true);
    getAIUsage()
      .then((res) => {
        if (isMounted && res?.data) {
          setAiUsage(res.data);
        }
      })
      .catch((err) => {
        console.warn("Could not load AI usage in Settings:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingUsage(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const hasActiveSession = Boolean(
    fileSession?.fileName || fileSession?.fileHash || fileSession?.sessionId
  );

  const handleApplyPaletteToCurrent = () => {
    if (!hasActiveSession) return;
    updateFileSession({ chartPalette: settings.defaultChartPalette });
    showToast(
      t("settings.palette_applied_toast", {
        defaultValue: "Đã áp dụng bảng màu cho file hiện tại.",
      }),
      "success"
    );
  };

  const handleClearSession = async () => {
    const res = await confirm({
      tone: "danger",
      title: t("settings.clear_confirm_title", {
        defaultValue: "Xóa dữ liệu phiên làm việc?",
      }),
      message: t("settings.clear_confirm_message", {
        defaultValue:
          "Các lựa chọn biểu đồ, cài đặt và văn bản chưa lưu lên máy chủ trên trình duyệt này sẽ bị xóa. Tài khoản và dữ liệu đã lưu trên máy chủ không bị ảnh hưởng.",
      }),
      confirmText: t("common.delete", { defaultValue: "Xóa dữ liệu" }),
      cancelText: t("common.cancel", { defaultValue: "Hủy" }),
    });

    if (res === true || res?.ok) {
      clearFileSession();
      showToast(
        t("settings.clear_success_toast", {
          defaultValue: "Đã xóa dữ liệu phiên làm việc trên trình duyệt.",
        }),
        "success"
      );
      navigate("/dashboard/profiler");
    }
  };

  const planLabel = subscription?.plan === "pro" ? "Pro" : "Free";

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <PageHeader
        title={t("settings.title", { defaultValue: "Cài đặt" })}
        subtitle={t("settings.subtitle", {
          defaultValue:
            "Quản lý tùy chọn giao diện, bảng màu biểu đồ, cấu hình AI và phiên làm việc.",
        })}
      />

      {/* ── Section A: Chung / General ── */}
      <section className="bg-white border border-border rounded-2xl p-5 md:p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border/60">
          <SettingsIcon className="w-4 h-4 text-forest" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink">
            {t("settings.section_general", { defaultValue: "Chung" })}
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <div>
            <p className="text-sm font-semibold text-ink">
              {t("settings.language_label", { defaultValue: "Ngôn ngữ hiển thị" })}
            </p>
            <p className="text-xs text-muted leading-relaxed mt-0.5">
              {t("settings.language_desc", {
                defaultValue: "Chọn ngôn ngữ sử dụng cho toàn bộ giao diện và tài liệu hướng dẫn",
              })}
            </p>
          </div>
          <div>
            <LanguageSelect />
          </div>
        </div>
      </section>

      {/* ── Section B: Biểu đồ / Charts ── */}
      <section className="bg-white border border-border rounded-2xl p-5 md:p-6 shadow-2xs space-y-5">
        <div className="flex items-center gap-2 pb-3 border-b border-border/60">
          <Palette className="w-4 h-4 text-forest" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink">
            {t("settings.section_charts", { defaultValue: "Biểu đồ" })}
          </h2>
        </div>

        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <div>
              <p className="text-sm font-semibold text-ink">
                {t("settings.palette_label", {
                  defaultValue: "Bảng màu mặc định cho file mới",
                })}
              </p>
              <p className="text-xs text-muted leading-relaxed mt-0.5">
                {t("settings.palette_desc", {
                  defaultValue:
                    "Áp dụng tự động cho các biểu đồ khi bắt đầu phân tích tệp dữ liệu mới",
                })}
              </p>
            </div>

            {hasActiveSession && (
              <button
                type="button"
                onClick={handleApplyPaletteToCurrent}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-forest/10 text-forest hover:bg-forest/20 border border-forest/20 transition-all cursor-pointer self-start sm:self-auto shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>
                  {t("settings.apply_to_current_file", {
                    defaultValue: "Áp dụng cho file hiện tại",
                  })}
                </span>
              </button>
            )}
          </div>

          {/* Palette Selection Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {PALETTE_LIST.map((p) => {
              const isSelected = settings.defaultChartPalette === p.id;
              const pName = p.name?.[currentLang] || p.name?.vi || p.id;
              const swatches = p.categorical.slice(0, 5);

              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => updateSettings({ defaultChartPalette: p.id })}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                    isSelected
                      ? "border-forest bg-sage/20 shadow-xs ring-1 ring-forest/30"
                      : "border-border/80 bg-white hover:border-forest/40 hover:bg-sage/10"
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold text-ink">{pName}</span>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-forest shrink-0" />
                    )}
                  </div>
                  {/* Swatches */}
                  <div className="flex items-center gap-1.5">
                    {swatches.map((color, idx) => (
                      <span
                        key={idx}
                        className="w-4 h-4 rounded-full border border-black/10 shrink-0 shadow-2xs"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>

          {hasActiveSession && (
            <p className="text-[11.5px] text-muted italic mt-2.5">
              {t("settings.current_file_hint", {
                defaultValue: "File đang mở: {{name}}",
                name: fileSession.fileName || "Tệp dữ liệu",
              })}
            </p>
          )}
        </div>
      </section>

      {/* ── Section C: AI ── */}
      <section className="bg-white border border-border rounded-2xl p-5 md:p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border/60">
          <Sparkles className="w-4 h-4 text-forest" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink">
            {t("settings.section_ai", { defaultValue: "Trí tuệ nhân tạo (AI)" })}
          </h2>
        </div>

        {/* Usage status display */}
        <div className="p-3 bg-sage/30 border border-forest/20 rounded-xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-ink">
            <Sparkles className="w-4 h-4 text-forest shrink-0" />
            <span className="font-medium">
              {loadingUsage ? (
                t("common.loading", { defaultValue: "Đang tải hạn mức..." })
              ) : (
                t("settings.ai_usage_summary", {
                  defaultValue: "Hôm nay còn {{remaining}}/{{limit}} lượt · Gói {{plan}}",
                  remaining: aiUsage?.remaining ?? 0,
                  limit: aiUsage?.limit ?? 0,
                  plan: planLabel,
                })
              )}
            </span>
          </div>
          {subscription?.plan !== "pro" && (
            <button
              type="button"
              onClick={() => navigate("/dashboard/subscription")}
              className="text-forest font-semibold hover:underline inline-flex items-center gap-0.5 cursor-pointer shrink-0"
            >
              <span>Nâng cấp</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* AI Confirm Toggle */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="pr-2">
            <p className="text-sm font-semibold text-ink">
              {t("settings.ai_confirm_label", {
                defaultValue: "Hỏi xác nhận trước khi dùng lượt AI",
              })}
            </p>
            <p className="text-xs text-muted leading-relaxed mt-0.5">
              {t("settings.ai_confirm_desc", {
                defaultValue:
                  "Hiển thị hộp thoại cảnh báo số lượt còn lại trước khi AI bắt đầu phân tích hoặc viết nội dung",
              })}
            </p>
          </div>

          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={settings.aiConfirm}
              onChange={(e) => updateSettings({ aiConfirm: e.target.checked })}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-neutral-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-forest"></div>
          </label>
        </div>
      </section>

      {/* ── Section D: Dữ liệu / Data ── */}
      <section className="bg-white border border-border rounded-2xl p-5 md:p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border/60">
          <Database className="w-4 h-4 text-forest" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink">
            {t("settings.section_data", { defaultValue: "Dữ liệu phiên làm việc" })}
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div>
            <p className="text-sm font-semibold text-ink">
              {t("settings.data_desc", {
                defaultValue:
                  "Quản lý dữ liệu tệp bảng tính và các thiết lập đang được lưu trữ tạm trong trình duyệt này",
              })}
            </p>
            <p className="text-xs text-muted leading-relaxed mt-0.5">
              {hasActiveSession
                ? t("settings.active_session_status", {
                    defaultValue: "Đang mở: {{file}}",
                    file: fileSession.fileName || "Tệp hiện tại",
                  })
                : t("settings.no_active_session", {
                    defaultValue: "Hiện không có tệp nào đang được tải trong bộ nhớ",
                  })}
            </p>
          </div>

          <button
            type="button"
            onClick={handleClearSession}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer shrink-0"
          >
            <Trash2 className="w-4 h-4 text-red-600" />
            <span>
              {t("settings.clear_session_btn", {
                defaultValue: "Xóa dữ liệu phiên làm việc trên trình duyệt",
              })}
            </span>
          </button>
        </div>
      </section>

      {/* ── Section E: Tài khoản / Account ── */}
      <section className="bg-white border border-border rounded-2xl p-5 md:p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-border/60">
          <User className="w-4 h-4 text-forest" />
          <h2 className="text-sm font-bold uppercase tracking-wider text-ink">
            {t("settings.section_account", { defaultValue: "Tài khoản" })}
          </h2>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted">
                {t("settings.email", { defaultValue: "Email" })}:
              </span>
              <span className="text-sm font-bold text-ink">{user?.email || "—"}</span>
              {subscription?.plan === "pro" ? (
                <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  <Crown className="w-3 h-3 text-amber-600" />
                  Gói Pro
                </span>
              ) : (
                <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-neutral-100 text-muted">
                  Gói Free
                </span>
              )}
            </div>
            {user?.full_name && (
              <p className="text-xs text-muted">
                {t("settings.full_name", { defaultValue: "Họ và tên" })}: {user.full_name}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => navigate("/dashboard/subscription")}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-forest text-white hover:bg-forest/90 transition-all cursor-pointer shrink-0 shadow-2xs"
          >
            <span>{t("settings.manage_account", { defaultValue: "Quản lý tài khoản" })}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>
    </div>
  );
}

