import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Search, Bot, BarChart2, Check, Sparkles } from "lucide-react";
import HowItWorks from "./HowItWorks";
import Demo from "./Demo";
import { PLANS, formatVND } from "../lib/plans";

// ── Scroll-fade hook ──────────────────────────────────────────────────────────
function useFadeIn() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.12 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

// ── Feature data ──────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: <Search className="w-5 h-5 text-forest" strokeWidth={1.5} />,
    title: "Data Profiler",
    desc: "Tự động phát hiện kiểu dữ liệu, thống kê null%, unique count cho từng cột.",
  },
  {
    icon: <Bot className="w-5 h-5 text-forest" strokeWidth={1.5} />,
    title: "AI Insights",
    desc: "Gemini phân tích ngữ cảnh dataset, xác định lĩnh vực và đề xuất bước xử lý.",
  },
  {
    icon: <BarChart2 className="w-5 h-5 text-forest" strokeWidth={1.5} />,
    title: "Auto Chart Suggest",
    desc: "Gợi ý biểu đồ phù hợp theo kiểu dữ liệu — không cần expertise thống kê.",
  },
];

// ── Landing Page ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col overflow-x-hidden font-sans">
      {/* ── Hero ── */}
      <HeroSection navigate={navigate} user={user} />

      {/* ── Embedded Sections ── */}
      <div id="how-it-works">
        <HowItWorks />
      </div>
      <div id="demo">
        <Demo />
      </div>
      <div id="pricing">
        <PricingSection navigate={navigate} user={user} />
      </div>

      <footer className="border-t border-border px-6 py-8 text-center text-muted text-xs bg-white">
        © 2025 DataMind — Công cụ phân tích dữ liệu dành cho sinh viên Kinh tế
      </footer>
    </div>
  );
}

