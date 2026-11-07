import React, { useState, useRef, useEffect } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TYPE_CONFIG } from '../../constants/dataTypes';

/**
 * Normalize confidence to a 0–100 percentage.
 * Handles both 0.0–1.0 (float) and 0–100 (integer/float).
 */
export function normalizeConfidence(confidence) {
  if (confidence === null || confidence === undefined || isNaN(confidence)) return 0;
  const num = Number(confidence);
  if (num <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(num <= 1.0 ? num * 100 : num)));
}

export function ConfidenceBadge({ confidence }) {
  const { t } = useTranslation();
  const [showPopover, setShowPopover] = useState(false);
  const popoverRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setShowPopover(false);
      }
    }
    if (showPopover) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showPopover]);

  if (confidence === null || confidence === undefined) return null;
  const pct = normalizeConfidence(confidence);

  let bandColor = "bg-[#FDEBEC] text-[#9F2F2D] border-[#F5C6CB]";
  let Icon = AlertCircle;
  let iconColor = "text-[#DC2626]";

  if (pct >= 85) {
    bandColor = "bg-[#EAF2EB] text-[#1B4324] border-[#C8E0CB]";
    Icon = CheckCircle2;
    iconColor = "text-[#2D6A4F]";
  } else if (pct >= 60) {
    bandColor = "bg-[#FEF6E6] text-[#854D0E] border-[#FDE68A]";
    Icon = AlertTriangle;
    iconColor = "text-[#D97706]";
  }

  const labelText = t("profiler.confidence_self_assessed", {
    pct,
    defaultValue: `Độ tin cậy AI tự đánh giá: ${pct}%`,
  });

  return (
    <div className="relative inline-flex items-center" ref={popoverRef}>
      <span
        title={labelText}
        aria-label={labelText}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${bandColor}`}
      >
        <Icon size={13} className={iconColor} aria-hidden="true" />
        <span>{labelText}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowPopover((prev) => !prev);
          }}
          className="p-0.5 hover:opacity-80 rounded-full cursor-pointer focus:outline-none"
          title={t("common.help_btn", { defaultValue: "Thông tin" })}
          aria-label={t("common.help_btn", { defaultValue: "Thông tin" })}
        >
          <Info size={12} className="opacity-75 hover:opacity-100" />
        </button>
      </span>

      {showPopover && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-72 sm:w-80 p-3 bg-white text-ink border border-border rounded-xl shadow-xl text-xs leading-relaxed animate-in fade-in zoom-in-95 duration-100">
          <p className="text-gray-700 mb-2">
            {t("profiler.confidence_popover_desc", {
              defaultValue:
                "Đây là mức độ chắc chắn do AI tự ước lượng, dựa trên tên cột và vài giá trị mẫu — không phải độ chính xác đã được kiểm chứng. AI có thể sai kể cả khi con số cao. Hãy đọc lại mô tả và sửa nếu chưa đúng; bạn có thể bấm 'Phân tích lại' sau khi sửa.",
            })}
          </p>
          <div className="border-t border-border/70 my-2" />
          <div className="space-y-1 text-[11px] text-gray-600">
            <div>
              {t("profiler.confidence_band_high_desc", {
                defaultValue: "• ≥ 85%: Cao — AI khá chắc chắn về cấu trúc dữ liệu.",
              })}
            </div>
            <div>
              {t("profiler.confidence_band_medium_desc", {
                defaultValue: "• 60–84%: Nên kiểm tra lại — Cần xem xét kỹ tên và kiểu cột.",
              })}
            </div>
            <div>
              {t("profiler.confidence_band_low_desc", {
                defaultValue: "• < 60%: Chỉ để tham khảo — Dữ liệu lạ hoặc ít mẫu, cần bổ sung mô tả.",
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Neutral badge with dark ink outline rounded square icon.
 * Contrast safe (ink #1B4324 on #F4F4F3, text #242424).
 */
export function TypeBadge({ type }) {
  const { t } = useTranslation();
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.text;
  const label = t(config.labelKey);

  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border bg-[#F4F4F3] border-[#E5E5E3] text-[#242424]"
      title={label}
      aria-label={label}
    >
      <span className="font-mono text-sm leading-none text-[#1B4324] font-semibold" aria-hidden="true">
        {config.outlineIcon}
      </span>
      <span>{label}</span>
    </span>
  );
}
