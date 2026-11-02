import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Link as LinkIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import DecisionFlowBlock from "./DecisionFlowBlock";
import ExampleCardBlock from "./ExampleCardBlock";
import TryClassifierBlock from "./TryClassifierBlock";
import RulesTableBlock from "./RulesTableBlock";
import CalloutBlock from "./CalloutBlock";
import { UIChip } from "./uiRegistry";

/**
 * Custom heading component with copy link icon and ID parsing
 * Headings use standard app font (font-sans, 'Be Vietnam Pro')
 */
function createHeading(level) {
  return function HeadingComponent({ children, ...props }) {
    const [copied, setCopied] = useState(false);

    let rawText = "";
    React.Children.forEach(children, (child) => {
      if (typeof child === "string") rawText += child;
    });

    let id = props.id || "";
    let displayText = children;

    const idMatch = rawText.match(/\{#([\w-]+)\}\s*$/);
    if (idMatch) {
      id = idMatch[1];
      const cleanedText = rawText.replace(/\{#([\w-]+)\}\s*$/, "").trim();
      displayText = cleanedText;
    } else if (!id && rawText) {
      id = rawText
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");
    }

    const handleCopy = (e) => {
      e.stopPropagation();
      const url = `${window.location.origin}${window.location.pathname}#${id}`;
      navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      window.location.hash = id;
    };

    const Tag = `h${level}`;
    const levelClasses = {
      1: "text-2xl md:text-3xl font-sans font-bold text-ink mt-8 mb-4 border-b border-border pb-2 tracking-tight",
      2: "text-xl md:text-2xl font-sans font-bold text-ink mt-8 mb-3 border-b border-border/60 pb-1.5 tracking-tight",
      3: "text-base md:text-lg font-sans font-semibold text-ink mt-6 mb-2",
      4: "text-sm md:text-base font-sans font-semibold text-ink mt-4 mb-2",
    }[level] || "text-sm md:text-base font-sans font-semibold text-ink mt-4 mb-2";

    return (
      <Tag
        id={id}
        className={`group relative scroll-mt-24 transition-colors duration-500 rounded px-1 -mx-1 ${levelClasses}`}
      >
        <span className="flex items-center gap-2">
          <span>{displayText}</span>
          {id && (
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted hover:text-forest focus:outline-none"
              title="Sao chép liên kết mục này"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-forest" />
              ) : (
                <LinkIcon className="w-3.5 h-3.5" />
              )}
            </button>
          )}
        </span>
      </Tag>
    );
  };
}

export default function MarkdownDocViewer({ content = "", rules = {} }) {
  const { t } = useTranslation();
  // Normalize content to Unicode NFC
  const normalizedContent = (content || "").normalize("NFC");

  return (
    <div className="doc-content text-ink leading-relaxed font-sans max-w-full break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: createHeading(1),
          h2: createHeading(2),
          h3: createHeading(3),
          h4: createHeading(4),
          p: ({ children }) => (
            <p className="text-muted text-[14.5px] leading-relaxed mb-4 [&>strong]:text-ink whitespace-normal break-words max-w-full">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 mb-4 text-muted text-[14.5px] space-y-1.5 [&>li>strong]:text-ink max-w-full break-words">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-4 text-muted text-[14.5px] space-y-1.5 [&>li>strong]:text-ink max-w-full break-words">
              {children}
            </ol>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-6 border border-border rounded-xl max-w-full">
              <table className="w-full text-left text-sm border-collapse bg-white min-w-[480px]">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-sage/40 text-ink font-semibold border-b border-border">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="py-2.5 px-3.5 text-xs font-semibold text-ink uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="py-2.5 px-3.5 text-xs border-b border-border/40 text-muted">
              {children}
            </td>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-forest underline underline-offset-2 hover:text-forest/80 font-medium break-all"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-forest/40 pl-4 py-1 italic my-4 text-muted text-sm bg-sage/10 rounded-r-lg max-w-full break-words">
              {children}
            </blockquote>
          ),
          pre: ({ children }) => {
            // Fenced code blocks container
            return <div className="my-4">{children}</div>;
          },
          code: ({ className, children, ...props }) => {
            const match = /language-(\S+)/.exec(className || "");
            const lang = match ? match[1] : "";
            const rawCode = String(children).replace(/\n$/, "");

            // Custom documentation block components
            if (lang === "dm-flow") {
              return <DecisionFlowBlock rules={rules} />;
            }

            if (lang === "dm-try") {
              return <TryClassifierBlock />;
            }

            if (lang === "dm-rules") {
              return <RulesTableBlock rules={rules} />;
            }

            if (lang.startsWith("dm-callout")) {
              const type = lang.replace("dm-callout", "").replace(/[:\s]+/, "").trim() || "tip";
              return <CalloutBlock type={type}>{rawCode}</CalloutBlock>;
            }

            if (lang === "dm-example") {
              try {
                const parsed = JSON.parse(rawCode);
                return <ExampleCardBlock data={parsed} />;
              } catch (e) {
                return (
                  <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                    Lỗi cú pháp ví dụ: {e.message}
                  </div>
                );
              }
            }

            // Standard fenced code block (has language-*)
            if (lang) {
              return (
                <div className="bg-[#F7F7F5] border border-[#EAEAEA] rounded-xl p-3.5 text-xs font-mono text-ink overflow-x-auto shadow-2xs max-w-full whitespace-pre-wrap break-words">
                  <code>{rawCode}</code>
                </div>
              );
            }

            // Check if string has newlines -> multi-line code block without language
            if (rawCode.includes("\n")) {
              return (
                <div className="bg-[#F7F7F5] border border-[#EAEAEA] rounded-xl p-3.5 text-xs font-mono text-ink overflow-x-auto shadow-2xs max-w-full whitespace-pre-wrap break-words">
                  <code>{rawCode}</code>
                </div>
              );
            }

            // UI Chip syntax: `ui:...`
            if (typeof rawCode === "string" && rawCode.startsWith("ui:")) {
              const chipId = rawCode.slice(3).trim();
              return <UIChip id={chipId} t={t} />;
            }

            // Regular Inline code: subtle pill inside sentence
            return (
              <code className="inline-block font-mono text-[0.88em] bg-[#F1F1EF] text-ink border border-[#E5E5E3] rounded px-1.5 py-0.2 mx-0.5 whitespace-nowrap align-baseline shadow-2xs">
                {children}
              </code>
            );
          },
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}
