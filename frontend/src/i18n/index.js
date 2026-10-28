import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import vi from "./locales/vi.json";
import en from "./locales/en.json";

const STORAGE_KEY = "datamind_lang";
const DEFAULT_LANG = "vi";
const SUPPORTED_LANGS = ["vi", "en"];

export function getSavedLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED_LANGS.includes(saved)) {
      return saved;
    }
  } catch (err) {
    console.warn("Failed to read language from localStorage:", err);
  }
  return DEFAULT_LANG;
}

export function saveLang(lang) {
  try {
    if (SUPPORTED_LANGS.includes(lang)) {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  } catch (err) {
    console.warn("Failed to save language to localStorage:", err);
  }
}

const initialLang = getSavedLang();

if (typeof document !== "undefined" && document.documentElement) {
  document.documentElement.lang = initialLang;
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      vi: { translation: vi },
      en: { translation: en },
    },
    lng: initialLang,
    fallbackLng: DEFAULT_LANG,
    supportedLngs: SUPPORTED_LANGS,
    interpolation: {
      escapeValue: false,
    },
  });

i18n.on("languageChanged", (lng) => {
  const normalized = SUPPORTED_LANGS.includes(lng) ? lng : DEFAULT_LANG;
  saveLang(normalized);
  if (typeof document !== "undefined" && document.documentElement) {
    document.documentElement.lang = normalized;
  }
});

export function getCurrentLang() {
  const current = i18n.language || initialLang;
  return SUPPORTED_LANGS.includes(current) ? current : DEFAULT_LANG;
}

export function translateError(code, fallback) {
  if (code && typeof code === "string") {
    const key = `errors.${code}`;
    if (i18n.exists(key)) {
      return i18n.t(key);
    }
  }
  return fallback || i18n.t("errors.generic");
}

export default i18n;
