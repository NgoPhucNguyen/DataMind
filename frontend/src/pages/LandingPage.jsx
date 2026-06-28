import { useNavigate } from "react-router-dom";
import { getUser } from "../services/authService";
import HowItWorks from "./HowItWorks";
import Demo from "./Demo";

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
  const user = getUser();

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-white flex flex-col overflow-x-hidden">
      {/* ── Navbar đã được quản lý ở App.jsx ── */}

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
          {user ? (
            <button
              id="hero-dashboard-btn"
              onClick={() => navigate("/home")}
              className="bg-violet-500 hover:bg-violet-400 text-white px-8 py-3.5 rounded-xl font-semibold text-base transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40"
            >
              Vào Dashboard →
            </button>
          ) : (
            <button
              id="hero-start-btn"
              onClick={() => navigate("/register")}
              className="bg-violet-500 hover:bg-violet-400 text-white px-8 py-3.5 rounded-xl font-semibold text-base transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40"
            >
              Bắt đầu miễn phí →
            </button>
          )}
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
        <p className="text-white/20 text-xs mt-4 mb-20">
          Hỗ trợ CSV · XLSX · XLS · Tối đa 10MB
        </p>
      </main>

      {/* Embedded Sections */}
      <div id="how-it-works">
        <HowItWorks />
      </div>
      <div id="demo">
        <Demo />
      </div>
      <div id="pricing">
        <PricingSection navigate={navigate} />
      </div>

      <footer className="border-t border-white/5 px-6 py-4 text-center text-white/20 text-xs">
        © 2025 DataMind — Công cụ phân tích dữ liệu dành cho sinh viên Kinh tế
      </footer>
    </div>
  );
}

// Static Pricing Section for Landing Page
function PricingSection({ navigate }) {
  const user = getUser();

  return (
    <div className="py-20 max-w-5xl mx-auto px-6 w-full">
      <div className="text-center mb-14">
        <p className="text-xs uppercase tracking-[0.2em] text-violet-400 mb-4 font-medium">Gói dịch vụ</p>
        <h2 className="text-4xl font-bold tracking-tight mb-4">Bảng giá tham khảo</h2>
        <p className="text-white/50 text-base max-w-md mx-auto">Đăng ký để nhận ngay 100.000 credits miễn phí. Thanh toán bằng credits trong ví.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col">
          <h3 className="text-lg font-bold mb-1">Gói Cơ bản</h3>
          <p className="text-white/40 text-xs mb-6">Thời hạn 7 ngày</p>
          <div className="mb-6"><span className="text-3xl font-bold font-mono">10.000</span><span className="text-white/40 text-sm ml-2">credits</span></div>
          <button onClick={() => navigate(user ? "/pricing" : "/register")} className="mt-auto w-full py-3 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 transition-all">
            {user ? "Xem chi tiết" : "Bắt đầu ngay"}
          </button>
        </div>
        <div className="rounded-2xl border border-violet-500 bg-violet-500/10 p-6 flex flex-col relative shadow-lg shadow-violet-500/10">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2"><span className="bg-violet-500 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">Phổ biến</span></div>
          <h3 className="text-lg font-bold mb-1">Gói Tiêu chuẩn</h3>
          <p className="text-white/40 text-xs mb-6">Thời hạn 30 ngày</p>
          <div className="mb-6"><span className="text-3xl font-bold font-mono">50.000</span><span className="text-white/40 text-sm ml-2">credits</span></div>
          <button onClick={() => navigate(user ? "/pricing" : "/register")} className="mt-auto w-full py-3 rounded-xl text-sm font-semibold bg-violet-500 hover:bg-violet-400 transition-all">
            {user ? "Xem chi tiết" : "Bắt đầu ngay"}
          </button>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col">
          <h3 className="text-lg font-bold mb-1">Gói Học thuật</h3>
          <p className="text-white/40 text-xs mb-6">Thời hạn 180 ngày</p>
          <div className="mb-6"><span className="text-3xl font-bold font-mono">250.000</span><span className="text-white/40 text-sm ml-2">credits</span></div>
          <button onClick={() => navigate(user ? "/pricing" : "/register")} className="mt-auto w-full py-3 rounded-xl text-sm font-semibold bg-white/10 hover:bg-white/20 transition-all">
            {user ? "Xem chi tiết" : "Bắt đầu ngay"}
          </button>
        </div>
      </div>
    </div>
  );
}
