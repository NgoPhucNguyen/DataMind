import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, CornerDownRight, CheckCircle2 } from "lucide-react";

/**
 * ModuleFlowBlock
 * Renders the compact 3-part step flow: [Bước trước] → [Bước này] → [Bước sau]
 * Step names are clickable to navigate to their section overview.
 */
export default function ModuleFlowBlock({ content = "", activeModule = "profiler" }) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Parse lines for `nhan:` (input) and `chuyen:` (output) bullets
  const lines = (content || "").split(/\r?\n/);
  const nhanBullets = [];
  const chuyenBullets = [];
  let currentTarget = null;
  let customPrev = null;
  let customCurr = null;
  let customNext = null;

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    if (trimmed.startsWith("buoc_truoc:")) {
      customPrev = trimmed.slice("buoc_truoc:".length).trim();
      return;
    }
    if (trimmed.startsWith("buoc_nay:") || trimmed.startsWith("buoc_hien_tai:")) {
      customCurr = trimmed.slice(trimmed.indexOf(":") + 1).trim();
      return;
    }
    if (trimmed.startsWith("buoc_sau:")) {
      customNext = trimmed.slice("buoc_sau:".length).trim();
      return;
    }

    if (trimmed.startsWith("nhan:")) {
      currentTarget = "nhan";
      const inline = trimmed.slice("nhan:".length).trim();
      if (inline) nhanBullets.push(inline.replace(/^[-*]\s*/, ""));
      return;
    }

    if (trimmed.startsWith("chuyen:")) {
      currentTarget = "chuyen";
      const inline = trimmed.slice("chuyen:".length).trim();
      if (inline) chuyenBullets.push(inline.replace(/^[-*]\s*/, ""));
      return;
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const item = trimmed.slice(2).trim();
      if (currentTarget === "nhan") {
        nhanBullets.push(item);
      } else if (currentTarget === "chuyen") {
        chuyenBullets.push(item);
      }
    }
  });

  // Module configuration defaults
  const MODULE_DEFAULTS = {
    profiler: {
      prev: {
        label: t("docs.flow_step_prev", "Bước trước"),
        title: customPrev || "Tải lên tệp dữ liệu",
        path: null,
        bullets: nhanBullets.length > 0 ? nhanBullets : ["Tệp bảng tính CSV / Excel từ người dùng", "Kiểm tra tính hợp lệ cơ bản"],
      },
      current: {
        label: t("docs.flow_step_curr", "Bước này"),
        title: customCurr || "1. Profiler",
        path: "/docs/profiler/overview",
        bullets: [
          "Quét cấu trúc & 5 kiểu dữ liệu",
          "Thống kê chất lượng & cờ chú ý",
          "Nhập bối cảnh AI cho bộ dữ liệu",
        ],
      },
      next: {
        label: t("docs.flow_step_next", "Bước sau"),
        title: customNext || "2. Cleaner",
        path: "/docs/cleaner/overview",
        bullets: chuyenBullets.length > 0 ? chuyenBullets : ["Cấu trúc cột & kiểu dữ liệu xác nhận", "Danh sách cột lỗi cần xử lý"],
      },
    },
    cleaner: {
      prev: {
        label: t("docs.flow_step_prev", "Bước trước"),
        title: customPrev || "1. Profiler",
        path: "/docs/profiler/overview",
        bullets: nhanBullets.length > 0 ? nhanBullets : ["Kiểu dữ liệu 5 loại đã xác nhận", "Cột cần chú ý & tỷ lệ ô khuyết"],
      },
      current: {
        label: t("docs.flow_step_curr", "Bước này"),
        title: customCurr || "2. Cleaner",
        path: "/docs/cleaner/overview",
        bullets: [
          "Tự động sửa lỗi 1 chạm hoặc thủ công",
          "Xử lý ô khuyết, trùng lặp, sai kiểu",
          "Đối chiếu diff trên 200 dòng mẫu",
        ],
      },
      next: {
        label: t("docs.flow_step_next", "Bước sau"),
        title: customNext || "3. Visualize",
        path: "/docs/visualize/overview",
        bullets: chuyenBullets.length > 0 ? chuyenBullets : ["Tập dữ liệu sạch & chuẩn hóa", "Nhật ký làm sạch sang 4. Report"],
      },
    },
    visualize: {
      prev: {
        label: t("docs.flow_step_prev", "Bước trước"),
        title: customPrev || "2. Cleaner",
        path: "/docs/cleaner/overview",
        bullets: nhanBullets.length > 0 ? nhanBullets : ["Tập dữ liệu sạch & chuẩn hóa", "Thống kê phân phối cập nhật"],
      },
      current: {
        label: t("docs.flow_step_curr", "Bước này"),
        title: customCurr || "3. Visualize",
        path: "/docs/visualize/overview",
        bullets: [
          "Vẽ biểu đồ phân phối theo kiểu cột",
          "Ma trận tương quan Pearson / Spearman",
          "Giải thích chuyên sâu bằng AI",
        ],
      },
      next: {
        label: t("docs.flow_step_next", "Bước sau"),
        title: customNext || "4. Report",
        path: "/docs/report/overview",
        bullets: chuyenBullets.length > 0 ? chuyenBullets : ["Danh sách biểu đồ đã chọn", "Tùy biến bảng màu & nhận xét AI"],
      },
    },
    report: {
      prev: {
        label: t("docs.flow_step_prev", "Bước trước"),
        title: customPrev || "3. Visualize",
        path: "/docs/visualize/overview",
        bullets: nhanBullets.length > 0 ? nhanBullets : ["Biểu đồ đã chọn & nhận xét AI", "Nhật ký làm sạch từ 2. Cleaner"],
      },
      current: {
        label: t("docs.flow_step_curr", "Bước này"),
        title: customCurr || "4. Report",
        path: "/docs/report/overview",
        bullets: [
          "Biên tập báo cáo điều hành 5 phần",
          "Trích xuất Điểm chính & Phân tích",
          "Tùy biến nội dung đưa vào file xuất",
        ],
      },
      next: {
        label: t("docs.flow_step_next", "Bước sau"),
        title: customNext || "Xuất bản",
        path: "/docs/report/export",
        bullets: chuyenBullets.length > 0 ? chuyenBullets : ["Xuất tài liệu Word (.docx) chuyên nghiệp", "Hỗ trợ xem trực tuyến hoặc in PDF"],
      },
    },
  };

  const flowConfig = MODULE_DEFAULTS[activeModule] || MODULE_DEFAULTS.profiler;

  const handleStepClick = (path) => {
    if (path) {
      navigate(path);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="my-6 p-4 md:p-5 bg-gradient-to-br from-[#FAFAF8] to-[#F5F5F0] border border-border/80 rounded-2xl shadow-2xs">
      <div className="flex items-center justify-between mb-3.5 pb-2 border-b border-border/60">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
          <CornerDownRight className="w-3.5 h-3.5 text-forest" />
          <span>{t("docs.flow_title", "Luồng dữ liệu giữa các bước")}</span>
        </span>
        <span className="text-[11px] text-muted hidden sm:inline">
          {t("docs.flow_hint", "Bấm vào tên bước để xem tài liệu chi tiết")}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 relative items-stretch">
        {/* Box 1: Bước trước */}
        <div className="bg-white/90 border border-border/70 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
          <div>
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted/80 block mb-1">
              {flowConfig.prev.label}
            </span>
            {flowConfig.prev.path ? (
              <button
                type="button"
                onClick={() => handleStepClick(flowConfig.prev.path)}
                className="text-left font-sans font-bold text-sm text-forest hover:text-forest/80 hover:underline underline-offset-2 transition-colors flex items-center gap-1 group"
              >
                <span>{flowConfig.prev.title}</span>
                <span className="text-muted group-hover:text-forest text-xs opacity-70">↗</span>
              </button>
            ) : (
              <h4 className="font-sans font-bold text-sm text-ink">{flowConfig.prev.title}</h4>
            )}
            <ul className="mt-2.5 space-y-1.5">
              {flowConfig.prev.bullets.map((b, i) => (
                <li key={i} className="text-[12px] leading-relaxed text-muted flex items-start gap-1.5">
                  <span className="text-forest/70 font-bold shrink-0 leading-tight">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Box 2: Bước này (Active / Highlighted) */}
        <div className="bg-forest/5 border-2 border-forest/30 rounded-xl p-3.5 flex flex-col justify-between shadow-xs relative">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-forest font-semibold">
                {flowConfig.current.label}
              </span>
              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-forest text-white">
                {t("docs.flow_viewing", "Đang xem")}
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleStepClick(flowConfig.current.path)}
              className="text-left font-sans font-bold text-sm text-ink hover:text-forest transition-colors"
            >
              {flowConfig.current.title}
            </button>
            <ul className="mt-2.5 space-y-1.5">
              {flowConfig.current.bullets.map((b, i) => (
                <li key={i} className="text-[12px] leading-relaxed text-ink/80 flex items-start gap-1.5 font-medium">
                  <span className="text-forest font-bold shrink-0 leading-tight">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Box 3: Bước sau */}
        <div className="bg-white/90 border border-border/70 rounded-xl p-3.5 flex flex-col justify-between shadow-2xs">
          <div>
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-muted/80 block mb-1">
              {flowConfig.next.label}
            </span>
            {flowConfig.next.path ? (
              <button
                type="button"
                onClick={() => handleStepClick(flowConfig.next.path)}
                className="text-left font-sans font-bold text-sm text-forest hover:text-forest/80 hover:underline underline-offset-2 transition-colors flex items-center gap-1 group"
              >
                <span>{flowConfig.next.title}</span>
                <span className="text-muted group-hover:text-forest text-xs opacity-70">↗</span>
              </button>
            ) : (
              <h4 className="font-sans font-bold text-sm text-ink">{flowConfig.next.title}</h4>
            )}
            <ul className="mt-2.5 space-y-1.5">
              {flowConfig.next.bullets.map((b, i) => (
                <li key={i} className="text-[12px] leading-relaxed text-muted flex items-start gap-1.5">
                  <span className="text-forest/70 font-bold shrink-0 leading-tight">•</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

