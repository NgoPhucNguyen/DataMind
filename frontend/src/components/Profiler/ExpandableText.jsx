import { useState } from "react";

export const ExpandableText = ({ text, maxLength = 40 }) => {
  const [expanded, setExpanded] = useState(false);
  if (!text || text.length <= maxLength) return <span className="break-words">{text}</span>;
  return (
    <span className="break-words">
      {expanded ? text : `${text.slice(0, maxLength)}...`}
      <button
        onClick={() => setExpanded(!expanded)}
        className="ml-1 text-[10px] text-forest hover:underline focus:outline-none font-sans"
        title={expanded ? "Thu gọn" : "Xem thêm"}
      >
        {expanded ? "Thu gọn" : "Xem thêm"}
      </button>
    </span>
  );
};
