import { useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { Search, Bot, BarChart2, Check, Sparkles } from "lucide-react";
import HowItWorks from "./HowItWorks";
import Demo from "./Demo";
import { getLocalizedPlans } from "../lib/plans";

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

// ── Landing Page ──────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();

  useEffect(() => {
    document.title = t("seo.title_landing", "DataMind — Xử lý dữ liệu của bạn trong vài giây");
  }, [t, i18n.language]);

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col overflow-x-hidden font-sans">
      {/* ── Hero ── */}
      <HeroSection navigate={navigate} user={user} t={t} />

      {/* ── Embedded Sections ── */}
      <div id="how-it-works">
        <HowItWorks />
      </div>
      <div id="demo">
        <Demo />
      </div>
      <div id="pricing">
        <PricingSection navigate={navigate} user={user} t={t} lang={i18n.language} />
      </div>

      <footer className="border-t border-border px-6 py-8 text-center text-muted text-xs bg-white">
        {t("footer.copyright", "© 2025 DataMind — Công cụ phân tích dữ liệu dành cho sinh viên Kinh tế")}
      </footer>
    </div>
  );
}

// ── Hero Section ──────────────────────────────────────────────────────────────
function HeroSection({ navigate, user, t }) {
  const heroRef = useFadeIn();

  const features = [
    {
      icon: <Search className="w-5 h-5 text-forest" strokeWidth={1.5} />,
      title: t("landing.feat_profiler_title", "Data Profiler"),
      desc: t("landing.feat_profiler_desc", "Tự động phát hiện kiểu dữ liệu, thống kê null%, unique count cho từng cột."),
    },
    {
      icon: <Bot className="w-5 h-5 text-forest" strokeWidth={1.5} />,
      title: t("landing.feat_ai_title", "AI Insights"),
      desc: t("landing.feat_ai_desc", "Gemini phân tích ngữ cảnh dataset, xác định lĩnh vực và đề xuất bước xử lý."),
    },
    {
      icon: <BarChart2 className="w-5 h-5 text-forest" strokeWidth={1.5} />,
      title: t("landing.feat_viz_title", "Auto Chart Suggest"),
      desc: t("landing.feat_viz_desc", "Gợi ý biểu đồ phù hợp theo kiểu dữ liệu — không cần expertise thống kê."),
    },
  ];

  return (
    <main
      ref={heroRef}
      className="fade-section flex-1 flex flex-col items-center justify-center px-6 text-center gap-10 py-24 md:py-32"
    >
      {/* Headline */}
      <div className="max-w-2xl">
        <h1 className="text-5xl md:text-6xl font-serif tracking-tight leading-[1.1] mb-5 text-ink">
          {t("landing.hero_title_1", "Xử lý dữ liệu của bạn")}{" "}
          <span className="text-forest italic">{t("landing.hero_title_2", "trong vài giây")}</span>
        </h1>
        <p className="text-muted text-base md:text-lg leading-relaxed max-w-xl mx-auto">
          {t("landing.hero_subtitle", "Upload file CSV / XLSX — DataMind tự động phân tích, làm sạch và gợi ý biểu đồ. Không cần viết một dòng code nào.")}
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
            {t("landing.hero_btn_dashboard", "Vào Dashboard →")}
          </button>
        ) : (
          <>
            <button
              id="hero-start-btn"
              onClick={() => navigate("/register")}
              className="hero-btn-primary"
            >
              {t("landing.hero_btn_start_free", "Bắt đầu miễn phí →")}
            </button>
            <button
              id="hero-pricing-btn"
              onClick={() => navigate("/pricing")}
              className="hero-btn-secondary"
            >
              {t("landing.hero_btn_pricing", "Xem gói dịch vụ")}
            </button>
          </>
        )}
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 max-w-3xl w-full text-left">
        {features.map((f, i) => (
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
        {t("landing.file_support_hint", "Hỗ trợ CSV · XLSX · XLS · Tối đa 10 MB · 50.000 dòng")}
      </p>
    </main>
  );
}

// ── Pricing Section ───────────────────────────────────────────────────────────
function PricingSection({ navigate, user, t, lang }) {
  const ref = useFadeIn();
  const plans = useMemo(() => getLocalizedPlans(t, lang), [t, lang]);
  const free = plans.free;
  const pro = plans.pro;

  return (
    <section ref={ref} className="fade-section py-20 md:py-24 px-6 w-full">
      {/* Section header */}
      <div className="text-center mb-14 max-w-xl mx-auto">
        <p className="text-xs uppercase tracking-[0.2em] text-forest mb-3 font-semibold">
          {t("landing.pricing_badge", "Gói dịch vụ")}
        </p>
        <h2 className="text-4xl font-serif tracking-tight text-ink mb-4">
          {t("landing.pricing_title", "Đơn giản, minh bạch")}
        </h2>
        <p className="text-muted text-base leading-relaxed">
          {t("landing.pricing_desc", "Bắt đầu miễn phí với {{freeRuns}} lượt AI mỗi ngày. Nâng cấp Pro để nhận {{proRuns}} lượt/ngày (hạn {{days}} ngày).", {
            freeRuns: free.aiRuns,
            proRuns: pro.aiRuns,
            days: pro.durationDays,
          })}
        </p>
      </div>

      {/* Cards — 2 cols, max-w-3xl centered */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
        {/* Free card */}
        <PlanCard
          plan={free}
          isFeatured={false}
          ctaLabel={user ? t("landing.plan_current", "Gói hiện tại") : t("landing.plan_start_free", "Bắt đầu miễn phí")}
          ctaDisabled={false}
          onCtaClick={() => navigate(user ? "/pricing" : "/register")}
          t={t}
        />

        {/* Pro card */}
        <PlanCard
          plan={pro}
          isFeatured={true}
          ctaLabel={user ? t("landing.plan_upgrade_now", "Nâng cấp ngay") : t("landing.plan_start_now", "Bắt đầu ngay")}
          ctaDisabled={false}
          onCtaClick={() => navigate(user ? "/pricing" : "/register")}
          badge={t("landing.badge_recommended", "Đề xuất")}
          t={t}
        />
      </div>
    </section>
  );
}

// ── Plan Card ─────────────────────────────────────────────────────────────────
function PlanCard({ plan, isFeatured, ctaLabel, ctaDisabled, onCtaClick, badge, t }) {
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
          {plan.priceLabel}
        </span>
        {plan.price > 0 && (
          <span className="text-muted text-sm">/ {plan.periodLabel}</span>
        )}
        {plan.price === 0 && (
          <span className="text-muted text-sm">{t ? t("landing.per_day", "/ ngày") : "/ ngày"}</span>
        )}
      </div>
      <p className="text-[11px] text-muted mb-6">
        {t
          ? t("landing.ai_reset_hint", "{{runs}} lượt AI/ngày · Reset 00:00 (giờ VN)", { runs: plan.aiRuns })
          : `${plan.aiRuns} lượt AI/ngày · Reset 00:00 (giờ VN)`}
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
