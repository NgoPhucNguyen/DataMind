import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Info, AlertTriangle, Sparkles } from "lucide-react";

export default function CalloutBlock({ type = "tip", children }) {
  const configs = {
    tip: {
      border: "border-forest/30",
      bg: "bg-forest/5",
      iconColor: "text-forest",
      label: "Mẹo",
      Icon: Info,
    },
    warning: {
      border: "border-amber-300",
      bg: "bg-amber-50/70",
      iconColor: "text-amber-700",
      label: "Lưu ý",
      Icon: AlertTriangle,
    },
    cost: {
      border: "border-purple-300",
      bg: "bg-purple-50/70",
      iconColor: "text-purple-700",
      label: "Hạn mức AI",
      Icon: Sparkles,
    },
  };

  const config = configs[type] || configs.tip;
  const { Icon } = config;

  // Extract raw text if children is a string or array of strings
  let rawText = "";
  if (typeof children === "string") {
    rawText = children;
  } else if (Array.isArray(children)) {
    rawText = children
      .map((c) => (typeof c === "string" ? c : (c?.props?.children || "")))
      .join("");
  } else if (children?.props?.children) {
    rawText = children.props.children;
  }

  // Ensure plain text string
  if (typeof rawText !== "string") {
    rawText = String(rawText || "");
  }

  return (
    <aside className={`my-4 p-4 rounded-xl border ${config.border} ${config.bg} text-ink text-sm leading-relaxed max-w-full break-words whitespace-normal`}>
      <div className="flex items-center gap-2 mb-1.5 font-semibold text-xs uppercase tracking-wider">
        <Icon className={`w-4 h-4 shrink-0 ${config.iconColor}`} />
        <span className={config.iconColor}>{config.label}</span>
      </div>
      <div className="text-muted text-[13.5px] leading-relaxed max-w-full break-words whitespace-normal font-sans">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-muted [&>strong]:text-ink">{children}</p>,
            code: ({ children }) => (
              <code className="px-1 py-0.5 rounded font-mono text-xs bg-sage/60 text-forest border border-border/50">
                {children}
              </code>
            ),
          }}
        >
          {rawText.trim()}
        </ReactMarkdown>
      </div>
    </aside>
  );
}
