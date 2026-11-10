/**
 * docsNavigation.js
 * Central navigation registry for DataMind documentation (Sections 1–4).
 * Used for:
 * 1. Linear Prev / Next navigation sequence across all 29 pages.
 * 2. Cross-module "Liên quan ở các bước khác" (related) lookup.
 * 3. Breadcrumb metadata resolution.
 */

export const DOCS_SECTIONS = [
  {
    id: "profiler",
    number: "1",
    name: "Profiler",
    fullName: "1. Profiler",
    overviewPath: "/docs/profiler/overview",
    topics: [
      { id: "overview", title: "Tổng quan Đánh giá dữ liệu" },
      { id: "data-types", title: "5 kiểu dữ liệu & cây quyết định" },
      { id: "column-stats", title: "Thống kê cột & Gợi ý biểu đồ" },
      { id: "attention", title: "4 lý do cột cần xem xét" },
      { id: "override", title: "Ghi đè kiểu dữ liệu & Tác động" },
      { id: "ai-context", title: "Ngữ cảnh AI & Lĩnh vực dữ liệu" },
      { id: "session", title: "Phiên làm việc & Bộ nhớ tạm" },
    ],
  },
  {
    id: "cleaner",
    number: "2",
    name: "Cleaner",
    fullName: "2. Cleaner",
    overviewPath: "/docs/cleaner/overview",
    topics: [
      { id: "overview", title: "Tổng quan Làm sạch dữ liệu" },
      { id: "issue-types", title: "5 loại vấn đề thường gặp" },
      { id: "find-errors", title: "Tìm & định vị lỗi nhanh" },
      { id: "auto-clean", title: "Tự động sửa với 1 cú click" },
      { id: "manual-clean", title: "Sửa thủ công & Không gian làm việc" },
      { id: "review-results", title: "Xem kết quả thay đổi (Diff)" },
      { id: "confirm-and-next", title: "Chốt dữ liệu & Chuyển tiếp" },
    ],
  },
  {
    id: "visualize",
    number: "3",
    name: "Visualize",
    fullName: "3. Visualize",
    overviewPath: "/docs/visualize/overview",
    topics: [
      { id: "overview", title: "Tổng quan Trực quan hóa" },
      { id: "chart-types", title: "Các loại biểu đồ" },
      { id: "reading-insights", title: "Đọc nhận xét tự động" },
      { id: "chart-settings", title: "Tùy chỉnh biểu đồ" },
      { id: "skipped-columns", title: "Cột không có biểu đồ" },
      { id: "correlation", title: "Phân tích tương quan" },
      { id: "ai-explain", title: "Giải thích bằng AI" },
      { id: "to-report", title: "Chọn biểu đồ cho báo cáo" },
    ],
  },
  {
    id: "report",
    number: "4",
    name: "Report",
    fullName: "4. Report",
    overviewPath: "/docs/report/overview",
    topics: [
      { id: "overview", title: "Tổng quan Report" },
      { id: "ai-overview", title: "Tổng quan viết bằng AI" },
      { id: "key-findings", title: "Điểm chính" },
      { id: "methodology", title: "Phương pháp & Làm sạch" },
      { id: "charts", title: "Phân tích chi tiết" },
      { id: "appendix", title: "Phụ lục: Từ điển dữ liệu" },
      { id: "export", title: "Xuất báo cáo" },
    ],
  },
];

// Linear ordered array of all 29 documentation pages across sections 1–4
export const FLAT_DOCS_LIST = [];
export const DOCS_BY_PATH = {};

DOCS_SECTIONS.forEach((section) => {
  section.topics.forEach((topic) => {
    const docPath = `${section.id}/${topic.id}`;
    const docEntry = {
      path: docPath,
      module: section.id,
      topic: topic.id,
      sectionNumber: section.number,
      sectionName: section.name,
      sectionFullName: section.fullName,
      title: topic.title,
      link: `/docs/${section.id}/${topic.id}`,
    };
    FLAT_DOCS_LIST.push(docEntry);
    DOCS_BY_PATH[docPath] = docEntry;
  });
});

/**
 * Get previous and next page entries for the current active doc.
 * Returns { prev: docEntry | null, next: docEntry | null }
 */
export function getPrevNextPages(module, topic) {
  if (!module || !topic) return { prev: null, next: null };
  const currentPath = `${module}/${topic}`;
  const currentIndex = FLAT_DOCS_LIST.findIndex((item) => item.path === currentPath);
  if (currentIndex === -1) {
    return { prev: null, next: null };
  }
  return {
    prev: currentIndex > 0 ? FLAT_DOCS_LIST[currentIndex - 1] : null,
    next: currentIndex < FLAT_DOCS_LIST.length - 1 ? FLAT_DOCS_LIST[currentIndex + 1] : null,
  };
}

/**
 * Resolve an array of related relative doc paths (e.g. ["cleaner/auto-clean", ...]).
 * Skips invalid paths silently and logs warning in development.
 */
export function resolveRelatedDocs(relatedPaths) {
  if (!Array.isArray(relatedPaths) || relatedPaths.length === 0) return [];

  const results = [];
  relatedPaths.forEach((rawPath) => {
    if (!rawPath || typeof rawPath !== "string") return;
    const cleanPath = rawPath.trim().replace(/^\//, "").replace(/\.md$/, "");
    const entry = DOCS_BY_PATH[cleanPath];
    if (entry) {
      results.push(entry);
    } else {
      if (typeof process !== "undefined" && process.env?.NODE_ENV !== "production") {
        console.warn(`[DocsNavigation] Skipping invalid related doc path: "${rawPath}"`);
      }
    }
  });

  return results;
}

