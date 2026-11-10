import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Check, Globe } from "lucide-react";
import { track } from "../lib/analytics";
import { getCurrentLang } from "../i18n";

const LANGUAGES = [
  { code: "vi", label: "Tiếng Việt" },
  { code: "en", label: "English" },
];

export default function LanguageSelect({ compact = false, className = "" }) {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);

  const currentLang = getCurrentLang();
  const currentLabel = currentLang === "en" ? "English" : "Tiếng Việt";

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (code) => {
    if (code !== currentLang) {
      i18n.changeLanguage(code);
      track("language_change", { language: code });
    }
    setIsOpen(false);
    buttonRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
        const idx = LANGUAGES.findIndex((l) => l.code === currentLang);
        setFocusedIndex(idx >= 0 ? idx : 0);
      }
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev + 1) % LANGUAGES.length);
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((prev) => (prev - 1 + LANGUAGES.length) % LANGUAGES.length);
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < LANGUAGES.length) {
        handleSelect(LANGUAGES[focusedIndex].code);
      }
      return;
    }

    if (e.key === "Tab") {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative inline-block text-left select-none ${className}`} ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          const idx = LANGUAGES.findIndex((l) => l.code === currentLang);
          setFocusedIndex(idx >= 0 ? idx : 0);
        }}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={t("common.language.toggle_aria", { defaultValue: "Chuyển đổi ngôn ngữ" })}
        className={`inline-flex items-center justify-between gap-1.5 rounded-lg border border-border bg-white text-ink hover:bg-sage/30 hover:border-forest/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-forest/30 transition-all font-medium cursor-pointer shadow-2xs ${
          compact ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm"
        }`}
      >
        <div className="flex items-center gap-1.5 truncate">
          <Globe className={`${compact ? "w-3.5 h-3.5 text-muted" : "w-4 h-4 text-forest"} shrink-0`} />
          <span className="truncate">{currentLabel}</span>
        </div>
        <ChevronDown
          className={`${compact ? "w-3.5 h-3.5" : "w-4 h-4"} text-muted transition-transform shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label={t("common.language.current_language", { defaultValue: "Ngôn ngữ hiện tại" })}
          tabIndex={-1}
          className="absolute right-0 mt-1.5 w-40 rounded-xl bg-white border border-border shadow-lg py-1 z-50 animate-in fade-in slide-in-from-top-1 focus:outline-none"
        >
          {LANGUAGES.map((lang, index) => {
            const isSelected = lang.code === currentLang;
            const isFocused = index === focusedIndex;

            return (
              <li
                key={lang.code}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(lang.code)}
                onMouseEnter={() => setFocusedIndex(index)}
                className={`px-3 py-2 text-xs flex items-center justify-between cursor-pointer transition-colors ${
                  isFocused ? "bg-sage/50 text-forest font-semibold" : "text-ink"
                } ${isSelected ? "font-bold text-forest" : ""}`}
              >
                <span>{lang.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-forest shrink-0 ml-2" />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

