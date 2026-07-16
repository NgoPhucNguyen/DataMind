import { useState } from "react";
import { register } from "../services/authService";
import { Link, useNavigate } from "react-router-dom";
import { useToast } from "../contexts/ToastContext";

export default function Register() {
  const navigate = useNavigate();
  const { showToast } = useToast();

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
      showToast("Đăng ký tài khoản thành công! Vui lòng đăng nhập để bắt đầu.", "success");
      navigate("/login");
    } catch (error) {
      const detail = error.response?.data?.detail;
      let msg = "Không thể tạo tài khoản. Vui lòng kiểm tra lại thông tin hoặc thử lại sau.";
      if (Array.isArray(detail)) {
        msg = detail[0].msg.replace("Value error, ", "");
      } else if (typeof detail === "string") {
        msg = detail;
      }
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
            <h1 className="text-3xl font-serif font-bold tracking-tight mb-2 text-ink">Tạo tài khoản</h1>
            <p className="text-muted text-sm">Miễn phí trong giai đoạn Beta</p>
          </div>

          <form
            id="register-form"
            onSubmit={handleSubmit}
            className="bg-white border border-border rounded-xl p-8 flex flex-col gap-4 shadow-sm"
          >
            {/* Full Name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-fullname" className="text-xs text-muted font-semibold uppercase tracking-wider">
                Họ và tên
              </label>
              <input
                id="reg-fullname"
                type="text"
                name="full_name"
                placeholder="Nguyễn Văn A"
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
                Email
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
                Mật khẩu
              </label>
              <input
                id="reg-password"
                type="password"
                name="password"
                placeholder="Tối thiểu 8 ký tự và phải có ít nhất 1 chữ cái"
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
                  Đang tạo tài khoản...
                </>
              ) : (
                "Đăng ký miễn phí"
              )}
            </button>

            <p className="text-center text-muted/80 text-[11px]">
              Bằng cách đăng ký, bạn đồng ý với Điều khoản sử dụng của DataMind.
            </p>
          </form>

          <p className="text-center text-muted text-xs mt-6">
            Đã có tài khoản?{" "}
            <Link to="/login" className="text-forest hover:text-forest/80 font-medium transition-colors">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}