import { useState } from "react";
import { useTranslation } from "react-i18next";

export const ExpandableText = ({ text, maxLength = 40 }) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  if (!text || text.length <= maxLength) return <span className="break-words">{text}</span>;
  return (
    <span className="break-words">
      {expanded ? text : `${text.slice(0, maxLength)}...`}
      <button
        onClick={() => setExpanded(!expanded)}
        className="ml-1 text-[10px] text-forest hover:underline focus:outline-none font-sans"
        title={expanded ? t("profiler.expand_less") : t("profiler.expand_more")}
      >
        {expanded ? t("profiler.expand_less") : t("profiler.expand_more")}
      </button>
    </span>
  );
};

