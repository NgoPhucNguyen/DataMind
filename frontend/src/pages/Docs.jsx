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
  Brush,
  PenTool,
  Zap,
  AlertTriangle,
  ArrowRight,
  History,
  BarChart2,
  SlidersHorizontal,
  GitCompare,
  CheckSquare,
  EyeOff,
  FileText,
  Lightbulb,
  ListChecks,
  BarChart3,
  FileDown,
} from "lucide-react";
import api from "../services/axiosClient";
import MarkdownDocViewer from "../components/docs/MarkdownDocViewer";

// Raw markdown imports from docs/vi/visualize/
import visualizeOverviewRaw from "../docs/vi/visualize/overview.md?raw";
import visualizeChartTypesRaw from "../docs/vi/visualize/chart-types.md?raw";
import visualizeReadingInsightsRaw from "../docs/vi/visualize/reading-insights.md?raw";
import visualizeChartSettingsRaw from "../docs/vi/visualize/chart-settings.md?raw";
import visualizeSkippedColumnsRaw from "../docs/vi/visualize/skipped-columns.md?raw";
import visualizeCorrelationRaw from "../docs/vi/visualize/correlation.md?raw";
import visualizeAiExplainRaw from "../docs/vi/visualize/ai-explain.md?raw";
import visualizeToReportRaw from "../docs/vi/visualize/to-report.md?raw";

// Raw markdown imports from docs/vi/profiler/
import profilerOverviewRaw from "../docs/vi/profiler/overview.md?raw";
import profilerDataTypesRaw from "../docs/vi/profiler/data-types.md?raw";
import profilerColumnStatsRaw from "../docs/vi/profiler/column-stats.md?raw";
import profilerAttentionRaw from "../docs/vi/profiler/attention.md?raw";
import profilerOverrideRaw from "../docs/vi/profiler/override.md?raw";
import profilerAiContextRaw from "../docs/vi/profiler/ai-context.md?raw";
import profilerSessionRaw from "../docs/vi/profiler/session.md?raw";

// Raw markdown imports from docs/vi/cleaner/
import cleanerOverviewRaw from "../docs/vi/cleaner/overview.md?raw";
import cleanerIssueTypesRaw from "../docs/vi/cleaner/issue-types.md?raw";
import cleanerFindErrorsRaw from "../docs/vi/cleaner/find-errors.md?raw";
import cleanerAutoCleanRaw from "../docs/vi/cleaner/auto-clean.md?raw";
import cleanerManualCleanRaw from "../docs/vi/cleaner/manual-clean.md?raw";
import cleanerReviewResultsRaw from "../docs/vi/cleaner/review-results.md?raw";
import cleanerConfirmAndNextRaw from "../docs/vi/cleaner/confirm-and-next.md?raw";

// Raw markdown imports from docs/vi/report/
import reportOverviewRaw from "../docs/vi/report/overview.md?raw";
import reportAiOverviewRaw from "../docs/vi/report/ai-overview.md?raw";
import reportKeyFindingsRaw from "../docs/vi/report/key-findings.md?raw";
import reportMethodologyRaw from "../docs/vi/report/methodology.md?raw";
import reportChartsRaw from "../docs/vi/report/charts.md?raw";
import reportAppendixRaw from "../docs/vi/report/appendix.md?raw";
import reportExportRaw from "../docs/vi/report/export.md?raw";

// Raw markdown for changelog
import changelogRaw from "../docs/vi/changelog.md?raw";

