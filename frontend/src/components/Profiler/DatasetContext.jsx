import { useTranslation } from "react-i18next";
import { CARD, TEXT } from "../../constants/ui";

export const DatasetContext = ({
  contextDescription,
  setContextDescription,
  contextPurpose,
  setContextPurpose
}) => {
  const { t } = useTranslation();

  const purposeOptions = [
    { value: "Tìm xu hướng chung", key: "purpose_trends" },
    { value: "So sánh các nhóm", key: "purpose_compare" },
    { value: "Phát hiện vấn đề", key: "purpose_issues" },
    { value: "Báo cáo định kỳ", key: "purpose_report" },
  ];

  return (
    <div className={CARD}>
      <h3 className={TEXT.sectionTitle}>{t("profiler.description_label")}</h3>
      <p className={`${TEXT.secondary} mb-4 mt-1`}>
        {t("profiler.help_content")}
      </p>
      <textarea
        className="w-full border border-border rounded-lg p-3 text-sm focus:ring-1 focus:ring-[#1B4324] outline-none mb-4"
        placeholder={t("profiler.description_placeholder")}
        value={contextDescription}
        onChange={e => setContextDescription(e.target.value)}
        rows={3}
      />
      <div className="flex flex-wrap gap-3 mb-6">
        {purposeOptions.map(({ value: opt, key: optKey }) => (
          <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer border border-border px-3 py-1.5 rounded-lg hover:bg-sage/10 transition-colors">
            <input type="radio" name="purpose" value={opt}
              checked={contextPurpose === opt}
              onChange={() => setContextPurpose(opt)}
              className="accent-[#1B4324]"
            />
            {t(`profiler.${optKey}`)}
          </label>
        ))}
      </div>
    </div>
  );
};

