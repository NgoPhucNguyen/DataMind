import { CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { TYPE_CONFIG } from '../../constants/dataTypes';

export function ConfidenceBadge({ confidence }) {
  const { t } = useTranslation();
  if (!confidence) return null;
  const pct = Math.round(confidence * 100);

  if (pct >= 85) {
    return (
      <span
        title={t("profiler.confidence_high")}
        aria-label={t("profiler.confidence_high")}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#EAF2EB] text-[#1B4324] border border-[#C8E0CB]"
      >
        <CheckCircle2 size={13} className="text-[#2D6A4F]" aria-hidden="true" />
        <span>{t("profiler.confidence_high")}</span>
      </span>
    );
  }
  if (pct >= 60) {
    return (
      <span
        title={t("profiler.confidence_medium")}
        aria-label={t("profiler.confidence_medium")}
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#FEF6E6] text-[#854D0E] border border-[#FDE68A]"
      >
        <AlertTriangle size={13} className="text-[#D97706]" aria-hidden="true" />
        <span>{t("profiler.confidence_medium")}</span>
      </span>
    );
  }
  return (
    <span
      title={t("profiler.confidence_low")}
      aria-label={t("profiler.confidence_low")}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#FDEBEC] text-[#9F2F2D] border border-[#F5C6CB]"
    >
      <AlertCircle size={13} className="text-[#DC2626]" aria-hidden="true" />
      <span>{t("profiler.confidence_low")}</span>
    </span>
  );
}

/**
 * Neutral badge with dark ink outline rounded square icon.
 * Contrast safe (ink #1B4324 on #F4F4F3, text #242424).
 */
export function TypeBadge({ type }) {
  const { t } = useTranslation();
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.text;
  const IconComp = cfg.icon;
  const label = t(cfg.i18nKey, { defaultValue: type });

  return (
    <span
      title={label}
      aria-label={label}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-[#F4F4F3] text-[#242424] border border-[#E5E5E3]"
    >
      <span
        aria-hidden="true"
        className="flex items-center justify-center w-4 h-4 rounded border border-[#1B4324]/30 bg-white text-[#1B4324]"
      >
        <IconComp size={10} strokeWidth={2.2} />
      </span>
      <span>{label}</span>
    </span>
  );
}