const REPORT_DOCS = {
  overview: {
    id: "overview",
    title: "Tổng quan Report",
    raw: reportOverviewRaw,
    icon: FileText,
  },
  "ai-overview": {
    id: "ai-overview",
    title: "Tổng quan viết bằng AI",
    raw: reportAiOverviewRaw,
    icon: Sparkles,
  },
  "key-findings": {
    id: "key-findings",
    title: "Điểm chính",
    raw: reportKeyFindingsRaw,
    icon: Lightbulb,
  },
  methodology: {
    id: "methodology",
    title: "Phương pháp & Làm sạch",
    raw: reportMethodologyRaw,
    icon: ListChecks,
  },
  charts: {
    id: "charts",
    title: "Phân tích chi tiết",
    raw: reportChartsRaw,
    icon: BarChart3,
  },
  appendix: {
    id: "appendix",
    title: "Phụ lục: Từ điển dữ liệu",
    raw: reportAppendixRaw,
    icon: Database,
  },
  export: {
    id: "export",
    title: "Xuất báo cáo",
    raw: reportExportRaw,
    icon: FileDown,
  },
};

const VISUALIZE_DOCS = {
  overview: {
    id: "overview",
    title: "Tổng quan Trực quan hóa",
    raw: visualizeOverviewRaw,
    icon: BarChart2,
  },
  "chart-types": {
    id: "chart-types",
    title: "Các loại biểu đồ",
    raw: visualizeChartTypesRaw,
    icon: PieChart,
  },
  "reading-insights": {
    id: "reading-insights",
    title: "Đọc nhận xét tự động",
    raw: visualizeReadingInsightsRaw,
    icon: Sparkles,
  },
  "chart-settings": {
    id: "chart-settings",
    title: "Tùy chỉnh biểu đồ",
    raw: visualizeChartSettingsRaw,
    icon: SlidersHorizontal,
  },
  "skipped-columns": {
    id: "skipped-columns",
    title: "Cột không có biểu đồ",
    raw: visualizeSkippedColumnsRaw,
    icon: EyeOff,
  },
  correlation: {
    id: "correlation",
    title: "Phân tích tương quan",
    raw: visualizeCorrelationRaw,
    icon: GitCompare,
  },
  "ai-explain": {
    id: "ai-explain",
    title: "Giải thích bằng AI",
    raw: visualizeAiExplainRaw,
    icon: Sparkles,
  },
  "to-report": {
    id: "to-report",
    title: "Chọn biểu đồ cho báo cáo",
    raw: visualizeToReportRaw,
    icon: CheckSquare,
  },
};

