import { useState, useEffect } from "react";
import { login, loginWithGoogle } from "../services/authService";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Info } from "lucide-react";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { track } from "../lib/analytics";
import { sanitizeReturnPath } from "../utils/sessionManager";
import { translateError } from "../i18n";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();
  const { login: authLogin } = useAuth();

  useEffect(() => {
    document.title = t("seo.title_login", "Đăng nhập — DataMind");
  }, [t, i18n.language]);

  // Parse parameters: reason and next
  const searchParams = new URLSearchParams(location.search);
  const reason = searchParams.get("reason");
  const nextParam = searchParams.get("next");
  const returnTarget = sanitizeReturnPath(
    nextParam || location.state?.from?.pathname || "/dashboard/profiler"
  );

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleGoogleCredential = async (credential) => {
    setGoogleLoading(true);
    try {
      const response = await loginWithGoogle(credential);
      if (response.is_new_user) track("sign_up", { method: "google" });
      authLogin(response.user, response.token.access_token);
      sessionStorage.removeItem("datamind_session_expired");
      showToast(t("auth.toast_login_success", "Đăng nhập thành công! Chào mừng bạn quay trở lại."), "success");
      navigate(returnTarget, { replace: true });
    } catch (error) {
      const detail = error.response?.data?.detail;
      const msg = translateError(detail, t("auth.google_login_failed", "Không thể đăng nhập bằng Google. Vui lòng thử lại."));
      showToast(msg, "error");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    showToast(t("auth.google_login_failed", "Không thể đăng nhập bằng Google. Vui lòng thử lại."), "error");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await login(formData);
      authLogin(response.user, response.token.access_token);
      sessionStorage.removeItem("datamind_session_expired");
      showToast(t("auth.toast_login_success", "Đăng nhập thành công! Chào mừng bạn quay trở lại."), "success");
      navigate(returnTarget, { replace: true });
    } catch (error) {
      const detail = error.response?.data?.detail;
      const msg = translateError(detail, t("auth.login_failed_fallback", "Không thể đăng nhập. Vui lòng kiểm tra lại địa chỉ email hoặc mật khẩu."));
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-serif font-bold tracking-tight mb-2 text-ink">
              {t("auth.login_title", "Chào mừng trở lại")}
            </h1>
            <p className="text-muted text-sm">
              {t("auth.login_subtitle", "Đăng nhập để tiếp tục với DataMind")}
            </p>
          </div>

          {reason === "expired" && (
            <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-[#F0F4F8] border border-[#D0DBE5] text-[#2C3E50] text-sm leading-relaxed shadow-xs">
              <Info className="w-5 h-5 text-[#4B6B94] shrink-0 mt-0.5" />
              <div>
                {t("auth.session_expired_notice", {
                  defaultValue: "Phiên đăng nhập đã hết hạn. Vì lý do bảo mật, bạn cần đăng nhập lại để tiếp tục."
                })}
              </div>
            </div>
          )}

          <form
            id="login-form"
            onSubmit={handleSubmit}
            className="bg-white border border-border rounded-xl p-8 flex flex-col gap-4 shadow-sm"
          >
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-email" className="text-xs text-muted font-semibold uppercase tracking-wider">
                {t("auth.email_label", "Email")}
              </label>
              <input
                id="login-email"
                type="email"
                name="email"
                placeholder="your@email.com"
                required
                autoComplete="email"
                value={formData.email}
                onChange={handleChange}
                className="bg-canvas border border-border rounded-lg px-4 py-3 text-sm text-ink placeholder-muted/40 outline-none focus:border-forest/60 focus:ring-1 focus:ring-forest/30 transition-all"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-password" className="text-xs text-muted font-semibold uppercase tracking-wider">
                {t("auth.password_label", "Mật khẩu")}
              </label>
              <input
                id="login-password"
                type="password"
                name="password"
                placeholder={t("auth.password_placeholder_login", "••••••••")}
                required
                autoComplete="current-password"
                value={formData.password}
                onChange={handleChange}
                className="bg-canvas border border-border rounded-lg px-4 py-3 text-sm text-ink placeholder-muted/40 outline-none focus:border-forest/60 focus:ring-1 focus:ring-forest/30 transition-all"
              />
            </div>

            {/* Submit */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="mt-2 bg-[#111111] hover:bg-[#222222] disabled:bg-[#111111]/40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t("auth.btn_logging_in", "Đang đăng nhập...")}
                </>
              ) : (
                t("auth.btn_login", "Đăng nhập")
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 mt-6">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted uppercase tracking-wider">
              {t("auth.or_divider", "Hoặc")}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Google Sign-In */}
          <div className="mt-6 relative">
            <GoogleSignInButton onCredential={handleGoogleCredential} onError={handleGoogleError} />
            {googleLoading && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center rounded-lg">
                <span className="w-4 h-4 border-2 border-forest/30 border-t-forest rounded-full animate-spin" />
              </div>
            )}
          </div>

          <p className="text-center text-muted text-xs mt-6">
            {t("auth.no_account_prompt", "Chưa có tài khoản?")}{" "}
            <Link to="/register" className="text-forest hover:text-forest/80 font-medium transition-colors">
              {t("auth.register_free_link", "Đăng ký miễn phí")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}