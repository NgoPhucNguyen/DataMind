import { CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BADGE } from '../../constants/ui';

export function ConfidenceBadge({ confidence }) {
  const { t } = useTranslation();
  if (!confidence) return null;
  const pct = Math.round(confidence * 100);
  if (pct >= 85) return <span className={`${BADGE.success} flex items-center gap-1`}><CheckCircle size={14} /> {t("profiler.confidence_high")}</span>;
  if (pct >= 60) return <span className={`${BADGE.warning} flex items-center gap-1`}><AlertTriangle size={14} /> {t("profiler.confidence_medium")}</span>;
  return <span className={`${BADGE.error} flex items-center gap-1`}><AlertCircle size={14} /> {t("profiler.confidence_low")}</span>;
}

export function TypeBadge({ type }) {
  const { t } = useTranslation();
  const styles = {
    numeric: BADGE.info,
    datetime: BADGE.warning,
    categorical: BADGE.success,
    multiple_choice: "px-2.5 py-1 text-xs font-medium rounded border bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]",
    text: BADGE.neutral,
  };
  const label = t(`profiler.type_${type}`, { defaultValue: type });
  return (
    <span className={`${styles[type] || styles.text}`}>
      {label}
    </span>
  );
}