const CLEANER_DOCS = {
  overview: {
    id: "overview",
    title: "Tổng quan Làm sạch dữ liệu",
    raw: cleanerOverviewRaw,
    icon: Brush,
  },
  "issue-types": {
    id: "issue-types",
    title: "5 loại vấn đề thường gặp",
    raw: cleanerIssueTypesRaw,
    icon: AlertTriangle,
  },
  "find-errors": {
    id: "find-errors",
    title: "Tìm & định vị lỗi nhanh",
    raw: cleanerFindErrorsRaw,
    icon: Search,
  },
  "auto-clean": {
    id: "auto-clean",
    title: "Tự động sửa với 1 cú click",
    raw: cleanerAutoCleanRaw,
    icon: Zap,
  },
  "manual-clean": {
    id: "manual-clean",
    title: "Sửa thủ công & Không gian làm việc",
    raw: cleanerManualCleanRaw,
    icon: PenTool,
  },
  "review-results": {
    id: "review-results",
    title: "Xem kết quả thay đổi (Diff)",
    raw: cleanerReviewResultsRaw,
    icon: Layers,
  },
  "confirm-and-next": {
    id: "confirm-and-next",
    title: "Chốt dữ liệu & Chuyển tiếp",
    raw: cleanerConfirmAndNextRaw,
    icon: ArrowRight,
  },
};

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
  const [cleanerExpanded, setCleanerExpanded] = useState(true);
  const [visualizeExpanded, setVisualizeExpanded] = useState(true);
  const [reportExpanded, setReportExpanded] = useState(true);

  // Sync route params to state
  useEffect(() => {
    document.title = t("seo.title_docs", "Tài liệu hướng dẫn — DataMind");
  }, [t, i18n.language]);

  useEffect(() => {
    if (routeModule === "profiler") {
      setActiveModule("profiler");
      setProfilerExpanded(true);
      if (routeTopic && PROFILER_DOCS[routeTopic]) {
        setActiveTopic(routeTopic);
      } else {
        setActiveTopic("overview");
      }
    } else if (routeModule === "cleaner") {
      setActiveModule("cleaner");
      setCleanerExpanded(true);
      if (routeTopic && CLEANER_DOCS[routeTopic]) {
        setActiveTopic(routeTopic);
      } else {
        setActiveTopic("overview");
      }
    } else if (routeModule === "visualize") {
      setActiveModule("visualize");
      setVisualizeExpanded(true);
      if (routeTopic && VISUALIZE_DOCS[routeTopic]) {
        setActiveTopic(routeTopic);
      } else {
        setActiveTopic("overview");
      }
    } else if (routeModule === "report") {
      setActiveModule("report");
      setReportExpanded(true);
      if (routeTopic && REPORT_DOCS[routeTopic]) {
        setActiveTopic(routeTopic);
      } else {
        setActiveTopic("overview");
      }
    } else if (routeModule === "changelog") {
      setActiveModule("changelog");
      setActiveTopic("changelog");
    } else if (routeModule) {
      setActiveModule(routeModule);
      setActiveTopic(routeTopic || "");
    } else {
      setActiveModule("profiler");
      setActiveTopic("overview");
      setProfilerExpanded(true);
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
    let rawText = "";
    if (activeModule === "report" && REPORT_DOCS[activeTopic]) {
      rawText = REPORT_DOCS[activeTopic].raw.normalize("NFC");
    } else if (activeModule === "visualize" && VISUALIZE_DOCS[activeTopic]) {
      rawText = VISUALIZE_DOCS[activeTopic].raw.normalize("NFC");
    } else if (activeModule === "cleaner" && CLEANER_DOCS[activeTopic]) {
      rawText = CLEANER_DOCS[activeTopic].raw.normalize("NFC");
    } else if (activeModule === "profiler" && PROFILER_DOCS[activeTopic]) {
      rawText = PROFILER_DOCS[activeTopic].raw.normalize("NFC");
    } else if (activeModule === "changelog") {
      rawText = changelogRaw.normalize("NFC");
    }

    if (rawText) {
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

  const handleSelectCleanerTopic = (topicKey) => {
    navigate(`/docs/cleaner/${topicKey}`);
    setMobileDrawerOpen(false);
  };

  const handleSelectProfilerTopic = (topicKey) => {
    navigate(`/docs/profiler/${topicKey}`);
    setMobileDrawerOpen(false);
  };

  const handleSelectVisualizeTopic = (topicKey) => {
    navigate(`/docs/visualize/${topicKey}`);
    setMobileDrawerOpen(false);
  };

  const handleSelectReportTopic = (topicKey) => {
    navigate(`/docs/report/${topicKey}`);
    setMobileDrawerOpen(false);
  };

  const handleSelectChangelog = () => {
    navigate(`/docs/changelog`);
    setMobileDrawerOpen(false);
  };

  const handleSelectStatic = (sectionId) => {
    setActiveModule("static");
    setActiveTopic(sectionId);
    navigate(`/docs`);
    setMobileDrawerOpen(false);
  };

  // Search filter across cleaner and profiler topic titles and headings
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const results = [];

    // Search Profiler docs
    Object.entries(PROFILER_DOCS).forEach(([topicKey, doc]) => {
      if (doc.title.toLowerCase().includes(q)) {
        results.push({
          module: "profiler",
          topic: topicKey,
          title: doc.title,
          sub: "Đánh giá dữ liệu",
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

    // Search Cleaner docs
    Object.entries(CLEANER_DOCS).forEach(([topicKey, doc]) => {
      if (doc.title.toLowerCase().includes(q)) {
        results.push({
          module: "cleaner",
          topic: topicKey,
          title: doc.title,
          sub: "Làm sạch dữ liệu",
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
              module: "cleaner",
              topic: topicKey,
              title: cleanTitle,
              sub: `Trong: ${doc.title}`,
              anchor,
            });
          }
        }
      });
    });

    // Search Visualize docs
    Object.entries(VISUALIZE_DOCS).forEach(([topicKey, doc]) => {
      if (doc.title.toLowerCase().includes(q)) {
        results.push({
          module: "visualize",
          topic: topicKey,
          title: doc.title,
          sub: "Trực quan hóa dữ liệu",
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
              module: "visualize",
              topic: topicKey,
              title: cleanTitle,
              sub: `Trong: ${doc.title}`,
              anchor,
            });
          }
        }
      });
    });

    // Search Report docs
    Object.entries(REPORT_DOCS).forEach(([topicKey, doc]) => {
      if (doc.title.toLowerCase().includes(q)) {
        results.push({
          module: "report",
          topic: topicKey,
          title: doc.title,
          sub: "Báo cáo phân tích dữ liệu",
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
              module: "report",
              topic: topicKey,
              title: cleanTitle,
              sub: `Trong: ${doc.title}`,
              anchor,
            });
          }
        }
      });
    });

    // Search Changelog
    if ("có gì mới nhật ký cập nhật changelog".includes(q)) {
      results.push({
        module: "changelog",
        topic: "",
        title: "Có gì mới (Nhật ký cập nhật)",
        sub: "Chung & Chính sách",
        anchor: "",
      });
    }

    return results.slice(0, 8);
  }, [searchQuery]);

  const currentCleanerDoc = activeModule === "cleaner" ? CLEANER_DOCS[activeTopic] || CLEANER_DOCS.overview : null;
  const currentProfilerDoc = activeModule === "profiler" ? PROFILER_DOCS[activeTopic] || PROFILER_DOCS.overview : null;
  const currentVisualizeDoc = activeModule === "visualize" ? VISUALIZE_DOCS[activeTopic] || VISUALIZE_DOCS.overview : null;
  const currentReportDoc = activeModule === "report" ? REPORT_DOCS[activeTopic] || REPORT_DOCS.overview : null;
  const currentStaticDoc = activeModule === "static" ? STATIC_SECTIONS.find((s) => s.id === activeTopic) || STATIC_SECTIONS[0] : null;

  const breadcrumbData = useMemo(() => {
    if (activeModule === "profiler" && currentProfilerDoc) {
      return {
        sectionName: "1. Profiler",
        sectionLink: "/docs/profiler/overview",
        pageTitle: currentProfilerDoc.title,
      };
    }
    if (activeModule === "cleaner" && currentCleanerDoc) {
      return {
        sectionName: "2. Cleaner",
        sectionLink: "/docs/cleaner/overview",
        pageTitle: currentCleanerDoc.title,
      };
    }
    if (activeModule === "visualize" && currentVisualizeDoc) {
      return {
        sectionName: "3. Visualize",
        sectionLink: "/docs/visualize/overview",
        pageTitle: currentVisualizeDoc.title,
      };
    }
    if (activeModule === "report" && currentReportDoc) {
      return {
        sectionName: "4. Report",
        sectionLink: "/docs/report/overview",
        pageTitle: currentReportDoc.title,
      };
    }
    if (activeModule === "changelog") {
      return {
        sectionName: "Chung & Chính sách",
        sectionLink: "/docs/changelog",
        pageTitle: "Có gì mới (Nhật ký cập nhật)",
      };
    }
    if (activeModule === "static" && currentStaticDoc) {
      return {
        sectionName: "Chung & Chính sách",
        sectionLink: "/docs",
        pageTitle: currentStaticDoc.title,
      };
    }
    return null;
  }, [activeModule, currentProfilerDoc, currentCleanerDoc, currentVisualizeDoc, currentReportDoc, currentStaticDoc]);

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
      {/* Top sticky sub-bar for search & mobile toggle */}
      <div
        className="border-b border-border bg-canvas sticky z-40 px-4 md:px-8 py-2.5 flex items-center justify-between gap-4"
        style={{ top: "var(--app-topbar-h, 0px)" }}
      >
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
            {activeModule === "profiler" && (
              <>
                <span className="text-forest font-medium">1. Profiler</span>
                <span>/</span>
                <span className="text-ink font-medium truncate max-w-[180px] sm:max-w-xs">{currentProfilerDoc?.title}</span>
              </>
            )}
            {activeModule === "cleaner" && (
              <>
                <span className="text-forest font-medium">2. Cleaner</span>
                <span>/</span>
                <span className="text-ink font-medium truncate max-w-[180px] sm:max-w-xs">{currentCleanerDoc?.title}</span>
              </>
            )}
            {activeModule === "visualize" && (
              <>
                <span className="text-forest font-medium">3. Visualize</span>
                <span>/</span>
                <span className="text-ink font-medium truncate max-w-[180px] sm:max-w-xs">{currentVisualizeDoc?.title}</span>
              </>
            )}
            {activeModule === "report" && (
              <>
                <span className="text-forest font-medium">4. Report</span>
                <span>/</span>
                <span className="text-ink font-medium truncate max-w-[180px] sm:max-w-xs">{currentReportDoc?.title}</span>
              </>
            )}
            {activeModule === "changelog" && (
              <>
                <span className="text-forest font-medium">{t("docs.section_general", "Chung & Chính sách")}</span>
                <span>/</span>
                <span className="text-ink font-medium">{t("docs.topic_changelog", "Có gì mới")}</span>
              </>
            )}
            {activeModule === "static" && (
              <>
                <span className="text-forest font-medium">{t("docs.section_general", "Chung & Chính sách")}</span>
                <span>/</span>
                <span className="text-ink font-medium truncate max-w-[180px] sm:max-w-xs">{currentStaticDoc?.title}</span>
              </>
            )}
          </div>
        </div>

        {/* Search input */}
        <div className="relative w-56 sm:w-72 md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            placeholder={t("docs.search_placeholder", "Tìm kiếm tài liệu...")}
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
                    if (res.module === "changelog") {
                      navigate(`/docs/changelog${res.anchor}`);
                    } else {
                      navigate(`/docs/${res.module}/${res.topic}${res.anchor}`);
                    }
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
          {/* Section 1: Profiler */}
          <div className="mb-6">
            <div
              className={`w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider rounded transition-colors ${
                activeModule === "profiler"
                  ? "bg-sage/70 text-forest"
                  : "text-muted hover:text-ink hover:bg-sage/30"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setProfilerExpanded(true);
                  navigate("/docs/profiler/overview");
                }}
                className="flex-1 flex items-center gap-2 px-2 py-1.5 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-forest rounded-l"
              >
                <Database className="w-3.5 h-3.5 text-forest shrink-0" />
                <span className="truncate">1. Profiler</span>
              </button>
              <div className="w-px h-3.5 bg-border/60 shrink-0" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setProfilerExpanded(!profilerExpanded);
                }}
                aria-label={profilerExpanded ? "Thu gọn 1. Profiler" : "Mở rộng 1. Profiler"}
                aria-expanded={profilerExpanded}
                className="p-1.5 text-muted hover:text-ink rounded-r focus:outline-none focus-visible:ring-1 focus-visible:ring-forest"
              >
                {profilerExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                )}
              </button>
            </div>

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

          {/* Section 2: Cleaner */}
          <div className="mb-6">
            <div
              className={`w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider rounded transition-colors ${
                activeModule === "cleaner"
                  ? "bg-sage/70 text-forest"
                  : "text-muted hover:text-ink hover:bg-sage/30"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setCleanerExpanded(true);
                  navigate("/docs/cleaner/overview");
                }}
                className="flex-1 flex items-center gap-2 px-2 py-1.5 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-forest rounded-l"
              >
                <Brush className="w-3.5 h-3.5 text-forest shrink-0" />
                <span className="truncate">2. Cleaner</span>
              </button>
              <div className="w-px h-3.5 bg-border/60 shrink-0" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setCleanerExpanded(!cleanerExpanded);
                }}
                aria-label={cleanerExpanded ? "Thu gọn 2. Cleaner" : "Mở rộng 2. Cleaner"}
                aria-expanded={cleanerExpanded}
                className="p-1.5 text-muted hover:text-ink rounded-r focus:outline-none focus-visible:ring-1 focus-visible:ring-forest"
              >
                {cleanerExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                )}
              </button>
            </div>

            {cleanerExpanded && (
              <nav className="flex flex-col gap-0.5 mt-1 pl-2">
                {Object.entries(CLEANER_DOCS).map(([key, item]) => {
                  const Icon = item.icon;
                  const isActive = activeModule === "cleaner" && activeTopic === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handleSelectCleanerTopic(key)}
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

          {/* Section 3: Visualize */}
          <div className="mb-6">
            <div
              className={`w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider rounded transition-colors ${
                activeModule === "visualize"
                  ? "bg-sage/70 text-forest"
                  : "text-muted hover:text-ink hover:bg-sage/30"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setVisualizeExpanded(true);
                  navigate("/docs/visualize/overview");
                }}
                className="flex-1 flex items-center gap-2 px-2 py-1.5 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-forest rounded-l"
              >
                <BarChart2 className="w-3.5 h-3.5 text-forest shrink-0" />
                <span className="truncate">3. Visualize</span>
              </button>
              <div className="w-px h-3.5 bg-border/60 shrink-0" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setVisualizeExpanded(!visualizeExpanded);
                }}
                aria-label={visualizeExpanded ? "Thu gọn 3. Visualize" : "Mở rộng 3. Visualize"}
                aria-expanded={visualizeExpanded}
                className="p-1.5 text-muted hover:text-ink rounded-r focus:outline-none focus-visible:ring-1 focus-visible:ring-forest"
              >
                {visualizeExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                )}
              </button>
            </div>

            {visualizeExpanded && (
              <nav className="flex flex-col gap-0.5 mt-1 pl-2">
                {Object.entries(VISUALIZE_DOCS).map(([key, item]) => {
                  const Icon = item.icon;
                  const isActive = activeModule === "visualize" && activeTopic === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handleSelectVisualizeTopic(key)}
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

          {/* Section 4: Report */}
          <div className="mb-6">
            <div
              className={`w-full flex items-center justify-between text-xs font-bold uppercase tracking-wider rounded transition-colors ${
                activeModule === "report"
                  ? "bg-sage/70 text-forest"
                  : "text-muted hover:text-ink hover:bg-sage/30"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setReportExpanded(true);
                  navigate("/docs/report/overview");
                }}
                className="flex-1 flex items-center gap-2 px-2 py-1.5 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-forest rounded-l"
              >
                <FileText className="w-3.5 h-3.5 text-forest shrink-0" />
                <span className="truncate">4. Report</span>
              </button>
              <div className="w-px h-3.5 bg-border/60 shrink-0" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setReportExpanded(!reportExpanded);
                }}
                aria-label={reportExpanded ? "Thu gọn 4. Report" : "Mở rộng 4. Report"}
                aria-expanded={reportExpanded}
                className="p-1.5 text-muted hover:text-ink rounded-r focus:outline-none focus-visible:ring-1 focus-visible:ring-forest"
              >
                {reportExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                )}
              </button>
            </div>

            {reportExpanded && (
              <nav className="flex flex-col gap-0.5 mt-1 pl-2">
                {Object.entries(REPORT_DOCS).map(([key, item]) => {
                  const Icon = item.icon;
                  const isActive = activeModule === "report" && activeTopic === key;
                  return (
                    <button
                      key={key}
                      onClick={() => handleSelectReportTopic(key)}
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
              {t("docs.section_general", "Chung & Chính sách")}
            </p>
            <nav className="flex flex-col gap-0.5 mt-1">
              <button
                onClick={handleSelectChangelog}
                title={t("docs.topic_changelog", "Có gì mới (Changelog)")}
                className={`text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-2 ${
                  activeModule === "changelog"
                    ? "bg-sage text-forest font-semibold shadow-xs"
                    : "text-muted hover:text-ink hover:bg-sage/40"
                }`}
              >
                <History className={`w-3.5 h-3.5 shrink-0 ${activeModule === "changelog" ? "text-forest" : "text-muted"}`} />
                <span className="truncate">{t("docs.topic_changelog", "Có gì mới (Changelog)")}</span>
              </button>
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
                <span className="font-bold text-sm text-ink">{t("docs.drawer_title", "Mục lục tài liệu")}</span>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1 rounded text-muted hover:text-ink"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Mobile Profiler */}
              <div className="mb-4">
                <button
                  onClick={() => {
                    navigate("/docs/profiler/overview");
                    setMobileDrawerOpen(false);
                  }}
                  className={`w-full text-left flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-2 leading-relaxed ${
                    activeModule === "profiler" ? "text-forest" : "text-muted hover:text-ink"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5" />
                    <span>1. Profiler</span>
                  </span>
                </button>
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

              {/* Mobile Cleaner */}
              <div className="mb-4">
                <button
                  onClick={() => {
                    navigate("/docs/cleaner/overview");
                    setMobileDrawerOpen(false);
                  }}
                  className={`w-full text-left flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-2 leading-relaxed ${
                    activeModule === "cleaner" ? "text-forest" : "text-muted hover:text-ink"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Brush className="w-3.5 h-3.5" />
                    <span>2. Cleaner</span>
                  </span>
                </button>
                <div className="space-y-1">
                  {Object.entries(CLEANER_DOCS).map(([key, item]) => (
                    <button
                      key={key}
                      onClick={() => handleSelectCleanerTopic(key)}
                      title={item.title}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium truncate block ${
                        activeModule === "cleaner" && activeTopic === key
                          ? "bg-sage text-forest font-semibold"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile Visualize */}
              <div className="mb-4">
                <button
                  onClick={() => {
                    navigate("/docs/visualize/overview");
                    setMobileDrawerOpen(false);
                  }}
                  className={`w-full text-left flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-2 leading-relaxed ${
                    activeModule === "visualize" ? "text-forest" : "text-muted hover:text-ink"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <BarChart2 className="w-3.5 h-3.5" />
                    <span>3. Visualize</span>
                  </span>
                </button>
                <div className="space-y-1">
                  {Object.entries(VISUALIZE_DOCS).map(([key, item]) => (
                    <button
                      key={key}
                      onClick={() => handleSelectVisualizeTopic(key)}
                      title={item.title}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium truncate block ${
                        activeModule === "visualize" && activeTopic === key
                          ? "bg-sage text-forest font-semibold"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile Report */}
              <div className="mb-4">
                <button
                  onClick={() => {
                    navigate("/docs/report/overview");
                    setMobileDrawerOpen(false);
                  }}
                  className={`w-full text-left flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-2 leading-relaxed ${
                    activeModule === "report" ? "text-forest" : "text-muted hover:text-ink"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    <span>4. Report</span>
                  </span>
                </button>
                <div className="space-y-1">
                  {Object.entries(REPORT_DOCS).map(([key, item]) => (
                    <button
                      key={key}
                      onClick={() => handleSelectReportTopic(key)}
                      title={item.title}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium truncate block ${
                        activeModule === "report" && activeTopic === key
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
                  <button
                    onClick={handleSelectChangelog}
                    title="Có gì mới (Nhật ký cập nhật)"
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium truncate block ${
                      activeModule === "changelog"
                        ? "bg-sage text-forest font-semibold"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    Có gì mới (Changelog)
                  </button>
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
              <span>{t("docs.notice_vi_only", "Documentation is currently available in Vietnamese only.")}</span>
            </div>
          )}

          {/* Top Breadcrumb: Tài liệu › [Section Number. Section Name] › [Page Title] */}
          {breadcrumbData && (
            <nav aria-label="Breadcrumb" className="mb-4 flex items-center flex-wrap gap-1.5 text-xs text-muted">
              <button
                type="button"
                onClick={() => {
                  navigate("/docs");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="hover:text-forest transition-colors font-medium cursor-pointer"
              >
                {t("docs.breadcrumb_root", "Tài liệu")}
              </button>
              <span className="text-muted/40 select-none">›</span>
              {breadcrumbData.sectionLink ? (
                <button
                  type="button"
                  onClick={() => {
                    navigate(breadcrumbData.sectionLink);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="hover:text-forest transition-colors font-medium cursor-pointer"
                >
                  {breadcrumbData.sectionName}
                </button>
              ) : (
                <span className="font-medium text-muted">{breadcrumbData.sectionName}</span>
              )}
              <span className="text-muted/40 select-none">›</span>
              <span className="text-ink font-semibold truncate max-w-[200px] sm:max-w-xs md:max-w-md">
                {breadcrumbData.pageTitle}
              </span>
            </nav>
          )}

          {activeModule === "profiler" && currentProfilerDoc && (
            <div>
              <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-forest/10 text-forest border border-forest/20">
                <Database className="w-3.5 h-3.5 shrink-0" />
                <span>1. Profiler · {t("profiler.title", "Đánh giá dữ liệu")}</span>
              </div>
              <MarkdownDocViewer
                content={currentProfilerDoc.raw}
                rules={rules}
                activeModule={activeModule}
                activeTopic={activeTopic}
              />
            </div>
          )}

          {activeModule === "cleaner" && currentCleanerDoc && (
            <div>
              <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                <Brush className="w-3.5 h-3.5 shrink-0 text-emerald-700" />
                <span>2. Cleaner · {t("cleaner.title", "Làm sạch dữ liệu")}</span>
              </div>
              <MarkdownDocViewer
                content={currentCleanerDoc.raw}
                rules={rules}
                activeModule={activeModule}
                activeTopic={activeTopic}
              />
            </div>
          )}

          {activeModule === "visualize" && currentVisualizeDoc && (
            <div>
              <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                <BarChart2 className="w-3.5 h-3.5 shrink-0 text-emerald-700" />
                <span>3. Visualize · {t("visualize.page_title", "Trực quan hóa")}</span>
              </div>
              <MarkdownDocViewer
                content={currentVisualizeDoc.raw}
                rules={rules}
                activeModule={activeModule}
                activeTopic={activeTopic}
              />
            </div>
          )}

          {activeModule === "report" && currentReportDoc && (
            <div>
              <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-forest/10 text-forest border border-forest/20">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span>4. Report · {t("report.title_interactive", "Báo cáo Tương tác")}</span>
              </div>
              <MarkdownDocViewer
                content={currentReportDoc.raw}
                rules={rules}
                activeModule={activeModule}
                activeTopic={activeTopic}
              />
            </div>
          )}

          {activeModule === "changelog" && (
            <div>
              <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
                <History className="w-3.5 h-3.5 shrink-0 text-amber-700" />
                <span>{t("docs.changelog_badge", "Nhật ký cập nhật hệ thống")}</span>
              </div>
              <MarkdownDocViewer
                content={changelogRaw}
                rules={rules}
                activeModule="changelog"
                activeTopic="changelog"
              />
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
          <aside
            className="w-60 flex-shrink-0 px-4 py-8 sticky self-start hidden lg:block max-h-[calc(100vh-7rem)] overflow-y-auto border-l border-border/40"
            style={{ top: "calc(var(--app-topbar-h, 0px) + 3.5rem)" }}
          >
            <p className="text-xs font-bold uppercase tracking-wider text-muted mb-3">
              {t("docs.on_this_page", "Mục lục trang này")}
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
