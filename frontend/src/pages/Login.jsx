import { useState } from "react";
import { login, loginWithGoogle } from "../services/authService";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useToast } from "../contexts/ToastContext";
import { useAuth } from "../contexts/AuthContext";
import GoogleSignInButton from "../components/GoogleSignInButton";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const { login: authLogin } = useAuth();

  // After login, go back to the page the user tried to visit
  const from = location.state?.from?.pathname || "/dashboard/profiler";

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
      showToast("Đăng nhập thành công! Chào mừng bạn quay trở lại.", "success");
      navigate(from, { replace: true });
    } catch (error) {
      const msg = error.response?.data?.detail || "Không thể đăng nhập bằng Google. Vui lòng thử lại.";
      showToast(msg, "error");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleError = () => {
    showToast("Không thể đăng nhập bằng Google. Vui lòng thử lại.", "error");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await login(formData);
      authLogin(response.user, response.token.access_token);
      showToast("Đăng nhập thành công! Chào mừng bạn quay trở lại.", "success");
      navigate(from, { replace: true });
    } catch (error) {
      const msg =
        error.response?.data?.detail || "Không thể đăng nhập. Vui lòng kiểm tra lại địa chỉ email hoặc mật khẩu.";
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
            <h1 className="text-3xl font-serif font-bold tracking-tight mb-2 text-ink">Chào mừng trở lại</h1>
            <p className="text-muted text-sm">Đăng nhập để tiếp tục với DataMind</p>
          </div>

          <form
            id="login-form"
            onSubmit={handleSubmit}
            className="bg-white border border-border rounded-xl p-8 flex flex-col gap-4 shadow-sm"
          >
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-email" className="text-xs text-muted font-semibold uppercase tracking-wider">
                Email
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
                Mật khẩu
              </label>
              <input
                id="login-password"
                type="password"
                name="password"
                placeholder="••••••••"
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
                  Đang đăng nhập...
                </>
              ) : (
                "Đăng nhập"
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 mt-6">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted uppercase tracking-wider">Hoặc</span>
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
            Chưa có tài khoản?{" "}
            <Link to="/register" className="text-forest hover:text-forest/80 font-medium transition-colors">
              Đăng ký miễn phí
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}