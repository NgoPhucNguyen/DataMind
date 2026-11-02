import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Search,
  BookOpen,
  ChevronRight,
  ChevronDown,
  Menu,
  X,
  Sparkles,
  Layers,
  Database,
  Wand2,
  PieChart,
  Clock,
  HelpCircle,
  Hash,
} from "lucide-react";
import api from "../services/axiosClient";
import MarkdownDocViewer from "../components/docs/MarkdownDocViewer";

// Raw markdown imports from docs/vi/profiler/
import profilerOverviewRaw from "../docs/vi/profiler/overview.md?raw";
import profilerDataTypesRaw from "../docs/vi/profiler/data-types.md?raw";
import profilerColumnStatsRaw from "../docs/vi/profiler/column-stats.md?raw";
import profilerAttentionRaw from "../docs/vi/profiler/attention.md?raw";
import profilerOverrideRaw from "../docs/vi/profiler/override.md?raw";
import profilerAiContextRaw from "../docs/vi/profiler/ai-context.md?raw";
import profilerSessionRaw from "../docs/vi/profiler/session.md?raw";

const PROFILER_DOCS = {
  overview: {
    id: "overview",
    title: "Tổng quan Đánh giá dữ liệu",
    raw: profilerOverviewRaw,
    icon: Database,
  },
  "data-types": {
    id: "data-types",
    title: "5 kiểu dữ liệu & cây quyết định",
    raw: profilerDataTypesRaw,
    icon: Layers,
  },
  "column-stats": {
    id: "column-stats",
    title: "Thống kê cột & Gợi ý biểu đồ",
    raw: profilerColumnStatsRaw,
    icon: PieChart,
  },
  attention: {
    id: "attention",
    title: "4 lý do cột cần xem xét",
    raw: profilerAttentionRaw,
    icon: HelpCircle,
  },
  override: {
    id: "override",
    title: "Ghi đè kiểu dữ liệu & Tác động",
    raw: profilerOverrideRaw,
    icon: Wand2,
  },
  "ai-context": {
    id: "ai-context",
    title: "Ngữ cảnh AI & Lĩnh vực dữ liệu",
    raw: profilerAiContextRaw,
    icon: Sparkles,
  },
  session: {
    id: "session",
    title: "Phiên làm việc & Bộ nhớ tạm",
    raw: profilerSessionRaw,
    icon: Clock,
  },
};

const STATIC_SECTIONS = [
  {
    id: "intro",
    title: "Giới thiệu DataMind",
    content: [
      {
        heading: "Về DataMind",
        body: "DataMind là một công cụ hỗ trợ phân tích và làm sạch dữ liệu tự động dành cho sinh viên Kinh tế và những người làm dữ liệu không chuyên. Dự án nhằm mục đích giảm thiểu thời gian xử lý dữ liệu thô và tự động gợi ý các biểu đồ trực quan hóa hữu ích thông qua AI.",
      },
      {
        heading: "Mục tiêu",
        body: "Giúp người dùng dễ dàng hiểu được bức tranh toàn cảnh của tập dữ liệu (dataset) thông qua các bảng thống kê tự động và nhận xét ngữ cảnh của AI mà không cần viết bất kỳ dòng code nào.",
      },
    ],
  },
  {
    id: "pricing_calc",
    title: "Gói dịch vụ & Hạn mức",
    content: [
      {
        heading: "Gói Free — Miễn phí",
        body: "Mỗi ngày, tài khoản Free nhận được 3 lượt AI Insights. Lượt sử dụng được tự động làm mới vào 00:00 (giờ Việt Nam). Các tính năng phân tích dữ liệu, làm sạch thủ công và trực quan hóa hoạt động bình thường không giới hạn.",
      },
      {
        heading: "Gói Pro — 50.000đ / 30 ngày",
        body: "Nhận 20 lượt AI Insights mỗi ngày trong thời hạn 30 ngày. Lượt sử dụng reset vào 00:00 hàng ngày (giờ VN). Phù hợp cho người dùng cần phân tích chuyên sâu, làm sạch dữ liệu tự động bằng AI và xuất báo cáo chi tiết. Bạn có thể gia hạn bất kỳ lúc nào để cộng dồn thêm 30 ngày.",
      },
    ],
  },
  {
    id: "about",
    title: "Về đội ngũ",
    content: [
      {
        heading: "Đội ngũ phát triển",
        body: "Chúng tôi là nhóm sinh viên đam mê công nghệ và khoa học dữ liệu, phát triển DataMind với mong muốn biến quá trình Data Profiling và Data Cleaning trở nên cực kỳ đơn giản.",
      },
    ],
  },
  {
    id: "faq",
    title: "Câu hỏi thường gặp",
    content: [
      {
        heading: "DataMind hỗ trợ định dạng file nào?",
        body: "Hiện tại chúng tôi hỗ trợ các định dạng phổ biến như: CSV, Excel (.xlsx, .xls). Kích thước tối đa là 10MB.",
      },
      {
        heading: "Tính bảo mật dữ liệu ra sao?",
        body: "File của bạn KHÔNG được lưu trên trình duyệt hay ổ cứng máy chủ lâu dài. Dữ liệu được đẩy vào bộ nhớ RAM (Redis) và sẽ TỰ ĐỘNG BỐC HƠI sau 5 giờ. Đảm bảo an toàn tuyệt đối.",
      },
    ],
  },
];

