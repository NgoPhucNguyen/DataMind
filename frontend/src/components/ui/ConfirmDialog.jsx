import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Info } from "lucide-react";

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const { i18n } = useTranslation();
  const lang = i18n?.language?.startsWith("en") ? "en" : "vi";

  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState({});
  const [isChecked, setIsChecked] = useState(false);
  const [inputValue, setInputValue] = useState("");

  const resolveRef = useRef(null);
  const triggerRef = useRef(null);
  const confirmBtnRef = useRef(null);
  const inputRef = useRef(null);
  const dialogRef = useRef(null);

  // Close helper
  const closeDialog = useCallback((result) => {
    setIsOpen(false);
    if (resolveRef.current) {
      resolveRef.current(result);
      resolveRef.current = null;
    }
    // Return focus to previous trigger
    setTimeout(() => {
      triggerRef.current?.focus?.();
      triggerRef.current = null;
    }, 50);
  }, []);

  const handleConfirm = useCallback(() => {
    if (options.checkbox && options.input) {
      closeDialog({ ok: true, checked: isChecked, value: inputValue });
    } else if (options.checkbox) {
      closeDialog({ ok: true, checked: isChecked });
    } else if (options.input) {
      closeDialog({ ok: true, value: inputValue });
    } else {
      closeDialog(true);
    }
  }, [closeDialog, options, isChecked, inputValue]);

  const handleCancel = useCallback(() => {
    if (options.checkbox && options.input) {
      closeDialog({ ok: false, checked: isChecked, value: inputValue });
    } else if (options.checkbox) {
      closeDialog({ ok: false, checked: isChecked });
    } else if (options.input) {
      closeDialog({ ok: false, value: inputValue });
    } else {
      closeDialog(false);
    }
  }, [closeDialog, options, isChecked, inputValue]);

  // Main confirm function returned to consumers
  const confirm = useCallback((opts = {}) => {
    triggerRef.current = typeof document !== "undefined" ? document.activeElement : null;
    setOptions(opts);
    setIsChecked(Boolean(opts.checkbox?.defaultChecked));
    setInputValue(opts.input?.defaultValue ?? "");
    setIsOpen(true);

    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  // Attach convenience methods
  confirm.confirm = confirm;
  confirm.alert = useCallback((opts = {}) => {
    return confirm({ ...opts, cancelText: null });
  }, [confirm]);

  // Lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  // Auto-focus input or confirm button when dialog opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        if (options.input && inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        } else if (confirmBtnRef.current) {
          confirmBtnRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, options.input]);

  // Handle keyboard events (Esc to cancel, Enter to confirm)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      } else if (e.key === "Enter" && !e.shiftKey) {
        // Prevent accidental form submits, handle confirm
        if (e.target.tagName !== "TEXTAREA") {
          e.preventDefault();
          handleConfirm();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleCancel, handleConfirm]);

  const isDanger = options.tone === "danger";
  const defaultConfirmText = isDanger
    ? (lang === "en" ? "Delete" : "Xóa")
    : (lang === "en" ? "Confirm" : "Xác nhận");
  const defaultCancelText = lang === "en" ? "Cancel" : "Hủy";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {isOpen && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={handleCancel}
        >
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
            tabIndex={-1}
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-[#EAEAEA] relative z-10 animate-in fade-in zoom-in-95 duration-150 outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3 mb-2.5">
              {isDanger ? (
                <div className="w-8 h-8 rounded-full bg-red-100 text-[#B42318] flex items-center justify-center shrink-0 mt-0.5">
                  <AlertTriangle className="w-4 h-4" />
                </div>
              ) : options.icon ? (
                <div className="w-8 h-8 rounded-full bg-[#E2ECE4] text-forest flex items-center justify-center shrink-0 mt-0.5">
                  {options.icon}
                </div>
              ) : null}
              <div className="flex-1">
                <h3
                  id="confirm-dialog-title"
                  className="text-base font-bold text-ink leading-snug"
                >
                  {options.title || (lang === "en" ? "Confirmation" : "Xác nhận")}
                </h3>
              </div>
            </div>

            {/* Message Body */}
            {options.message && (
              <div
                id="confirm-dialog-message"
                className="text-xs text-[#626C65] leading-relaxed mb-4 whitespace-pre-wrap pl-0"
              >
                {options.message}
              </div>
            )}

            {/* Optional Input */}
            {options.input && (
              <div className="mb-4">
                {options.input.label && (
                  <label className="block text-xs font-medium text-ink mb-1.5">
                    {options.input.label}
                  </label>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={options.input.placeholder || ""}
                  className="w-full px-3 py-2 text-xs text-ink bg-[#F9F9F8] border border-[#EAEAEA] rounded-lg focus:outline-none focus:border-forest focus:bg-white transition-colors"
                />
              </div>
            )}

            {/* Optional Checkbox */}
            {options.checkbox && (
              <label className="flex items-center gap-2 text-xs text-[#2A342D] mb-5 cursor-pointer select-none hover:text-ink">
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={(e) => setIsChecked(e.target.checked)}
                  className="rounded border-[#D1D5DB] text-forest focus:ring-forest/30"
                />
                <span>{options.checkbox.label}</span>
              </label>
            )}

            {/* Buttons right-aligned */}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              {options.cancelText !== null && (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 text-xs font-medium text-[#626C65] hover:text-ink hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
                >
                  {options.cancelText || defaultCancelText}
                </button>
              )}
              <button
                ref={confirmBtnRef}
                type="button"
                onClick={handleConfirm}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-lg shadow-xs transition-colors cursor-pointer ${
                  isDanger
                    ? "bg-[#B42318] hover:bg-[#911d13] focus:ring-2 focus:ring-[#B42318]/30"
                    : "bg-forest hover:bg-forest/90 focus:ring-2 focus:ring-forest/30"
                }`}
              >
                {options.confirmText || defaultConfirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used inside <ConfirmProvider>");
  }
  return ctx;
}

export default ConfirmProvider;

