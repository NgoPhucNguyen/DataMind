import { useState, useEffect } from "react";
import { register } from "../services/authService";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useToast } from "../contexts/ToastContext";
import { track } from "../lib/analytics";
import { translateError } from "../i18n";

export default function Register() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { showToast } = useToast();

  useEffect(() => {
    document.title = t("seo.title_register", "Đăng ký tài khoản — DataMind");
  }, [t, i18n.language]);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(formData);
      track("sign_up", { method: "email" });
      showToast(t("auth.toast_register_success", "Đăng ký tài khoản thành công! Vui lòng đăng nhập để bắt đầu."), "success");
      navigate("/login");
    } catch (error) {
      const detail = error.response?.data?.detail;
      const msg = translateError(detail, t("auth.register_failed_fallback", "Không thể tạo tài khoản. Vui lòng kiểm tra lại thông tin hoặc thử lại sau."));
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
              {t("auth.register_title", "Tạo tài khoản")}
            </h1>
            <p className="text-muted text-sm">
              {t("auth.register_subtitle", "Miễn phí trong giai đoạn Beta")}
            </p>
          </div>

          <form
            id="register-form"
            onSubmit={handleSubmit}
            className="bg-white border border-border rounded-xl p-8 flex flex-col gap-4 shadow-sm"
          >
            {/* Full Name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-fullname" className="text-xs text-muted font-semibold uppercase tracking-wider">
                {t("auth.full_name_label", "Họ và tên")}
              </label>
              <input
                id="reg-fullname"
                type="text"
                name="full_name"
                placeholder={t("auth.full_name_placeholder", "Nguyễn Văn A")}
                required
                autoComplete="name"
                value={formData.full_name}
                onChange={handleChange}
                className="bg-canvas border border-border rounded-lg px-4 py-3 text-sm text-ink placeholder-muted/40 outline-none focus:border-forest/60 focus:ring-1 focus:ring-forest/30 transition-all"
              />
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-email" className="text-xs text-muted font-semibold uppercase tracking-wider">
                {t("auth.email_label", "Email")}
              </label>
              <input
                id="reg-email"
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
              <label htmlFor="reg-password" className="text-xs text-muted font-semibold uppercase tracking-wider">
                {t("auth.password_label", "Mật khẩu")}
              </label>
              <input
                id="reg-password"
                type="password"
                name="password"
                placeholder={t("auth.password_placeholder_register", "Tối thiểu 8 ký tự và phải có ít nhất 1 chữ cái")}
                required
                autoComplete="new-password"
                value={formData.password}
                onChange={handleChange}
                className="bg-canvas border border-border rounded-lg px-4 py-3 text-sm text-ink placeholder-muted/40 outline-none focus:border-forest/60 focus:ring-1 focus:ring-forest/30 transition-all"
              />
            </div>

            {/* Submit */}
            <button
              id="register-submit-btn"
              type="submit"
              disabled={loading}
              className="mt-2 bg-[#111111] hover:bg-[#222222] disabled:bg-[#111111]/40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {t("auth.btn_registering", "Đang tạo tài khoản...")}
                </>
              ) : (
                t("auth.btn_register", "Đăng ký miễn phí")
              )}
            </button>

            <p className="text-center text-muted/80 text-[11px]">
              {t("auth.terms_notice", "Bằng cách đăng ký, bạn đồng ý với Điều khoản sử dụng của DataMind.")}
            </p>
          </form>

          <p className="text-center text-muted text-xs mt-6">
            {t("auth.have_account_prompt", "Đã có tài khoản?")}{" "}
            <Link to="/login" className="text-forest hover:text-forest/80 font-medium transition-colors">
              {t("auth.login_link", "Đăng nhập")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}