/**
 * Helper to flatten a nested metadata dict into a flat key-value map.
 * E.g. { profiler: { categorical_unique_threshold: { value: 15 } } }
 *   -> { "profiler.categorical_unique_threshold": 15 }
 */
function flattenRules(metadata) {
  const flat = {};
  if (!metadata || typeof metadata !== "object") return flat;

  Object.entries(metadata).forEach(([group, items]) => {
    if (items && typeof items === "object") {
      Object.entries(items).forEach(([key, valObj]) => {
        if (valObj && typeof valObj === "object" && "value" in valObj) {
          flat[`${group}.${key}`] = valObj.value;
        } else if (typeof valObj !== "object") {
          flat[`${group}.${key}`] = valObj;
        }
      });
    }
  });
  return flat;
}

export default function Docs() {
  const { module: routeModule, topic: routeTopic } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();

  const [activeModule, setActiveModule] = useState("profiler");
  const [activeTopic, setActiveTopic] = useState("overview");
  const [rules, setRules] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [tocHeadings, setTocHeadings] = useState([]);
  const [profilerExpanded, setProfilerExpanded] = useState(true);

  // Sync route params to state
  useEffect(() => {
    if (routeModule === "profiler") {
      setActiveModule("profiler");
      if (routeTopic && PROFILER_DOCS[routeTopic]) {
        setActiveTopic(routeTopic);
      } else {
        setActiveTopic("overview");
      }
    } else if (routeModule) {
      setActiveModule(routeModule);
      setActiveTopic(routeTopic || "");
    } else {
      setActiveModule("profiler");
      setActiveTopic("overview");
    }
  }, [routeModule, routeTopic]);

  // Fetch /api/v1/meta/rules once
  useEffect(() => {
    let isMounted = true;
    api.get("/meta/rules")
      .then((res) => {
        if (isMounted) setRules(flattenRules(res.data));
      })
      .catch((err) => {
        console.warn("Could not load /meta/rules:", err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Parse headings (h2, h3) from markdown raw text for right TOC
  useEffect(() => {
    if (activeModule === "profiler" && PROFILER_DOCS[activeTopic]) {
      const rawText = PROFILER_DOCS[activeTopic].raw.normalize("NFC");
      const lines = rawText.split("\n");
      const headings = [];

      lines.forEach((line) => {
        const h2Match = line.match(/^##\s+(.+)$/);
        const h3Match = line.match(/^###\s+(.+)$/);

        if (h2Match || h3Match) {
          const level = h2Match ? 2 : 3;
          const textFull = (h2Match || h3Match)[1].trim();
          const anchorMatch = textFull.match(/\{#([\w-]+)\}\s*$/);
          let id = "";
          let title = textFull;

          if (anchorMatch) {
            id = anchorMatch[1];
            title = textFull.replace(/\{#([\w-]+)\}\s*$/, "").trim();
          } else {
            id = textFull
              .toLowerCase()
              .replace(/[^\w\s-]/g, "")
              .replace(/\s+/g, "-");
          }

          headings.push({ level, title, id });
        }
      });

      setTocHeadings(headings);
    } else {
      setTocHeadings([]);
    }
  }, [activeModule, activeTopic]);

  // Handle hash scrolling and highlight
  useEffect(() => {
    if (location.hash) {
      const targetId = location.hash.replace("#", "");
      const timer = setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          el.classList.add("bg-forest/10", "transition-colors");
          setTimeout(() => {
            el.classList.remove("bg-forest/10");
          }, 2000);
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [location.hash, activeTopic, activeModule]);

  const handleSelectProfilerTopic = (topicKey) => {
    navigate(`/docs/profiler/${topicKey}`);
    setMobileDrawerOpen(false);
  };

  const handleSelectStatic = (sectionId) => {
    setActiveModule("static");
    setActiveTopic(sectionId);
    navigate(`/docs`);
    setMobileDrawerOpen(false);
  };

  // Search filter across profiler topic titles and headings
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const results = [];

    Object.entries(PROFILER_DOCS).forEach(([topicKey, doc]) => {
      if (doc.title.toLowerCase().includes(q)) {
        results.push({
          module: "profiler",
          topic: topicKey,
          title: doc.title,
          sub: "Chủ đề",
          anchor: "",
        });
      }
      const lines = doc.raw.normalize("NFC").split("\n");
      lines.forEach((line) => {
        const match = line.match(/^#{1,3}\s+(.+)$/);
        if (match) {
          const heading = match[1];
          if (heading.toLowerCase().includes(q)) {
            const anchorMatch = heading.match(/\{#([\w-]+)\}\s*$/);
            const anchor = anchorMatch ? `#${anchorMatch[1]}` : "";
            const cleanTitle = heading.replace(/\{#([\w-]+)\}\s*$/, "").trim();
            results.push({
              module: "profiler",
              topic: topicKey,
              title: cleanTitle,
              sub: `Trong: ${doc.title}`,
              anchor,
            });
          }
        }
      });
    });

    return results.slice(0, 8);
  }, [searchQuery]);

  const currentProfilerDoc = activeModule === "profiler" ? PROFILER_DOCS[activeTopic] || PROFILER_DOCS.overview : null;
  const currentStaticDoc = activeModule === "static" ? STATIC_SECTIONS.find((s) => s.id === activeTopic) || STATIC_SECTIONS[0] : null;

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
      {/* Top sticky sub-bar for search & mobile toggle */}
      <div className="border-b border-border bg-canvas/90 backdrop-blur sticky top-14 z-30 px-4 md:px-8 py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
            className="md:hidden p-1.5 rounded-lg border border-border text-ink hover:bg-sage/40"
            aria-label="Mở danh mục"
          >
            {mobileDrawerOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2 text-xs text-muted">
            <BookOpen className="w-4 h-4 text-forest shrink-0" />
            <span className="font-semibold text-ink">Tài liệu</span>
            <span>/</span>
            <span className="text-forest font-medium">{t("profiler.title", "Đánh giá dữ liệu")}</span>
            {activeModule === "profiler" && (
              <>
                <span>/</span>
                <span className="text-ink font-medium truncate max-w-[180px] sm:max-w-xs">{currentProfilerDoc?.title}</span>
              </>
            )}
          </div>
        </div>

        {/* Search input */}
        <div className="relative w-56 sm:w-72 md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder="Tìm kiếm tài liệu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-border rounded-lg text-ink placeholder:text-muted/60 focus:outline-none focus:border-forest"
          />
          {searchResults.length > 0 && (
            <div className="absolute top-full mt-1.5 left-0 right-0 bg-white border border-border rounded-xl shadow-lg z-50 overflow-hidden max-h-72 overflow-y-auto">
              {searchResults.map((res, i) => (
                <button
                  key={i}
                  onClick={() => {
                    navigate(`/docs/${res.module}/${res.topic}${res.anchor}`);
                    setSearchQuery("");
                  }}
                  className="w-full text-left px-3.5 py-2.5 hover:bg-sage/30 border-b border-border/50 last:border-0 transition-colors"
                >
                  <div className="text-xs font-semibold text-ink flex items-center gap-1.5">
                    <Hash className="w-3 h-3 text-forest shrink-0" />
                    <span className="truncate">{res.title}</span>
                  </div>
                  <div className="text-[11px] text-muted truncate">{res.sub}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex w-full max-w-7xl mx-auto">
        {/* Left Sidebar (Desktop) */}
        <aside className="w-64 flex-shrink-0 border-r border-border px-3 py-6 sticky top-28 self-start hidden md:block max-h-[calc(100vh-7rem)] overflow-y-auto">
          {/* Module group: Đánh giá dữ liệu */}
          <div className="mb-6">
            <button
              onClick={() => setProfilerExpanded(!profilerExpanded)}
              className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted hover:text-ink px-2 py-1.5 rounded transition-colors text-left"
            >
              <span className="flex items-center gap-2 leading-relaxed">
                <Database className="w-3.5 h-3.5 text-forest shrink-0" />
                <span>{t("profiler.title", "Đánh giá dữ liệu")} (Profiler)</span>
              </span>
              {profilerExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 shrink-0 ml-1" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 shrink-0 ml-1" />
              )}
            </button>

            {profilerExpanded && (
              <nav className="flex flex-col gap-0.5 mt-1 pl-2">
                {Object.entries(PROFILER_DOCS).map(([key, item]) => {
                  const Icon = item.icon;
                  const isActive = activeModule === "profiler" && activeTopic === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handleSelectProfilerTopic(key)}
                      title={item.title}
                      className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
                        isActive
                          ? "bg-sage text-forest font-semibold shadow-xs"
                          : "text-muted hover:text-ink hover:bg-sage/40"
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-forest" : "text-muted"}`} />
                      <span className="truncate">{item.title}</span>
                    </button>
                  );
                })}
              </nav>
            )}
          </div>

          {/* Module group: Static & General */}
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-wider text-muted px-2 py-1.5 leading-relaxed">
              Chung & Chính sách
            </p>
            <nav className="flex flex-col gap-0.5 mt-1">
              {STATIC_SECTIONS.map((s) => {
                const isActive = activeModule === "static" && activeTopic === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleSelectStatic(s.id)}
                    title={s.title}
                    className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors truncate ${
                      isActive
                        ? "bg-sage text-forest font-semibold"
                        : "text-muted hover:text-ink hover:bg-sage/40"
                    }`}
                  >
                    {s.title}
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Mobile Drawer */}
        {mobileDrawerOpen && (
          <div className="md:hidden fixed inset-0 z-40 bg-ink/40 backdrop-blur-xs flex">
            <div className="w-72 bg-canvas h-full p-4 overflow-y-auto border-r border-border shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
                <span className="font-bold text-sm text-ink">Mục lục tài liệu</span>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1 rounded text-muted hover:text-ink"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-wider text-forest mb-2 leading-relaxed">
                  {t("profiler.title", "Đánh giá dữ liệu")} (Profiler)
                </p>
                <div className="space-y-1">
                  {Object.entries(PROFILER_DOCS).map(([key, item]) => (
                    <button
                      key={key}
                      onClick={() => handleSelectProfilerTopic(key)}
                      title={item.title}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium truncate block ${
                        activeModule === "profiler" && activeTopic === key
                          ? "bg-sage text-forest font-semibold"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted mb-2 leading-relaxed">
                  Chung & Chính sách
                </p>
                <div className="space-y-1">
                  {STATIC_SECTIONS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => handleSelectStatic(s.id)}
                      title={s.title}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium truncate block ${
                        activeModule === "static" && activeTopic === s.id
                          ? "bg-sage text-forest font-semibold"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      {s.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex-1" onClick={() => setMobileDrawerOpen(false)} />
          </div>
        )}

        {/* Main Document Content */}
        <main className="flex-1 px-4 sm:px-8 md:px-12 py-8 max-w-3xl min-w-0">
          {i18n.language === "en" && (
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between">
              <span>English version coming soon. Displaying Vietnamese documentation.</span>
            </div>
          )}

          {activeModule === "profiler" && currentProfilerDoc && (
            <div>
              <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-forest/10 text-forest border border-forest/20">
                <Database className="w-3.5 h-3.5 shrink-0" />
                <span>Mô-đun {t("profiler.title", "Đánh giá dữ liệu")} (Profiler)</span>
              </div>
              <MarkdownDocViewer content={currentProfilerDoc.raw} rules={rules} />
            </div>
          )}

          {activeModule === "static" && currentStaticDoc && (
            <div className="animate-fade-in-up">
              <h1 className="text-2xl md:text-3xl font-sans font-bold text-ink mb-6 pb-2 border-b border-border tracking-tight">
                {currentStaticDoc.title}
              </h1>
              <div className="space-y-6">
                {currentStaticDoc.content.map((item, i) => (
                  <div key={i}>
                    <h3 className="text-base font-semibold text-ink mb-2">{item.heading}</h3>
                    <p className="text-muted text-[14.5px] leading-relaxed break-words">{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Right TOC (On this page) - Visible on lg screens */}
        {tocHeadings.length > 0 && (
          <aside className="w-60 flex-shrink-0 px-4 py-8 sticky top-28 self-start hidden lg:block max-h-[calc(100vh-7rem)] overflow-y-auto border-l border-border/40">
            <p className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
              Mục lục trang này
            </p>
            <nav className="flex flex-col gap-1.5 text-xs">
              {tocHeadings.map((h, i) => (
                <a
                  key={i}
                  href={`#${h.id}`}
                  title={h.title}
                  className={`text-muted hover:text-forest transition-colors truncate block leading-snug ${
                    h.level === 3 ? "pl-3 text-[11.5px] border-l border-border" : "font-medium"
                  }`}
                >
                  {h.title}
                </a>
              ))}
            </nav>
          </aside>
        )}
      </div>
    </div>
  );
}