// ── Hero Section ──────────────────────────────────────────────────────────────
function HeroSection({ navigate, user }) {
  const heroRef = useFadeIn();

  return (
    <main
      ref={heroRef}
      className="fade-section flex-1 flex flex-col items-center justify-center px-6 text-center gap-10 py-24 md:py-32"
    >
      {/* Headline */}
      <div className="max-w-2xl">
        <h1 className="text-5xl md:text-6xl font-serif tracking-tight leading-[1.1] mb-5 text-ink">
          Xử lý dữ liệu của bạn{" "}
          <span className="text-forest italic">trong vài giây</span>
        </h1>
        <p className="text-muted text-base md:text-lg leading-relaxed max-w-xl mx-auto">
          Upload file CSV / XLSX — DataMind tự động phân tích, làm sạch và gợi
          ý biểu đồ. Không cần viết một dòng code nào.
        </p>
      </div>

      {/* CTA buttons */}
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-none sm:w-auto">
        {user ? (
          <button
            id="hero-dashboard-btn"
            onClick={() => navigate("/dashboard/profiler")}
            className="hero-btn-primary"
          >
            Vào Dashboard →
          </button>
        ) : (
          <>
            <button
              id="hero-start-btn"
              onClick={() => navigate("/register")}
              className="hero-btn-primary"
            >
              Bắt đầu miễn phí →
            </button>
            <button
              id="hero-pricing-btn"
              onClick={() => navigate("/pricing")}
              className="hero-btn-secondary"
            >
              Xem gói dịch vụ
            </button>
          </>
        )}
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 max-w-3xl w-full text-left">
        {FEATURES.map((f, i) => (
          <div
            key={f.title}
            className="feature-card"
            style={{ "--delay": `${i * 80}ms` }}
          >
            <div className="mb-3 p-2 rounded-lg bg-sage/50 inline-flex">
              {f.icon}
            </div>
            <h3 className="font-serif font-bold text-sm text-ink mb-1">
              {f.title}
            </h3>
            <p className="text-muted text-xs leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      {/* Social proof */}
      <p className="text-muted/60 text-xs">
        Hỗ trợ CSV · XLSX · XLS · Tối đa 10 MB · 50.000 dòng
      </p>
    </main>
  );
}

// ── Pricing Section ───────────────────────────────────────────────────────────
function PricingSection({ navigate, user }) {
  const ref = useFadeIn();
  const free = PLANS.free;
  const pro = PLANS.pro;

  return (
    <section ref={ref} className="fade-section py-20 md:py-24 px-6 w-full">
      {/* Section header */}
      <div className="text-center mb-14 max-w-xl mx-auto">
        <p className="text-xs uppercase tracking-[0.2em] text-forest mb-3 font-semibold">
          Gói dịch vụ
        </p>
        <h2 className="text-4xl font-serif tracking-tight text-ink mb-4">
          Đơn giản, minh bạch
        </h2>
        <p className="text-muted text-base leading-relaxed">
          Bắt đầu miễn phí với {free.aiRuns} lượt AI mỗi ngày.
          <br />
          Nâng cấp Pro để
          nhận {pro.aiRuns} lượt/ngày (hạn {pro.durationDays} ngày).
        </p>
      </div>

      {/* Cards — 2 cols, max-w-3xl centered */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Free card */}
        <PlanCard
          plan={free}
          isFeatured={false}
          ctaLabel={user ? "Gói hiện tại" : "Bắt đầu miễn phí"}
          ctaDisabled={false}
          onCtaClick={() => navigate(user ? "/pricing" : "/register")}
        />

        {/* Pro card */}
        <PlanCard
          plan={pro}
          isFeatured={true}
          ctaLabel={user ? "Nâng cấp ngay" : "Bắt đầu ngay"}
          ctaDisabled={false}
          onCtaClick={() => navigate(user ? "/pricing" : "/register")}
          badge="Đề xuất"
        />
      </div>
    </section>
  );
}

// ── Plan Card ─────────────────────────────────────────────────────────────────
function PlanCard({ plan, isFeatured, ctaLabel, ctaDisabled, onCtaClick, badge }) {
  return (
    <div
      className={`plan-card flex flex-col relative ${isFeatured ? "plan-card--featured" : "plan-card--free"
        }`}
    >
      {/* Badge */}
      {badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 bg-forest text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
            <Sparkles className="w-2.5 h-2.5" strokeWidth={2} />
            {badge}
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-5">
        <h3
          className={`text-xl font-serif font-bold mb-0.5 ${isFeatured ? "text-forest" : "text-ink"
            }`}
        >
          {plan.name}
        </h3>
        <p className="text-muted text-xs">{plan.subtitle}</p>
      </div>

      {/* Price */}
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-4xl font-bold font-mono text-ink tracking-tight">
          {plan.price === 0 ? "0đ" : formatVND(plan.price)}
        </span>
        {plan.price > 0 && (
          <span className="text-muted text-sm">/ {plan.periodLabel}</span>
        )}
        {plan.price === 0 && (
          <span className="text-muted text-sm">/ ngày</span>
        )}
      </div>
      <p className="text-[11px] text-muted mb-6">
        {plan.aiRuns} lượt AI/ngày · Reset 00:00 (giờ VN)
      </p>

      {/* Features */}
      <ul className="space-y-3 mb-8 flex-1">
        {plan.features.map((feat) => (
          <li key={feat} className="flex items-start gap-2.5 text-sm">
            <Check
              className={`w-4 h-4 mt-0.5 shrink-0 ${isFeatured ? "text-forest" : "text-forest/70"
                }`}
              strokeWidth={2.5}
            />
            <span className={isFeatured ? "text-ink" : "text-muted"}>
              {feat}
            </span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={onCtaClick}
        disabled={ctaDisabled}
        className={`w-full py-3 rounded-lg text-sm font-semibold transition-all active:scale-[0.98] ${ctaDisabled
          ? "bg-sage/50 text-ink/40 cursor-not-allowed"
          : isFeatured
            ? "bg-ink hover:bg-ink/90 text-white shadow-sm"
            : "bg-white border border-border hover:bg-sage/20 text-ink"
          }`}
      >
        {ctaLabel}
      </button>
    </div>
  );
}
