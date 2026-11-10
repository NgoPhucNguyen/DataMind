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

const KNOWN_ERROR_MAP = {
  "Email này đã được sử dụng. Vui lòng dùng email khác.": "ERR_EMAIL_IN_USE",
  "Email hoặc mật khẩu không đúng.": "ERR_INVALID_CREDENTIALS",
  "Không thể xác thực tài khoản Google. Vui lòng thử lại.": "ERR_GOOGLE_AUTH_FAILED",
  "Email Google chưa được xác minh.": "ERR_GOOGLE_EMAIL_UNVERIFIED",
  "Họ tên phải có ít nhất 2 ký tự": "ERR_NAME_TOO_SHORT",
  "Mật khẩu phải có ít nhất 6 ký tự": "ERR_PASSWORD_TOO_SHORT",
};

export function translateError(errorOrCode, fallback) {
  if (!errorOrCode) return fallback || i18n.t("errors.generic");

  let code = errorOrCode;
  if (Array.isArray(errorOrCode) && errorOrCode.length > 0) {
    const first = errorOrCode[0];
    code = (first?.msg || "").replace(/^Value error,\s*/, "");
  }

  if (typeof code === "string") {
    const trimmed = code.trim();
    if (KNOWN_ERROR_MAP[trimmed]) {
      return i18n.t(`errors.${KNOWN_ERROR_MAP[trimmed]}`);
    }
    const key = `errors.${trimmed}`;
    if (i18n.exists(key)) {
      return i18n.t(key);
    }
    // Return original message if it's already a descriptive custom string, else fallback
    if (fallback) return fallback;
    return trimmed;
  }

  return fallback || i18n.t("errors.generic");
}

export default i18n;
