import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useChartTheme } from "../../contexts/ChartThemeContext";
import {
  getCorrelationStrength,
  getMatrixCellStyle,
  hexToRgb,
} from "./CorrelationView";
import { getCorrTableCaption } from "../../utils/reportNumbering";

function formatR(val, locale = "vi-VN") {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return Number(val).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatThreshold(val, locale = "vi-VN") {
  return Number(val).toLocaleString(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function truncateAtWordBoundary(str = "", maxChars = 40) {
  if (!str) return "";
  const trimmed = str.trim();
  if (trimmed.length <= maxChars) return trimmed;
  const cut = trimmed.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  if (lastSpace > 15) {
    return cut.slice(0, lastSpace) + "…";
  }
  return cut + "…";
}

/**
 * CorrelationReportView - Chế độ xem tương quan tĩnh (read-only) dành riêng cho Báo cáo (Report).
 * Không có thanh công cụ, không tìm kiếm, không thanh cuộn, không nút bấm tương tác.
 */
export default function CorrelationReportView({ chart = {}, summary = {}, settings = {}, tableNumber = 1 }) {
  const { t, i18n } = useTranslation();
  const theme = useChartTheme();

  const currentLang = i18n?.language?.startsWith("en") ? "en" : "vi";
  const locale = currentLang === "en" ? "en-US" : "vi-VN";

  const corrV2 = chart?.correlation_v2 || summary?.correlation_v2;

  // Resolve method and threshold from settings or fallback defaults
  const method = settings?.method || chart?.settings?.method || corrV2?.default_method || "spearman";
  const threshold = settings?.threshold ?? chart?.settings?.threshold ?? 0.5;

  const methodName = method === "pearson" ? "Pearson" : "Spearman";
  const formattedThreshold = formatThreshold(threshold, locale);

  // Column mapping
  const colMap = useMemo(() => {
    const map = new Map();
    (corrV2?.columns || []).forEach((c) => map.set(c.name, c));
    return map;
  }, [corrV2?.columns]);

  // Pairs map for fast lookup
  const pairsMap = useMemo(() => {
    const map = new Map();
    (corrV2?.pairs || []).forEach((p) => {
      map.set(`${p.a}_${p.b}`, p);
    });
    return map;
  }, [corrV2?.pairs]);

  // All pairs matching threshold
  const matchingPairs = useMemo(() => {
    if (!corrV2?.pairs) return [];
    return corrV2.pairs
      .filter((p) => {
        const r = p[method];
        return r !== null && r !== undefined && !isNaN(r) && Math.abs(r) >= threshold;
      })
      .sort((p1, p2) => Math.abs(p2[method]) - Math.abs(p1[method]));
  }, [corrV2?.pairs, method, threshold]);

  // Max 8 rows for report table
  const tablePairs = useMemo(() => {
    return matchingPairs.slice(0, 8);
  }, [matchingPairs]);

  // Summary sentence values
  const band = getCorrelationStrength(threshold, currentLang).toLowerCase();
  const strongest = matchingPairs[0] || null;
  const strongestColA = strongest ? colMap.get(strongest.a) || { name: strongest.a, letter: strongest.a } : null;
  const strongestColB = strongest ? colMap.get(strongest.b) || { name: strongest.b, letter: strongest.b } : null;
  const strongestR = strongest ? formatR(strongest[method], locale) : null;

  // Columns appearing in tablePairs (max 12 columns)
  const matrixCols = useMemo(() => {
    if (!corrV2?.columns || tablePairs.length === 0) return [];
    const activeNames = new Set();
    tablePairs.forEach((p) => {
      activeNames.add(p.a);
      activeNames.add(p.b);
    });
    return corrV2.columns.filter((c) => activeNames.has(c.name)).slice(0, 12);
  }, [corrV2?.columns, tablePairs]);

  // If no correlation_v2 data
  if (!corrV2 || !corrV2.columns || corrV2.columns.length < 2) {
    const legacyMatrix = chart.matrix || summary?.correlation_matrix;
    if (!legacyMatrix || Object.keys(legacyMatrix).length === 0) {
      return (
        <p className="text-xs text-[#626C65] italic py-3">
          {summary?.correlation_error || t("visualize.heatmap_insufficient")}
        </p>
      );
    }
  }

  return (
    <div className="w-full space-y-4 text-[#121A14]">
      {/* a) Caption line + Summary sentence */}
      <div className="report-corr-header space-y-1.5">
        <p className="text-xs text-[#626C65] font-medium">
          {t("report.corr_caption", {
            method: methodName,
            threshold: formattedThreshold,
            count: matchingPairs.length,
            defaultValue: currentLang === "en"
              ? `Method: ${methodName} · Threshold |r| ≥ ${formattedThreshold} · ${matchingPairs.length} pairs`
              : `Phương pháp: ${methodName} · Ngưỡng |r| ≥ ${formattedThreshold} · ${matchingPairs.length} cặp`,
          })}
        </p>

        {matchingPairs.length > 0 && strongest && (
          <p className="text-xs text-[#2A342D] leading-relaxed">
            {t("report.corr_summary_sentence", {
              n: matchingPairs.length,
              band: band,
              method: methodName,
              t: formattedThreshold,
              a: strongestColA.letter || strongestColA.name,
              b: strongestColB.letter || strongestColB.name,
              r: strongestR,
              defaultValue: currentLang === "en"
                ? `${matchingPairs.length} column pairs are related at ${band} level or above (${methodName}, |r| ≥ ${formattedThreshold}). Strongest: [${strongestColA.letter || strongestColA.name}] ↔ [${strongestColB.letter || strongestColB.name}] (r = ${strongestR}).`
                : `Có ${matchingPairs.length} cặp cột liên quan từ mức ${band} trở lên (${methodName}, |r| ≥ ${formattedThreshold}). Mạnh nhất: [${strongestColA.letter || strongestColA.name}] ↔ [${strongestColB.letter || strongestColB.name}] (r = ${strongestR}).`
            })}
          </p>
        )}
      </div>

      {/* b) Pairs table (max 8 rows, strongest first) */}
      {tablePairs.length === 0 ? (
        <div className="p-3 bg-[#F9F9F8] border border-[#E5E5E3] rounded-lg">
          <p className="text-xs text-[#626C65] italic">
            {t("report.corr_no_pairs", {
              t: formattedThreshold,
              defaultValue: currentLang === "en"
                ? `No pairs with |r| ≥ ${formattedThreshold}.`
                : `Không có cặp nào có |r| ≥ ${formattedThreshold}.`,
            })}
          </p>
        </div>
      ) : (
        <div className="report-corr-pairs-block">
          <p className="text-xs font-semibold text-[#121A14] mb-2 report-table-caption">
            {t("report.corr_pairs_table_caption", {
              m: tableNumber,
              defaultValue: getCorrTableCaption(tableNumber, currentLang),
            })}
          </p>
          <div className="border border-[#E5E5E3] rounded-lg overflow-hidden bg-white report-corr-table-wrap">
            <table className="w-full text-xs border-collapse report-corr-table">
              <thead>
                <tr className="bg-[#F9F9F8] border-b border-[#EAEAEA] text-[#626C65]">
                  <th className="py-2 px-3 text-left font-semibold">
                    {t("report.corr_th_col_pair", "Cặp cột")}
                  </th>
                  <th className="py-2 px-3 text-center font-semibold w-20">
                    {t("report.corr_th_r", "r")}
                  </th>
                  <th className="py-2 px-3 text-center font-semibold w-40">
                    {t("report.corr_th_strength", "Mức độ")}
                  </th>
                  <th className="py-2 px-3 text-center font-semibold w-16">
                    {t("report.corr_th_n", "n")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAEAEA]">
                {tablePairs.map((p) => {
                  const colA = colMap.get(p.a) || { name: p.a, letter: "A" };
                  const colB = colMap.get(p.b) || { name: p.b, letter: "B" };
                  const rVal = p[method];
                  const absR = rVal !== null ? Math.abs(rVal) : 0;
                  const isPositive = rVal !== null && rVal >= 0;
                  const strengthText = getCorrelationStrength(absR, currentLang);
                  const directionWord = isPositive
                    ? (currentLang === "en" ? "positive" : "cùng chiều")
                    : (currentLang === "en" ? "negative" : "ngược chiều");

                  return (
                    <tr key={`${p.a}_${p.b}`} className="hover:bg-[#F9F9F8]/60 transition-colors">
                      {/* Pair cell on ONE line: "[AK] <short name> ↔ [BE] <short name>" */}
                      <td
                        className="py-1.5 px-3 whitespace-nowrap overflow-hidden text-ellipsis max-w-[340px]"
                        title={`[${colA.letter}] ${colA.name} ↔ [${colB.letter}] ${colB.name}`}
                      >
                        <span className="font-mono font-semibold text-[#1B4324]">[{colA.letter}]</span>{" "}
                        <span className="font-normal text-[#121A14]">{truncateAtWordBoundary(colA.name, 40)}</span>
                        <span className="text-[#8C948D] mx-1.5">↔</span>
                        <span className="font-mono font-semibold text-[#1B4324]">[{colB.letter}]</span>{" "}
                        <span className="font-normal text-[#121A14]">{truncateAtWordBoundary(colB.name, 40)}</span>
                      </td>

                      {/* r value */}
                      <td
                        className="py-1.5 px-3 text-center font-mono font-semibold tabular-nums"
                        style={{
                          color: rVal !== null && rVal < 0 ? theme.negative : theme.primary,
                        }}
                      >
                        {formatR(rVal, locale)}
                      </td>

                      {/* Merged Mức độ column */}
                      <td className="py-1.5 px-3 text-center whitespace-nowrap">
                        <span className="text-[#626C65]">{strengthText} · </span>
                        <span
                          style={{ color: isPositive ? theme.primary : theme.negative }}
                          className="font-medium"
                        >
                          {directionWord}
                        </span>
                      </td>

                      {/* n */}
                      <td className="py-1.5 px-3 text-center font-mono text-[#626C65] tabular-nums">
                        {p.n}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Muted line under table if more pairs exist */}
          {matchingPairs.length > 8 && (
            <p className="text-[11px] text-[#626C65] mt-1.5 italic report-corr-pairs-note">
              {t("report.corr_showing_top_pairs", {
                n: matchingPairs.length,
                defaultValue: currentLang === "en"
                  ? `Showing top 8/${matchingPairs.length} strongest pairs. View all in Visualize step.`
                  : `Hiển thị 8/${matchingPairs.length} cặp mạnh nhất. Xem đầy đủ ở bước Visualize.`
              })}
            </p>
          )}
        </div>
      )}

      {/* c) Compact matrix (Only columns in the table, max 12, no sticky/scroll) */}
      {matrixCols.length >= 2 && (
        <div className="report-corr-matrix-block pt-2">
          <div className="border border-[#E5E5E3] rounded-lg overflow-hidden bg-white">
            <table className="w-full text-xs border-collapse table-fixed">
              <thead>
                <tr>
                  <th className="bg-[#F9F9F8] border border-[#EAEAEA] p-1.5 w-10 h-9"></th>
                  {matrixCols.map((c) => (
                    <th
                      key={c.name}
                      className="bg-[#F9F9F8] border border-[#EAEAEA] p-1 text-center font-semibold text-[#121A14] h-9"
                      title={c.name}
                    >
                      {c.letter}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrixCols.map((rowCol) => (
                  <tr key={rowCol.name}>
                    <th
                      className="bg-[#F9F9F8] border border-[#EAEAEA] p-1 text-center font-semibold text-[#121A14] w-10 h-9"
                      title={rowCol.name}
                    >
                      {rowCol.letter}
                    </th>
                    {matrixCols.map((colCol) => {
                      if (rowCol.name === colCol.name) {
                        return (
                          <td
                            key={colCol.name}
                            className="border border-[#EAEAEA] bg-[#EAEAEA] text-center text-[#8C948D] h-9 font-mono"
                          >
                            —
                          </td>
                        );
                      }

                      const pair =
                        pairsMap.get(`${rowCol.name}_${colCol.name}`) ||
                        pairsMap.get(`${colCol.name}_${rowCol.name}`);
                      const rVal = pair ? pair[method] : null;

                      if (rVal === null || rVal === undefined || isNaN(rVal)) {
                        return (
                          <td
                            key={colCol.name}
                            className="border border-[#EAEAEA] bg-[#F5F5F4] text-center text-[#8C948D] h-9 font-mono"
                          >
                            –
                          </td>
                        );
                      }

                      const cellStyle = getMatrixCellStyle(rVal, threshold, theme);
                      return (
                        <td
                          key={colCol.name}
                          style={{
                            backgroundColor: cellStyle.backgroundColor,
                            color: cellStyle.color,
                            opacity: cellStyle.opacity,
                          }}
                          className={`border border-[#EAEAEA] text-center font-mono h-9 ${
                            cellStyle.fontWeight === 600 ? "font-semibold" : "font-medium"
                          }`}
                          title={`[${rowCol.letter}] ${rowCol.name} ↔ [${colCol.letter}] ${colCol.name}: r = ${formatR(rVal, locale)}`}
                        >
                          {formatR(rVal, locale)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-3 text-[11px] text-[#626C65]">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs font-mono" style={{ color: theme.negative }}>
                  -1
                </span>
                <div
                  className="w-36 h-2.5 rounded-full"
                  style={{
                    background: `linear-gradient(to right, ${theme.negative} 0%, ${theme.neutral} 50%, ${theme.primary} 100%)`,
                  }}
                />
                <span className="font-semibold text-xs font-mono" style={{ color: theme.primary }}>
                  +1
                </span>
              </div>
              <div className="flex items-center justify-between w-full text-[10px] text-[#8C948D] px-0.5">
                <span>{t("visualize.corr_direction_negative")}</span>
                <span className="font-mono text-[#626C65] font-semibold">0</span>
                <span>{t("visualize.corr_direction_positive")}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span>&lt; 0,3 {t("visualize.corr_strength_weak")}</span>
              <span>·</span>
              <span>0,3–0,5 {t("visualize.corr_strength_moderate")}</span>
              <span>·</span>
              <span>0,5–0,7 {t("visualize.corr_strength_fairly_strong")}</span>
              <span>·</span>
              <span>≥ 0,7 {t("visualize.corr_strength_strong")}</span>
            </div>
          </div>
        </div>
      )}

      {/* d) Letter key under the matrix */}
      {matrixCols.length > 0 && (
        <div className="report-corr-letter-key pt-2 text-xs text-[#626C65] space-y-1">
          <p className="report-corr-letter-key-title font-semibold text-[#121A14] text-[11px] uppercase tracking-wider mb-1.5">
            {t("report.corr_letter_key_title", "Ký hiệu cột:")}
          </p>
          <div className="report-corr-letter-key-grid grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
            {matrixCols.map((c) => (
              <div key={c.name} className="report-corr-letter-item flex items-baseline gap-2">
                <span className="font-mono font-semibold text-[#121A14] shrink-0 w-8">
                  [{c.letter}]
                </span>
                <span className="text-[#2A342D] break-words">
                  — {c.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* e) Causation note */}
      <p className="text-xs text-[#8C948D] italic pt-1">
        {t("visualize.corr_causation_note")}
      </p>
    </div>
  );
}

