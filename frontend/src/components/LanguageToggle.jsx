import { useTranslation } from "react-i18next";
import { track } from "../lib/analytics";
import { getCurrentLang } from "../i18n";

export default function LanguageToggle({ className = "" }) {
  const { t, i18n } = useTranslation();
  const currentLang = getCurrentLang();

  const handleSelect = (lang) => {
    if (lang === currentLang) return;
    i18n.changeLanguage(lang);
    track("language_change", { language: lang });
  };

  return (
    <div
      role="group"
      aria-label={t("common.language.toggle_aria")}
      className={`inline-flex items-center rounded-lg border border-border bg-white p-0.5 text-xs font-semibold select-none ${className}`}
    >
      <button
        type="button"
        onClick={() => handleSelect("vi")}
        aria-label={t("common.language.vi")}
        aria-pressed={currentLang === "vi"}
        className={`px-2 py-1 rounded-md transition-colors ${
          currentLang === "vi"
            ? "bg-forest text-white font-bold"
            : "text-muted hover:text-ink hover:bg-sage/40"
        }`}
      >
        {t("common.language.vi_short")}
      </button>
      <button
        type="button"
        onClick={() => handleSelect("en")}
        aria-label={t("common.language.en")}
        aria-pressed={currentLang === "en"}
        className={`px-2 py-1 rounded-md transition-colors ${
          currentLang === "en"
            ? "bg-forest text-white font-bold"
            : "text-muted hover:text-ink hover:bg-sage/40"
        }`}
      >
        {t("common.language.en_short")}
      </button>
    </div>
  );
}
