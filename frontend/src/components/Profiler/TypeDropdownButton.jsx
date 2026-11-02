import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Check } from "lucide-react";
import { COLUMN_TYPES, TYPE_CONFIG } from "../../constants/dataTypes";

/**
 * TypeDropdownButton:
 * - Single interactive button: [type icon] + label + chevron in neutral style.
 * - Opens a keyboard accessible popover menu with 5 types & icons from dataTypes.js, current checked.
 * - If overridden: shows "Đã đổi từ X" + "Hoàn tác" link under the button.
 */
export function TypeDropdownButton({
  colName,
  effectiveType,
  detectedType,
  isOverridden,
  onSelectType,
  onReset,
}) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const itemRefs = useRef([]);

  const currentCfg = TYPE_CONFIG[effectiveType] || TYPE_CONFIG.text;
  const CurrentIcon = currentCfg.icon;
  const currentLabel = t(currentCfg.i18nKey, { defaultValue: effectiveType });

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  // Focus item when navigating with keyboard
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && itemRefs.current[focusedIndex]) {
      itemRefs.current[focusedIndex].focus();
    }
  }, [isOpen, focusedIndex]);

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
        const idx = COLUMN_TYPES.indexOf(effectiveType);
        setFocusedIndex(idx >= 0 ? idx : 0);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % COLUMN_TYPES.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev - 1 + COLUMN_TYPES.length) % COLUMN_TYPES.length);
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
  };

  const handleSelect = (type) => {
    onSelectType(colName, type);
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  return (
    <div className="relative flex flex-col items-start gap-1 w-full max-w-full" ref={containerRef}>
      {/* ── Main Dropdown Button ── */}
      <button
        ref={buttonRef}
        type="button"
        id={`type-btn-${colName}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => {
          const nextState = !isOpen;
          setIsOpen(nextState);
          if (nextState) {
            const idx = COLUMN_TYPES.indexOf(effectiveType);
            setFocusedIndex(idx >= 0 ? idx : 0);
          }
        }}
        onKeyDown={handleKeyDown}
        title={t("profiler.col_header_override", "Ghi đè kiểu")}
        className={`inline-flex w-full max-w-full items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer outline-none focus:ring-2 focus:ring-forest/30 ${
          isOverridden
            ? "bg-[#FEF6E6] text-[#854D0E] border border-[#FDE68A] hover:bg-[#FDF0D5]"
            : "bg-[#F4F4F3] text-[#242424] border border-[#E5E5E3] hover:bg-[#ECECEB] hover:border-[#DCDCDA]"
        }`}
      >
        <span
          aria-hidden="true"
          className="flex items-center justify-center w-4 h-4 shrink-0 rounded border border-[#1B4324]/30 bg-white text-[#1B4324]"
        >
          <CurrentIcon size={10} strokeWidth={2.2} />
        </span>
        <span className="font-medium truncate">{currentLabel}</span>
        <ChevronDown
          size={13}
          className={`text-muted shrink-0 transition-transform duration-150 ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {/* ── Overridden Subtext + Hoàn tác ── */}
      {isOverridden && (
        <div className="flex items-center gap-1.5 text-[11px] leading-tight">
          <span className="font-medium text-[#B45309] bg-[#FEF6E6] px-1.5 py-0.5 rounded border border-[#FDE68A]/60">
            {t("profiler.overridden_from", {
              original: t(`profiler.type_${detectedType}`, { defaultValue: detectedType }),
              defaultValue: t("profiler.overridden_from", {
                original: t(`profiler.type_${detectedType}`, { defaultValue: detectedType }),
              }),
            })}
          </span>
          <button
            type="button"
            onClick={() => onReset(colName, detectedType)}
            className="text-[#1B4324] hover:text-ink underline font-medium cursor-pointer transition-colors"
            title={t("profiler.col_override_reset_tooltip", "Khôi phục về kiểu tự động ban đầu")}
          >
            {t("profiler.col_override_reset", "Hoàn tác")}
          </button>
        </div>
      )}

      {/* ── Dropdown Menu ── */}
      {isOpen && (
        <div
          role="menu"
          aria-labelledby={`type-btn-${colName}`}
          className="absolute left-0 top-full mt-1.5 z-40 w-44 py-1 bg-white border border-border rounded-xl shadow-lg animate-in fade-in zoom-in-95 text-xs text-ink"
        >
          {COLUMN_TYPES.map((typeKey, idx) => {
            const itemCfg = TYPE_CONFIG[typeKey] || TYPE_CONFIG.text;
            const ItemIcon = itemCfg.icon;
            const itemLabel = t(itemCfg.i18nKey, { defaultValue: typeKey });
            const isSelected = typeKey === effectiveType;

            return (
              <button
                key={typeKey}
                ref={(el) => (itemRefs.current[idx] = el)}
                role="menuitemradio"
                aria-checked={isSelected}
                tabIndex={isOpen ? (focusedIndex === idx ? 0 : -1) : -1}
                type="button"
                onClick={() => handleSelect(typeKey)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelect(typeKey);
                  } else {
                    handleKeyDown(e);
                  }
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-left transition-colors cursor-pointer outline-none ${
                  isSelected
                    ? "bg-[#EAF2EB] text-[#1B4324] font-semibold"
                    : focusedIndex === idx
                    ? "bg-neutral-100 text-ink"
                    : "text-ink hover:bg-neutral-50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="flex items-center justify-center w-4 h-4 shrink-0 rounded border border-[#1B4324]/30 bg-white text-[#1B4324]"
                  >
                    <ItemIcon size={10} strokeWidth={2.2} />
                  </span>
                  <span>{itemLabel}</span>
                </div>
                {isSelected && (
                  <Check size={13} className="text-[#1B4324] shrink-0" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

