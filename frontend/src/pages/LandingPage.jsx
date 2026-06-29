import { useNavigate } from "react-router-dom";
import { getUser } from "../services/authService";
import HowItWorks from "./HowItWorks";
import Demo from "./Demo";
import { Search, Bot, BarChart } from "lucide-react";

const FEATURES = [
  {
    icon: <Search className="w-6 h-6 text-forest" />,
    title: "Data Profiler",
    desc: "Tự động phát hiện kiểu dữ liệu, thống kê null%, unique count cho từng cột.",
  },
  {
    icon: <Bot className="w-6 h-6 text-forest" />,
    title: "AI Context",
    desc: "Gemini phân tích ngữ cảnh dataset, xác định lĩnh vực và độ tin cậy.",
  },
  {
    icon: <BarChart className="w-6 h-6 text-forest" />,
    title: "Auto Chart Suggest",
    desc: "Gợi ý biểu đồ phù hợp dựa trên kiểu dữ liệu — không cần expertise.",
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const user = getUser();

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col overflow-x-hidden font-sans">
      {/* ── Navbar đã được quản lý ở App.jsx ── */}

      {/* ── Hero ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-8 py-24">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-sage text-forest border border-[#c8e0cb]/50 text-xs font-medium px-3 py-1.5 rounded-full shadow-sm">
          <span className="w-1.5 h-1.5 bg-forest rounded-full animate-pulse" />
          Phiên bản Beta — Miễn phí trong giai đoạn thử nghiệm
        </div>

        {/* Headline */}
        <div className="max-w-2xl">
          <h1 className="text-5xl md:text-6xl font-serif tracking-tight leading-tight mb-4 text-ink">
            Hiểu dữ liệu của bạn{" "}
            <span className="text-forest italic font-semibold">
              trong vài giây
            </span>
          </h1>
          <p className="text-muted text-base md:text-lg leading-relaxed max-w-xl mx-auto">
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
              className="bg-[#111111] hover:bg-[#222222] text-white px-8 py-3.5 rounded-lg font-semibold text-base transition-all active:scale-[0.98] shadow-sm"
            >
              Vào Dashboard →
            </button>
          ) : (
            <button
              id="hero-start-btn"
              onClick={() => navigate("/register")}
              className="bg-[#111111] hover:bg-[#222222] text-white px-8 py-3.5 rounded-lg font-semibold text-base transition-all active:scale-[0.98] shadow-sm"
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
              className="bg-white border border-border rounded-xl p-5 hover:border-forest/40 hover:bg-sage/10 transition-all shadow-sm"
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="font-serif font-bold text-sm text-ink mb-1">{f.title}</h3>
              <p className="text-muted text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Social proof */}
        <p className="text-muted/60 text-xs mt-4 mb-20">
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

      <footer className="border-t border-border px-6 py-6 text-center text-muted text-xs bg-white">
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
        <p className="text-xs uppercase tracking-[0.2em] text-forest mb-4 font-semibold">Gói dịch vụ</p>
        <h2 className="text-4xl font-serif tracking-tight text-ink mb-4">Bảng giá tham khảo</h2>
        <p className="text-muted text-base max-w-md mx-auto">Đăng ký để nhận ngay 100.000 credits miễn phí. Thanh toán bằng credits trong ví.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Free Plan */}
        <div className="rounded-xl border border-border bg-white p-6 flex flex-col shadow-sm">
          <h3 className="text-lg font-serif font-bold text-ink mb-1">Gói Cơ bản</h3>
          <p className="text-muted text-xs mb-6">Thời hạn 7 ngày</p>
          <div className="mb-6"><span className="text-3xl font-bold font-mono text-ink">10.000</span><span className="text-muted text-sm ml-2">credits</span></div>
          <button onClick={() => navigate(user ? "/pricing" : "/register")} className="mt-auto w-full py-2.5 rounded-lg text-sm font-semibold bg-white border border-border hover:bg-[#F9F9F8] text-ink transition-all active:scale-[0.98]">
            {user ? "Xem chi tiết" : "Bắt đầu ngay"}
          </button>
        </div>
        {/* Recommended standard Plan */}
        <div className="rounded-xl border-2 border-forest bg-sage/15 p-6 flex flex-col relative shadow-md shadow-forest/5">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2"><span className="bg-forest text-white text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">Phổ biến</span></div>
          <h3 className="text-lg font-serif font-bold text-ink mb-1">Gói Tiêu chuẩn</h3>
          <p className="text-muted text-xs mb-6">Thời hạn 30 ngày</p>
          <div className="mb-6"><span className="text-3xl font-bold font-mono text-ink">50.000</span><span className="text-muted text-sm ml-2">credits</span></div>
          <button onClick={() => navigate(user ? "/pricing" : "/register")} className="mt-auto w-full py-2.5 rounded-lg text-sm font-semibold bg-forest hover:bg-[#15361c] text-white transition-all active:scale-[0.98]">
            {user ? "Xem chi tiết" : "Bắt đầu ngay"}
          </button>
        </div>
        {/* Premium Academic Plan */}
        <div className="rounded-xl border border-border bg-white p-6 flex flex-col shadow-sm">
          <h3 className="text-lg font-serif font-bold text-ink mb-1">Gói Học thuật</h3>
          <p className="text-muted text-xs mb-6">Thời hạn 180 ngày</p>
          <div className="mb-6"><span className="text-3xl font-bold font-mono text-ink">250.000</span><span className="text-muted text-sm ml-2">credits</span></div>
          <button onClick={() => navigate(user ? "/pricing" : "/register")} className="mt-auto w-full py-2.5 rounded-lg text-sm font-semibold bg-white border border-border hover:bg-[#F9F9F8] text-ink transition-all active:scale-[0.98]">
            {user ? "Xem chi tiết" : "Bắt đầu ngay"}
          </button>
        </div>
      </div>
    </div>
  );
}
