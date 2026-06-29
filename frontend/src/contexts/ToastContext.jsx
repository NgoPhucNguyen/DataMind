import { createContext, useCallback, useContext, useState } from "react";

// ── Context ───────────────────────────────────────────────
const ToastContext = createContext(null);

// ── Provider ──────────────────────────────────────────────
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => {
      if (prev.some((t) => t.message === message)) return prev;
      return [...prev, { id, message, type }];
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast container — rendered at root level */}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}

// ── Toast Container UI ────────────────────────────────────
function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col-reverse gap-2 pointer-events-none">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

const STYLES = {
  success: {
    bar: "bg-emerald-400",
    icon: "✓",
    iconBg: "bg-emerald-500/20 text-emerald-400",
    text: "text-white",
    bg: "bg-[#161B2E] border border-emerald-500/30",
  },
  error: {
    bar: "bg-red-400",
    icon: "✕",
    iconBg: "bg-red-500/20 text-red-400",
    text: "text-white",
    bg: "bg-[#161B2E] border border-red-500/30",
  },
  info: {
    bar: "bg-violet-400",
    icon: "i",
    iconBg: "bg-violet-500/20 text-violet-400",
    text: "text-white",
    bg: "bg-[#161B2E] border border-violet-500/30",
  },
  warning: {
    bar: "bg-amber-400",
    icon: "!",
    iconBg: "bg-amber-500/20 text-amber-400",
    text: "text-white",
    bg: "bg-[#161B2E] border border-amber-500/30",
  },
};

function ToastItem({ toast, onDismiss }) {
  const s = STYLES[toast.type] || STYLES.info;
  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 shadow-2xl min-w-[280px] max-w-[360px] ${s.bg} animate-slide-in`}
      role="alert"
    >
      {/* Colored left bar */}
      <div className={`w-0.5 self-stretch rounded-full ${s.bar} shrink-0`} />
      {/* Icon */}
      <span className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${s.iconBg}`}>
        {s.icon}
      </span>
      {/* Message */}
      <p className={`flex-1 text-sm leading-snug ${s.text}`}>{toast.message}</p>
      {/* Dismiss */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-white/30 hover:text-white/70 transition-colors text-lg leading-none shrink-0 mt-0.5"
        aria-label="Đóng thông báo"
      >
        ×
      </button>
    </div>
  );
}
