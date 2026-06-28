import { useState } from "react";
import { login } from "../services/authService";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useToast } from "../contexts/ToastContext";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();

  // Sau khi login, quay lại trang người dùng muốn vào (nếu bị redirect)
  const from = location.state?.from?.pathname || "/home";

  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await login(formData);
      localStorage.setItem("token", response.token.access_token);
      localStorage.setItem("user", JSON.stringify(response.user));
      showToast("Đăng nhập thành công! Chào mừng trở lại.", "success");
      navigate(from, { replace: true });
    } catch (error) {
      const msg =
        error.response?.data?.detail || "Đăng nhập thất bại. Vui lòng thử lại.";
      showToast(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white flex flex-col">
     

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Chào mừng trở lại</h1>
            <p className="text-white/40 text-sm">Đăng nhập để tiếp tục với DataMind</p>
          </div>

          <form
            id="login-form"
            onSubmit={handleSubmit}
            className="bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col gap-4"
          >
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-email" className="text-xs text-white/50 font-medium uppercase tracking-wider">
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
                className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-password" className="text-xs text-white/50 font-medium uppercase tracking-wider">
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
                className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
              />
            </div>

            {/* Submit */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="mt-2 bg-violet-500 hover:bg-violet-400 disabled:bg-violet-500/40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
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

          <p className="text-center text-white/30 text-xs mt-6">
            Chưa có tài khoản?{" "}
            <Link to="/register" className="text-violet-400 hover:text-violet-300 transition-colors">
              Đăng ký miễn phí
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
