import { useNavigate } from "react-router-dom";

const FEATURES = [
  {
    icon: "🔍",
    title: "Data Profiler",
    desc: "Tự động phát hiện kiểu dữ liệu, thống kê null%, unique count cho từng cột.",
  },
  {
    icon: "🤖",
    title: "AI Context",
    desc: "Gemini phân tích ngữ cảnh dataset, xác định lĩnh vực và độ tin cậy.",
  },
  {
    icon: "📊",
    title: "Auto Chart Suggest",
    desc: "Gợi ý biểu đồ phù hợp dựa trên kiểu dữ liệu — không cần expertise.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white flex flex-col">
      {/* ── Navbar ── */}
      <header className="border-b border-white/10 px-6 py-4 flex justify-between items-center sticky top-0 bg-[#0B0F1A]/90 backdrop-blur-sm z-10">
        <span className="text-lg font-bold tracking-tight">
          DataMind<span className="text-violet-400">.</span>
        </span>
        <div className="flex items-center gap-3">
          <button
            id="landing-login-btn"
            onClick={() => navigate("/login")}
            className="text-sm text-white/60 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-white/5"
          >
            Đăng nhập
          </button>
          <button
            id="landing-register-btn"
            onClick={() => navigate("/register")}
            className="bg-violet-500 hover:bg-violet-400 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-all"
          >
            Dùng thử miễn phí
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-8 py-24">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium px-3 py-1.5 rounded-full">
          <span className="w-1.5 h-1.5 bg-violet-400 rounded-full animate-pulse" />
          Phiên bản Beta — Miễn phí trong giai đoạn thử nghiệm
        </div>

        {/* Headline */}
        <div className="max-w-2xl">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight mb-4">
            Hiểu dữ liệu của bạn{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
              trong vài giây
            </span>
          </h1>
          <p className="text-white/40 text-lg leading-relaxed">
            DataMind kết hợp sức mạnh của Pandas và AI để phân tích, phân loại
            và gợi ý trực quan hóa cho dataset của bạn — không cần code.
          </p>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            id="hero-start-btn"
            onClick={() => navigate("/register")}
            className="bg-violet-500 hover:bg-violet-400 text-white px-8 py-3.5 rounded-xl font-semibold text-base transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40"
          >
            Bắt đầu miễn phí →
          </button>
          <button
            id="hero-login-btn"
            onClick={() => navigate("/login")}
            className="bg-white/5 hover:bg-white/10 border border-white/10 text-white px-8 py-3.5 rounded-xl font-semibold text-base transition-all"
          >
            Đăng nhập
          </button>
        </div>

        {/* Features grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 max-w-3xl w-full text-left">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all"
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
              <p className="text-white/40 text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Social proof */}
        <p className="text-white/20 text-xs mt-4">
          Hỗ trợ CSV · XLSX · XLS · Tối đa 10MB
        </p>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 px-6 py-4 text-center text-white/20 text-xs">
        © 2025 DataMind — Công cụ phân tích dữ liệu dành cho sinh viên Kinh tế
      </footer>
    </div>
  );
}
