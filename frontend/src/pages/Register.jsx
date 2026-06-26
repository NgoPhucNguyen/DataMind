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
      showToast("Đăng ký thành công! Vui lòng đăng nhập.", "success");
      navigate("/login");
    } catch (error) {
      const detail = error.response?.data?.detail;
      let msg = "Đăng ký thất bại. Vui lòng thử lại.";
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
    <div className="min-h-screen bg-[#0B0F1A] text-white flex flex-col">
      {/* Navbar minimal */}
      <header className="px-6 py-4 flex justify-between items-center border-b border-white/10">
        <Link to="/" className="text-lg font-bold tracking-tight">
          DataMind<span className="text-violet-400">.</span>
        </Link>
        <Link
          to="/login"
          className="text-sm text-white/50 hover:text-white transition-colors"
        >
          Đã có tài khoản? <span className="text-violet-400 font-medium">Đăng nhập</span>
        </Link>
      </header>

      {/* Form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold tracking-tight mb-2">Tạo tài khoản</h1>
            <p className="text-white/40 text-sm">Miễn phí trong giai đoạn Beta</p>
          </div>

          <form
            id="register-form"
            onSubmit={handleSubmit}
            className="bg-white/5 border border-white/10 rounded-2xl p-8 flex flex-col gap-4"
          >
            {/* Full Name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-fullname" className="text-xs text-white/50 font-medium uppercase tracking-wider">
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
                className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
              />
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-email" className="text-xs text-white/50 font-medium uppercase tracking-wider">
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
                className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="reg-password" className="text-xs text-white/50 font-medium uppercase tracking-wider">
                Mật khẩu
              </label>
              <input
                id="reg-password"
                type="password"
                name="password"
                placeholder="Tối thiểu 6 ký tự"
                required
                autoComplete="new-password"
                value={formData.password}
                onChange={handleChange}
                className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder-white/20 outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 transition-all"
              />
            </div>

            {/* Submit */}
            <button
              id="register-submit-btn"
              type="submit"
              disabled={loading}
              className="mt-2 bg-violet-500 hover:bg-violet-400 disabled:bg-violet-500/40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
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

            <p className="text-center text-white/20 text-[11px]">
              Bằng cách đăng ký, bạn đồng ý với Điều khoản sử dụng của DataMind.
            </p>
          </form>

          <p className="text-center text-white/30 text-xs mt-6">
            Đã có tài khoản?{" "}
            <Link to="/login" className="text-violet-400 hover:text-violet-300 transition-colors">
              Đăng nhập
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}