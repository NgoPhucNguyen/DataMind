import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Check, Link as LinkIcon, Calendar, Link2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import DecisionFlowBlock from "./DecisionFlowBlock";
import ExampleCardBlock from "./ExampleCardBlock";
import TryClassifierBlock from "./TryClassifierBlock";
import RulesTableBlock from "./RulesTableBlock";
import CalloutBlock from "./CalloutBlock";
import DiffTableBlock from "./DiffTableBlock";
import ModuleFlowBlock from "./ModuleFlowBlock";
import { getPrevNextPages, resolveRelatedDocs } from "./docsNavigation";
import { UIChip } from "./uiRegistry";

/**
 * Format ISO date string into user-friendly localized date
 * e.g., "2026-11-04" -> "Cập nhật: 04/11/2026" (vi) or "Updated: Nov 4, 2026" (en)
 */
function formatUpdatedDate(isoDate, lang = "vi") {
  if (!isoDate) return null;
  const parts = isoDate.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    if (lang === "en") {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const mIdx = parseInt(month, 10) - 1;
      return `Updated: ${months[mIdx] || month} ${parseInt(day, 10)}, ${year}`;
    }
    return `Cập nhật: ${day}/${month}/${year}`;
  }
  return `Cập nhật: ${isoDate}`;
}

/**
 * Custom heading component with copy link icon and ID parsing
 * Headings use standard app font (font-sans, 'Be Vietnam Pro')
 */
