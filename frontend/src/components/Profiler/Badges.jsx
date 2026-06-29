import { CheckCircle, AlertTriangle, AlertCircle } from 'lucide-react';
import { BADGE } from '../../constants/ui';

export function ConfidenceBadge({ confidence }) {
  if (!confidence) return null;
  const pct = Math.round(confidence * 100);
  if (pct >= 85) return <span className={`${BADGE.success} flex items-center gap-1`}><CheckCircle size={14} /> Độ tin cậy cao</span>;
  if (pct >= 60) return <span className={`${BADGE.warning} flex items-center gap-1`}><AlertTriangle size={14} /> Cần xác nhận lại</span>;
  return <span className={`${BADGE.error} flex items-center gap-1`}><AlertCircle size={14} /> Tham khảo thêm</span>;
}

const TYPE_LABELS = {
  numeric: "Số liệu",
  datetime: "Thời gian",
  categorical: "Danh mục",
  multiple_choice: "Nhiều lựa chọn",
  text: "Văn bản",
};

export function TypeBadge({ type }) {
  const styles = {
    numeric: BADGE.info,
    datetime: BADGE.warning,
    categorical: BADGE.success,
    multiple_choice: "px-2.5 py-1 text-xs font-medium rounded border bg-[#E6F4EA] text-[#137333] border-[#CEEAD6]",
    text: BADGE.neutral,
  };
  return (
    <span className={`${styles[type] || styles.text}`}>
      {TYPE_LABELS[type] || type}
    </span>
  );
}