function createHeading(level, formattedUpdated = null) {
  return function HeadingComponent({ children, ...props }) {
    const { t } = useTranslation();
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
      1: "text-2xl md:text-3xl font-sans font-bold text-ink mt-8 mb-3 border-b border-border pb-2 tracking-tight",
      2: "text-xl md:text-2xl font-sans font-bold text-ink mt-8 mb-3 border-b border-border/60 pb-1.5 tracking-tight",
      3: "text-base md:text-lg font-sans font-semibold text-ink mt-6 mb-2",
      4: "text-sm md:text-base font-sans font-semibold text-ink mt-4 mb-2",
    }[level] || "text-sm md:text-base font-sans font-semibold text-ink mt-4 mb-2";

    return (
      <>
        <Tag
          id={id}
          className={`group relative scroll-mt-24 transition-colors duration-500 rounded px-1 -mx-1 ${levelClasses}`}
        >
          <span className="flex items-center gap-2">
            <span>{displayText}</span>
            {id && (
              <button
                type="button"
                onClick={handleCopy}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted hover:text-forest focus:outline-none"
                title={copied ? t("docs.copied", "Đã sao chép") : t("docs.copy_link", "Sao chép liên kết mục này")}
                aria-label={copied ? t("docs.copied", "Đã sao chép") : t("docs.copy_link", "Sao chép liên kết mục này")}
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
        {level === 1 && formattedUpdated && (
          <div className="text-xs text-muted -mt-1 mb-6 flex items-center gap-1.5 font-medium">
            <Calendar className="w-3.5 h-3.5 text-forest shrink-0" />
            <span>{formattedUpdated}</span>
          </div>
        )}
      </>
    );
  };
}

export default function MarkdownDocViewer({
  content = "",
  rules = {},
  activeModule = "",
  activeTopic = "",
}) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  // Normalize content to Unicode NFC
  let body = (content || "").normalize("NFC");
  const metadata = {};
  const relatedList = [];

  // Parse YAML-like front matter: --- \n title: ... \n updated: ... \n related: ... \n ---
  const fmMatch = body.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (fmMatch) {
    const fmLines = fmMatch[1].split(/\r?\n/);
    let inRelatedSection = false;

    fmLines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      if (trimmed.startsWith("related:")) {
        const rest = trimmed.slice("related:".length).trim();
        if (rest.startsWith("[") && rest.endsWith("]")) {
          // Inline array: [ "cleaner/find-errors", "visualize/correlation" ]
          const items = rest
            .slice(1, -1)
            .split(",")
            .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
            .filter(Boolean);
          relatedList.push(...items);
          inRelatedSection = false;
        } else if (!rest) {
          inRelatedSection = true;
        } else {
          relatedList.push(rest.replace(/^['"]|['"]$/g, ""));
          inRelatedSection = false;
        }
        return;
      }

      if (inRelatedSection) {
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const item = trimmed.slice(2).trim().replace(/^['"]|['"]$/g, "");
          if (item) relatedList.push(item);
          return;
        } else if (trimmed.includes(":")) {
          inRelatedSection = false;
        }
      }

      const colonIdx = line.indexOf(":");
      if (colonIdx !== -1) {
        const key = line.slice(0, colonIdx).trim();
        const val = line.slice(colonIdx + 1).trim();
        metadata[key] = val;
      }
    });

    metadata.related = relatedList;
    // Strip front matter from rendered body
    body = body.slice(fmMatch[0].length);
  }

  const formattedUpdated = formatUpdatedDate(metadata.updated, i18n.language);
  const relatedDocs = resolveRelatedDocs(metadata.related || []);
  const { prev: prevPage, next: nextPage } = getPrevNextPages(activeModule, activeTopic);

  const handleNavigate = (path) => {
    if (path) {
      navigate(path);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="doc-content text-ink leading-relaxed font-sans max-w-full break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: createHeading(1, formattedUpdated),
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
            if (lang === "flow") {
              return <ModuleFlowBlock content={rawCode} activeModule={activeModule} />;
            }

            if (lang === "dm-flow") {
              return <DecisionFlowBlock rules={rules} />;
            }

            if (lang === "dm-try") {
              return <TryClassifierBlock />;
            }

            if (lang.startsWith("dm-rules")) {
              const group = lang.replace("dm-rules", "").replace(/[:\s]+/, "").trim();
              return <RulesTableBlock rules={rules} initialGroup={group || "all"} />;
            }

            if (lang.startsWith("dm-callout")) {
              const type = lang.replace("dm-callout", "").replace(/[:\s]+/, "").trim() || "tip";
              return <CalloutBlock type={type}>{rawCode}</CalloutBlock>;
            }

            if (lang === "dm-diff") {
              try {
                const parsed = JSON.parse(rawCode);
                return <DiffTableBlock data={parsed} />;
              } catch (e) {
                return (
                  <div className="p-3 bg-red-50 text-red-700 text-xs rounded border border-red-200">
                    Lỗi cú pháp dm-diff: {e.message}
                  </div>
                );
              }
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
        {body}
      </ReactMarkdown>

      {/* 2) "Liên quan ở các bước khác" (Related Cross-links) */}
      {relatedDocs.length > 0 && (
        <section aria-label="Các trang liên quan" className="mt-12 pt-6 border-t border-border/70">
          <div className="flex items-center gap-2 mb-3.5">
            <Link2 className="w-4 h-4 text-forest" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
              {t("docs.related_title", "Liên quan ở các bước khác")}
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {relatedDocs.map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => handleNavigate(item.link)}
                className="p-3.5 rounded-xl border border-border/80 bg-[#FAFAF8] hover:border-forest/50 hover:bg-white hover:shadow-xs transition-all text-left flex flex-col justify-between group shadow-2xs cursor-pointer"
              >
                <span className="text-[10.5px] font-bold text-forest uppercase tracking-wider block mb-1">
                  {item.sectionFullName}
                </span>
                <span className="text-xs font-semibold text-ink group-hover:text-forest transition-colors line-clamp-2">
                  {item.title}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 1) Prev / Next Navigation */}
      {(prevPage || nextPage) && (
        <nav aria-label="Chuyển trang" className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-6 border-t border-border/70 mt-8">
          {prevPage ? (
            <button
              type="button"
              onClick={() => handleNavigate(prevPage.link)}
              className="p-3.5 rounded-xl border border-border/80 bg-white hover:border-forest/50 hover:bg-sage/10 transition-all text-left flex flex-col justify-between group shadow-2xs cursor-pointer"
            >
              <span className="text-[11px] font-semibold text-muted flex items-center gap-1 group-hover:text-forest transition-colors mb-1">
                <span>←</span>
                <span>{t("docs.prev_page", "Trang trước")}</span>
              </span>
              <span className="text-sm font-bold text-ink group-hover:text-forest transition-colors truncate">
                {prevPage.sectionFullName} · {prevPage.title}
              </span>
            </button>
          ) : (
            <div className="hidden sm:block" />
          )}

          {nextPage ? (
            <button
              type="button"
              onClick={() => handleNavigate(nextPage.link)}
              className="p-3.5 rounded-xl border border-border/80 bg-white hover:border-forest/50 hover:bg-sage/10 transition-all text-right flex flex-col justify-between group shadow-2xs sm:col-start-2 cursor-pointer"
            >
              <span className="text-[11px] font-semibold text-muted flex items-center justify-end gap-1 group-hover:text-forest transition-colors mb-1">
                <span>{t("docs.next_page", "Trang tiếp theo")}</span>
                <span>→</span>
              </span>
              <span className="text-sm font-bold text-ink group-hover:text-forest transition-colors truncate">
                {nextPage.sectionFullName} · {nextPage.title}
              </span>
            </button>
          ) : (
            <div className="hidden sm:block" />
          )}
        </nav>
      )}
    </div>
  );
}
