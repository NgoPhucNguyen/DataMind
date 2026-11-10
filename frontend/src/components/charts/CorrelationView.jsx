import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Search, X, ChevronDown, ChevronUp, AlertTriangle, Check, Info, ArrowRight, CornerDownRight, HelpCircle
} from "lucide-react";
import {
  ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer
} from "recharts";
import { CHART_THEME } from "./ChartComponents";
import { useChartTheme } from "../../contexts/ChartThemeContext";
import api from "../../services/axiosClient";

/**
 * Chuẩn hóa chuỗi hex thành mảng [r, g, b].
 */
export function hexToRgb(hex = "") {
  const clean = String(hex).replace("#", "");
  const num = parseInt(clean, 16);
  if (isNaN(num)) return [27, 67, 36];
  if (clean.length === 3) {
    const r = (num >> 8) & 0xf;
    const g = (num >> 4) & 0xf;
    const b = num & 0xf;
    return [(r << 4) | r, (g << 4) | g, (b << 4) | b];
  }
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/**
 * Chuẩn hóa chuỗi tiếng Việt để tìm kiếm không dấu (accent-insensitive).
 */
export function normalizeVietnamese(str = "") {
  return String(str)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();
}

/**
 * Trả về nhãn độ mạnh tương quan theo dải |r|.
 */
export function getCorrelationStrength(absR, lang = "vi") {
  if (absR >= 0.7) return lang === "en" ? "Strong" : "Mạnh";
  if (absR >= 0.5) return lang === "en" ? "Fairly strong" : "Khá mạnh";
  if (absR >= 0.3) return lang === "en" ? "Moderate" : "Vừa";
  return lang === "en" ? "Weak" : "Yếu";
}

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

/**
 * Trả về style diverging cho ô ma trận tương quan theo giá trị r, ngưỡng threshold và bảng màu theme.
 * - Neutral (r ≈ 0): theme.neutral (mặc định #ECEEEC light gray)
 * - Positive (r > 0): neutral -> theme.primary
 * - Negative (r < 0): neutral -> theme.negative với tint tối thiểu 20%
 * - Contrast check: chữ trắng trên nền tối (|r| >= 0.55), chữ màu âm/dương đậm trên nền sáng.
 */
export function getMatrixCellStyle(rVal, threshold = 0.5, theme = null) {
  if (rVal === null || rVal === undefined || isNaN(rVal)) {
    return {
      backgroundColor: "#F5F5F4",
      color: "#8C948D",
      fontWeight: 500,
      opacity: 1,
    };
  }

  const absR = Math.abs(rVal);
  const isBelowThreshold = absR < threshold;

  const neutralHex = theme?.neutral || "#ECEEEC";
  const primaryHex = theme?.primary || "#1B4324";
  const negativeHex = theme?.negative || "#A24936";

  const [nR, nG, nB] = hexToRgb(neutralHex);
  const [pR, pG, pB] = hexToRgb(primaryHex);
  const [negR, negG, negB] = hexToRgb(negativeHex);

  let r, g, b;
  let textColor;

  if (rVal === 0) {
    r = nR;
    g = nG;
    b = nB;
    textColor = "#626C65";
  } else if (rVal > 0) {
    // Linear mix from neutral to primary
    const t = absR;
    r = Math.round(nR + t * (pR - nR));
    g = Math.round(nG + t * (pG - nG));
    b = Math.round(nB + t * (pB - nB));

    if (absR >= 0.55 && !isBelowThreshold) {
      textColor = "#FFFFFF";
    } else {
      textColor = isBelowThreshold ? "#2A342D" : primaryHex;
    }
  } else {
    // Negative: MINIMUM 20% visible tint for any r < 0, then darker by |r|
    const t = 0.20 + 0.80 * absR;
    r = Math.round(nR + t * (negR - nR));
    g = Math.round(nG + t * (negG - nG));
    b = Math.round(nB + t * (negB - nB));

    if (absR >= 0.55 && !isBelowThreshold) {
      textColor = "#FFFFFF";
    } else {
      textColor = isBelowThreshold ? "#853222" : negativeHex;
    }
  }

  return {
    backgroundColor: `rgb(${r}, ${g}, ${b})`,
    color: textColor,
    fontWeight: isBelowThreshold ? 500 : 600,
    opacity: isBelowThreshold ? 0.45 : 1,
  };
}

/**
 * Component hiển thị Count Grid cho cặp biến rời rạc / rating-scale.
 */
export function CorrelationGrid({ gridData, colA, colB, noScroll = false }) {
  const { t } = useTranslation();
  const theme = useChartTheme();
  const [pR, pG, pB] = useMemo(() => hexToRgb(theme.primary), [theme.primary]);

  const sortedY = useMemo(() => {
    return [...(gridData.y_levels || [])].sort((a, b) => b - a);
  }, [gridData.y_levels]);

  const sortedX = useMemo(() => {
    return [...(gridData.x_levels || [])].sort((a, b) => a - b);
  }, [gridData.x_levels]);

  const maxCount = useMemo(() => {
    const counts = (gridData.grid || []).map((c) => c.count);
    return counts.length > 0 ? Math.max(...counts, 1) : 1;
  }, [gridData.grid]);

  const countMap = useMemo(() => {
    const map = new Map();
    (gridData.grid || []).forEach((c) => {
      map.set(`${c.x}_${c.y}`, c.count);
    });
    return map;
  }, [gridData.grid]);

  const letterX = gridData.letter_x || colA?.letter || "X";
  const letterY = gridData.letter_y || colB?.letter || "Y";

  return (
    <div className="w-full flex flex-col items-center">
      <div className="w-full overflow-x-auto pb-2">
        <div className="inline-flex flex-col min-w-full items-center">
          <div className="flex items-center">
            {/* Y axis title on left */}
            <div className="mr-3 flex flex-col items-center justify-center">
              <span
                className="text-xs font-semibold text-[#1B4324] bg-[#EAF2EB] px-2 py-0.5 rounded max-w-[140px] truncate"
                title={`[${letterY}] ${colB?.name || ""}`}
              >
                [{letterY}] {colB?.name || ""}
              </span>
            </div>

            {/* Grid Table */}
            <div className="border border-[#E5E5E3] rounded-lg overflow-hidden bg-white shadow-xs">
              <table className="border-collapse text-xs">
                <tbody>
                  {sortedY.map((yVal) => (
                    <tr key={yVal}>
                      <td className="px-2.5 py-2 font-mono font-medium text-[#626C65] bg-[#F9F9F8] border-r border-b border-[#EAEAEA] text-right select-none">
                        {yVal}
                      </td>
                      {sortedX.map((xVal) => {
                        const cnt = countMap.get(`${xVal}_${yVal}`) ?? 0;
                        const ratio = cnt / maxCount;
                        const opacity = 0.12 + ratio * 0.78;
                        const isZero = cnt === 0;

                        const style = isZero
                          ? { backgroundColor: "#FFFFFF", color: "#87938B" }
                          : {
                              backgroundColor: `rgba(${pR}, ${pG}, ${pB}, ${opacity.toFixed(2)})`,
                              color: ratio > 0.55 ? "#FFFFFF" : theme.primary,
                            };

                        return (
                          <td
                            key={`${xVal}_${yVal}`}
                            style={style}
                            className={`px-3 py-2 text-center border-r border-b border-[#EAEAEA] font-mono min-w-[38px] transition-colors ${
                              isZero ? "font-normal" : "font-semibold"
                            }`}
                            title={`X=${xVal}, Y=${yVal}: ${cnt} người`}
                          >
                            {cnt}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {/* X axis level labels */}
                  <tr>
                    <td className="bg-[#F9F9F8] border-r border-[#EAEAEA]"></td>
                    {sortedX.map((xVal) => (
                      <td
                        key={xVal}
                        className="px-3 py-1.5 font-mono font-medium text-[#626C65] bg-[#F9F9F8] border-r border-[#EAEAEA] text-center select-none"
                      >
                        {xVal}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* X axis title at bottom */}
          <div className="mt-2 flex items-center justify-center">
            <span
              className="text-xs font-semibold text-[#1B4324] bg-[#EAF2EB] px-2 py-0.5 rounded max-w-[240px] truncate"
              title={`[${letterX}] ${colA?.name || ""}`}
            >
              [{letterX}] {colA?.name || ""}
            </span>
          </div>
        </div>
      </div>

      {/* Caption with tooltip */}
      <p
        className="text-xs text-[#626C65] mt-2 font-mono cursor-help hover:text-[#121A14] transition-colors"
        title={t("visualize.corr_grid_caption_tooltip")}
      >
        {t("visualize.corr_grid_caption", { n: gridData.n })}
      </p>
    </div>
  );
}

/**
 * PairDetail component (Inline mở rộng khi click một cặp biến).
 */
function PairDetail({
  pair,
  colA,
  colB,
  method,
  sessionId,
  selectedChartIds,
  toggleChart,
  onShowInMatrix,
  scatterCacheRef,
}) {
  const { t, i18n } = useTranslation();
  const theme = useChartTheme();
  const currentLang = i18n?.language || "vi";
  const locale = currentLang.startsWith("en") ? "en-US" : "vi-VN";

  const [scatterData, setScatterData] = useState(() => {
    return scatterCacheRef.current?.[`${pair.a}_${pair.b}`] || null;
  });
  const [loading, setLoading] = useState(!scatterData);
  const [error, setError] = useState(null);

  const fetchScatter = useCallback(async () => {
    const cacheKey = `${pair.a}_${pair.b}`;
    if (scatterCacheRef.current?.[cacheKey]) {
      setScatterData(scatterCacheRef.current[cacheKey]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/visualize/scatter-data", {
        session_id: sessionId,
        col_x: pair.a,
        col_y: pair.b,
      });
      scatterCacheRef.current[cacheKey] = res.data;
      setScatterData(res.data);
    } catch (err) {
      console.error("Failed to load scatter data:", err);
      setError(err.response?.data?.detail || t("visualize.toast_scatter_error"));
    } finally {
      setLoading(false);
    }
  }, [pair.a, pair.b, sessionId, scatterCacheRef, t]);

  useEffect(() => {
    fetchScatter();
  }, [fetchScatter]);

  const chartId = `corr_pair_${pair.a}__${pair.b}`;
  const isSelected = selectedChartIds ? selectedChartIds.has(chartId) : false;
  const currentR = pair[method];

  const handleToggle = (e) => {
    e.stopPropagation();
    if (!toggleChart) return;
    toggleChart(chartId, {
      id: chartId,
      chart_id: chartId,
      type: "corr_pair",
      col_x: pair.a,
      col_y: pair.b,
      letter_x: colA?.letter || "A",
      letter_y: colB?.letter || "B",
      method,
      r: currentR,
      n: pair.n ?? scatterData?.n,
      payload: scatterData,
      title: `[${colA?.letter || "A"}] ${pair.a} × [${colB?.letter || "B"}] ${pair.b}`,
      user_title: `[${colA?.letter || "A"}] ${pair.a} × [${colB?.letter || "B"}] ${pair.b}`,
    });
  };

  return (
    <div className="bg-[#F9F9F8] border border-[#E5E5E3] rounded-lg p-4 my-3 shadow-xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-[#EAEAEA]">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleToggle}
            onClick={(e) => e.stopPropagation()}
            className="w-[18px] h-[18px] rounded border-[#87938B] text-[#1B4324] accent-[#1B4324] focus:ring-[#1B4324]/30 cursor-pointer shrink-0"
            aria-label={isSelected ? t("visualize.btn_added_to_report") : t("visualize.btn_add_to_report")}
            title={isSelected ? t("visualize.btn_added_to_report") : t("visualize.btn_add_to_report")}
          />
          <span className="text-xs font-semibold text-[#121A14]">
            [{colA?.letter}] {pair.a} × [{colB?.letter}] {pair.b}
          </span>
          <span
            className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-white border border-[#EAEAEA]"
            style={{
              color: currentR !== null && currentR < 0 ? theme.negative : theme.primary,
            }}
          >
            r = {formatR(currentR, locale)}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onShowInMatrix?.(pair.a, pair.b)}
          className="text-xs font-medium text-[#1B4324] hover:bg-[#EAF2EB] px-2.5 py-1 rounded border border-[#1B4324]/30 transition-colors flex items-center gap-1.5 cursor-pointer"
          title={t("visualize.corr_show_in_matrix")}
        >
          <CornerDownRight className="w-3.5 h-3.5" />
          {t("visualize.corr_show_in_matrix")}
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="w-8 h-8 rounded-full border-3 border-[#1B4324] border-t-transparent animate-spin mb-3"></div>
          <p className="text-xs text-[#626C65]">{t("visualize.scatter_loading")}</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <AlertTriangle className="w-7 h-7 text-[#9F2F2D] mb-2" strokeWidth={1.5} />
          <p className="text-xs text-[#121A14] font-medium mb-1">{error}</p>
          <button
            onClick={fetchScatter}
            className="text-xs text-[#1B4324] underline hover:opacity-80 mt-1 cursor-pointer"
          >
            {t("common.retry", "Thử lại")}
          </button>
        </div>
      )}

      {/* Content */}
      {!loading && !error && scatterData && (
        <div>
          {scatterData.mode === "grid" ? (
            <CorrelationGrid gridData={scatterData} colA={colA} colB={colB} />
          ) : (
            <div className="w-full">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 15, right: 25, bottom: 35, left: 15 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.borderGrid} />
                    <XAxis
                      dataKey="x"
                      type="number"
                      name={pair.a}
                      stroke={CHART_THEME.tickColor}
                      tick={{ fill: CHART_THEME.tickColor, fontFamily: CHART_THEME.fontFamily }}
                      fontSize={10}
                      label={{
                        value: `[${colA?.letter}] ${pair.a}`,
                        position: "insideBottomRight",
                        offset: -5,
                        fill: CHART_THEME.tickColor,
                        fontSize: 11,
                        fontFamily: CHART_THEME.fontFamily,
                      }}
                    />
                    <YAxis
                      dataKey="y"
                      type="number"
                      name={pair.b}
                      stroke={CHART_THEME.tickColor}
                      tick={{ fill: CHART_THEME.tickColor, fontFamily: CHART_THEME.fontFamily }}
                      fontSize={10}
                      label={{
                        value: `[${colB?.letter}] ${pair.b}`,
                        position: "insideTopLeft",
                        offset: -5,
                        fill: CHART_THEME.tickColor,
                        fontSize: 11,
                        angle: -90,
                        fontFamily: CHART_THEME.fontFamily,
                      }}
                    />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3", stroke: CHART_THEME.tickColor }}
                      contentStyle={{
                        backgroundColor: "#ffffff",
                        border: `1px solid ${CHART_THEME.borderGrid}`,
                        borderRadius: 8,
                        color: CHART_THEME.textDark,
                        fontSize: 12,
                        fontFamily: CHART_THEME.fontFamily,
                      }}
                      wrapperStyle={{ zIndex: 1000, fontFamily: CHART_THEME.fontFamily }}
                      formatter={(value, name) => [
                        typeof value === "number" ? value.toFixed(2) : value,
                        name === "x" ? pair.a : pair.b,
                      ]}
                    />
                    <Scatter
                      data={scatterData.points}
                      fill={theme.primary}
                      fillOpacity={0.6}
                      r={3.5}
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {scatterData.count < scatterData.total && (
                <p className="text-xs text-[#626C65] mt-2 text-center">
                  {t("visualize.scatter_downsample", {
                    count: scatterData.count,
                    total: scatterData.total,
                  })}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Full Correlation Matrix Component (Có số, mở mặc định, hỗ trợ highlight dòng/cột từ tìm kiếm).
 */
function FullCorrelationMatrix({
  columns,
  pairsMap,
  method,
  threshold,
  droppedColumns,
  matrixContainerRef,
  highlightState,
  onSelectPair,
  isExpanded,
  onToggleExpand,
}) {
  const { t, i18n } = useTranslation();
  const theme = useChartTheme();
  const currentLang = i18n?.language || "vi";
  const locale = currentLang.startsWith("en") ? "en-US" : "vi-VN";

  return (
    <div className="w-full mt-4 pt-4 border-t border-[#E5E5E3]">
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between type-card-title text-[#121A14] hover:text-[#1B4324] py-2 transition-colors cursor-pointer"
      >
        <span>
          {isExpanded
            ? t("visualize.corr_matrix_toggle_collapse")
            : t("visualize.corr_matrix_toggle_expand")}
        </span>
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {isExpanded && (
        <div className="mt-3">
          {/* Scrollable Matrix Table */}
          <div
            ref={matrixContainerRef}
            className="overflow-auto max-h-[460px] border border-[#E5E5E3] rounded-lg bg-white relative shadow-xs"
          >
            <table className="border-collapse text-xs select-none">
              <thead>
                <tr>
                  <th className="sticky top-0 left-0 z-30 bg-[#F9F9F8] border border-[#EAEAEA] p-2 min-w-[200px] max-w-[220px] h-[38px]"></th>
                  {columns.map((c) => {
                    const isColBandActive =
                      highlightState?.type === "column" && highlightState.colName === c.name;
                    const isColCellActive =
                      highlightState?.type === "cell" &&
                      (highlightState.colA === c.name || highlightState.colB === c.name);

                    return (
                      <th
                        key={c.name}
                        data-header-col={c.name}
                        className={`sticky top-0 z-20 p-1.5 border border-[#EAEAEA] text-center min-w-[56px] max-w-[56px] h-[38px] type-label font-semibold transition-colors ${
                          isColBandActive
                            ? "bg-[#1B4324] text-white font-bold"
                            : isColCellActive
                            ? "bg-[#EAF2EB] text-[#1B4324] font-bold"
                            : "bg-[#F9F9F8] text-[#121A14]"
                        }`}
                        title={`[${c.letter}] ${c.name}`}
                      >
                        {c.letter}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {columns.map((rowCol) => {
                  const isRowBandActive =
                    highlightState?.type === "column" && highlightState.colName === rowCol.name;
                  const isRowCellActive =
                    highlightState?.type === "cell" &&
                    (highlightState.colA === rowCol.name || highlightState.colB === rowCol.name);

                  return (
                    <tr key={rowCol.name}>
                      {/* Row header: Letter chip semibold + name regular muted text */}
                      <th
                        data-header-row={rowCol.name}
                        className={`sticky left-0 z-20 px-2.5 py-1.5 border border-[#EAEAEA] text-left min-w-[200px] max-w-[220px] h-[38px] transition-colors ${
                          isRowBandActive
                            ? "bg-[#1B4324] text-white font-bold"
                            : isRowCellActive
                            ? "bg-[#EAF2EB] text-[#1B4324] font-bold"
                            : "bg-[#F9F9F8]"
                        }`}
                        title={`[${rowCol.letter}] ${rowCol.name}`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs type-number font-semibold shrink-0 ${
                              isRowBandActive
                                ? "bg-white text-[#1B4324]"
                                : "bg-white border border-[#E5E5E3] text-[#1B4324]"
                            }`}
                          >
                            {rowCol.letter}
                          </span>
                          <span
                            className={`truncate max-w-[150px] text-xs font-normal ${
                              isRowBandActive ? "text-white font-medium" : "text-[#626C65]"
                            }`}
                          >
                            {rowCol.name}
                          </span>
                        </div>
                      </th>

                      {columns.map((colCol) => {
                        const isDiag = rowCol.name === colCol.name;
                        const isBandCell =
                          highlightState?.type === "column" &&
                          (highlightState.colName === rowCol.name || highlightState.colName === colCol.name);

                        if (isDiag) {
                          return (
                            <td
                              key={colCol.name}
                              className={`p-1 border border-[#EAEAEA] text-center type-number text-xs text-[#8C948D] cursor-default min-w-[56px] max-w-[56px] h-[38px] ${
                                isBandCell ? "bg-[#EAF2EB]/60 font-bold" : "bg-[#EAEAEA]"
                              }`}
                              title={`[${rowCol.letter}] ↔ [${colCol.letter}]: 1.0`}
                            >
                              —
                            </td>
                          );
                        }

                        const pairKey = `${rowCol.name}_${colCol.name}`;
                        const altKey = `${colCol.name}_${rowCol.name}`;
                        const pair = pairsMap.get(pairKey) || pairsMap.get(altKey);

                        const rVal = pair ? pair[method] : null;
                        const isHighlighted =
                          highlightState?.type === "cell" &&
                          ((highlightState.colA === rowCol.name && highlightState.colB === colCol.name) ||
                            (highlightState.colA === colCol.name && highlightState.colB === rowCol.name));

                        if (rVal === null || rVal === undefined || isNaN(rVal)) {
                          const bg = isBandCell ? "rgba(234, 242, 235, 0.7)" : "#F5F5F4";
                          return (
                            <td
                              key={colCol.name}
                              data-corr-cell={`${rowCol.name}_${colCol.name}`}
                              style={{ backgroundColor: bg }}
                              className="p-1 border border-[#EAEAEA] text-center type-number text-xs text-[#8C948D] min-w-[56px] max-w-[56px] h-[38px] cursor-help"
                              title={t("visualize.corr_insufficient_data_tooltip")}
                            >
                              –
                            </td>
                          );
                        }

                        const cellStyle = getMatrixCellStyle(rVal, threshold, theme);
                        const inlineStyle = {
                          backgroundColor: cellStyle.backgroundColor,
                          color: cellStyle.color,
                          opacity: cellStyle.opacity,
                        };

                        // Band overlay styling when column is searched
                        if (isBandCell && !isHighlighted) {
                          inlineStyle.boxShadow = "inset 0 0 0 1.5px rgba(27, 67, 36, 0.3)";
                        }

                        const tooltip = `[${rowCol.letter}] ${rowCol.name} ↔ [${colCol.letter}] ${
                          colCol.name
                        }: r = ${formatR(rVal, locale)} (n = ${pair?.n ?? 0})`;

                        return (
                          <td
                            key={colCol.name}
                            data-corr-cell={`${rowCol.name}_${colCol.name}`}
                            onClick={() => onSelectPair(rowCol.name, colCol.name)}
                            style={inlineStyle}
                            className={`p-1 border border-[#EAEAEA] text-center type-number text-xs min-w-[56px] max-w-[56px] h-[38px] cursor-pointer transition-all duration-150 relative ${
                              cellStyle.fontWeight === 600 ? "font-semibold" : "font-medium"
                            } ${
                              isHighlighted
                                ? "outline outline-2 outline-[#1B4324] outline-offset-[-2px] z-30 ring-2 ring-[#1B4324]/50 shadow-md !font-bold !opacity-100"
                                : "hover:ring-2 hover:ring-[#1B4324]/50 hover:z-20 hover:!opacity-100"
                            }`}
                            title={tooltip}
                          >
                            {formatR(rVal, locale)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend: Exact diverging scale -1 ... 0 ... +1 */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-4 pt-3 border-t border-[#EAEAEA] text-[11px] text-[#626C65]">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-xs font-mono" style={{ color: theme.negative }}>-1</span>
                <div
                  className="w-36 h-2.5 rounded-full"
                  style={{
                    background:
                      `linear-gradient(to right, ${theme.negative} 0%, ${theme.neutral} 50%, ${theme.primary} 100%)`,
                  }}
                />
                <span className="font-semibold text-xs font-mono" style={{ color: theme.primary }}>+1</span>
              </div>
              <div className="flex items-center justify-between w-full text-[10px] text-[#8C948D] px-0.5">
                <span>{t("visualize.corr_direction_negative")}</span>
                <span className="font-mono text-[#626C65] font-semibold">0</span>
                <span>{t("visualize.corr_direction_positive")}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span title={t("visualize.corr_strength_tooltip")}>&lt; 0,3 {t("visualize.corr_strength_weak")}</span>
              <span>·</span>
              <span title={t("visualize.corr_strength_tooltip")}>0,3–0,5 {t("visualize.corr_strength_moderate")}</span>
              <span>·</span>
              <span title={t("visualize.corr_strength_tooltip")}>0,5–0,7 {t("visualize.corr_strength_fairly_strong")}</span>
              <span>·</span>
              <span title={t("visualize.corr_strength_tooltip")}>≥ 0,7 {t("visualize.corr_strength_strong")}</span>
            </div>
          </div>

          {/* Dropped columns note */}
          {droppedColumns && droppedColumns.length > 0 && (
            <p className="text-[11px] text-[#8C948D] mt-2 italic">
              {t("visualize.corr_dropped_columns_note", {
                n: droppedColumns.length,
                reasons: droppedColumns
                  .map((d) => {
                    const rText =
                      d.reason === "too_many_columns"
                        ? t("visualize.corr_reason_too_many")
                        : t("visualize.corr_reason_no_variance");
                    return `${d.name} (${rText})`;
                  })
                  .join(", "),
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Main CorrelationView Component.
 */
export default function CorrelationView({
  chart,
  summary,
  sessionId,
  settings,
  onUpdateSettings,
  selectedChartIds,
  toggleChart,
}) {
  const { t, i18n } = useTranslation();
  const theme = useChartTheme();
  const currentLang = i18n?.language || "vi";
  const locale = currentLang.startsWith("en") ? "en-US" : "vi-VN";

  const corrV2 = chart.correlation_v2 || summary?.correlation_v2;

  // Fallback if no correlation_v2 or insufficient columns
  if (!corrV2 || !corrV2.columns || corrV2.columns.length < 2) {
    return (
      <div className="py-12 text-center text-xs text-[#626C65]">
        {summary?.correlation_error || t("visualize.heatmap_insufficient")}
      </div>
    );
  }

  const { columns, pairs, default_method, dropped_columns } = corrV2;

  // Column map by name
  const colMap = useMemo(() => {
    const map = new Map();
    columns.forEach((c) => map.set(c.name, c));
    return map;
  }, [columns]);

  // Pairs map for O(1) cell lookup
  const pairsMap = useMemo(() => {
    const map = new Map();
    (pairs || []).forEach((p) => {
      map.set(`${p.a}_${p.b}`, p);
    });
    return map;
  }, [pairs]);

  // Settings: method + threshold + matrix_open
  const method = settings?.method || default_method || "spearman";
  const threshold = settings?.threshold ?? 0.5;
  const isMatrixOpen = settings?.matrix_open !== undefined ? settings.matrix_open : true;

  const handleSetMethod = (newMethod) => {
    if (newMethod === method) return;
    onUpdateSettings?.("corr_heatmap", {
      ...settings,
      method: newMethod,
      threshold,
      matrix_open: isMatrixOpen,
    });
  };

  const handleSetThreshold = (newThreshold) => {
    if (newThreshold === threshold) return;
    onUpdateSettings?.("corr_heatmap", {
      ...settings,
      method,
      threshold: newThreshold,
      matrix_open: isMatrixOpen,
    });
  };

  const handleToggleMatrixExpand = () => {
    const nextState = !isMatrixOpen;
    onUpdateSettings?.("corr_heatmap", {
      ...settings,
      method,
      threshold,
      matrix_open: nextState,
    });
  };

  // Section 4: Info box "r là gì?" collapsed by default
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);

  // Search box & Column filter
  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedFilterCol, setSelectedFilterCol] = useState(null);

  // Highlight state: null | { type: "column", colName } | { type: "cell", colA, colB }
  const [highlightState, setHighlightState] = useState(null);

  // Search dropdown matching
  const matchingColumns = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const qNorm = normalizeVietnamese(searchQuery);
    return columns.filter((col) => {
      if (col.letter && col.letter.toLowerCase() === searchQuery.trim().toLowerCase()) {
        return true;
      }
      return normalizeVietnamese(col.name).includes(qNorm);
    });
  }, [columns, searchQuery]);

  // Threshold count: count of pairs with |r| >= threshold for current method
  const thresholdCount = useMemo(() => {
    return (pairs || []).filter((p) => {
      const r = p[method];
      return r !== null && !isNaN(r) && Math.abs(r) >= threshold;
    }).length;
  }, [pairs, method, threshold]);

  // Filtered pairs for main list
  const filteredPairs = useMemo(() => {
    if (selectedFilterCol) {
      // Find all pairs containing this column
      const targetName = selectedFilterCol.name;
      const matched = (pairs || []).filter(
        (p) => p.a === targetName || p.b === targetName
      );
      // Sort by |r| desc, nulls at end
      return [...matched].sort((p1, p2) => {
        const r1 = p1[method];
        const r2 = p2[method];
        if (r1 === null && r2 === null) return 0;
        if (r1 === null) return 1;
        if (r2 === null) return -1;
        return Math.abs(r2) - Math.abs(r1);
      });
    }

    // Default mode: |r| >= threshold
    return (pairs || [])
      .filter((p) => {
        const r = p[method];
        return r !== null && !isNaN(r) && Math.abs(r) >= threshold;
      })
      .sort((p1, p2) => Math.abs(p2[method]) - Math.abs(p1[method]));
  }, [pairs, selectedFilterCol, method, threshold]);

  // Section 3: Pagination (top 3 by default, adds 10, collapse returns to 3)
  const [visibleCount, setVisibleCount] = useState(3);
  useEffect(() => {
    setVisibleCount(3);
  }, [method, threshold, selectedFilterCol]);

  const listTopRef = useRef(null);

  const handleShowMore = () => {
    setVisibleCount((prev) => prev + 10);
  };

  const handleShowLess = () => {
    setVisibleCount(3);
    setTimeout(() => {
      listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 50);
  };

  // Active expanded pair
  const [expandedPairKey, setExpandedPairKey] = useState(null);
  const scatterCacheRef = useRef({});

  // Matrix container ref
  const matrixContainerRef = useRef(null);

  // Handle picking a column from search: band highlight + scroll matrix row/column into view
  const handlePickSearchCol = (col) => {
    setSelectedFilterCol(col);
    setSearchQuery("");
    setIsDropdownOpen(false);
    setHighlightState({ type: "column", colName: col.name });

    // Scroll matrix to make row/column visible
    setTimeout(() => {
      const container = matrixContainerRef.current;
      if (!container) return;

      const headerRowEl = container.querySelector(`[data-header-row="${CSS.escape(col.name)}"]`);
      const headerColEl = container.querySelector(`[data-header-col="${CSS.escape(col.name)}"]`);

      if (headerRowEl) {
        const containerRect = container.getBoundingClientRect();
        const rowRect = headerRowEl.getBoundingClientRect();
        const rowOffsetTop = rowRect.top - containerRect.top + container.scrollTop;
        container.scrollTop = Math.max(0, rowOffsetTop - 50);
      }
      if (headerColEl) {
        const containerRect = container.getBoundingClientRect();
        const colRect = headerColEl.getBoundingClientRect();
        const colOffsetLeft = colRect.left - containerRect.left + container.scrollLeft;
        container.scrollLeft = Math.max(0, colOffsetLeft - 220);
      }
    }, 100);
  };

  // Handle clearing search filter
  const handleClearSearchCol = () => {
    setSelectedFilterCol(null);
    if (highlightState?.type === "column") {
      setHighlightState(null);
    }
  };

  // Handle "Xem trong ma trận" or row click
  const handleShowInMatrix = (colA, colB) => {
    setHighlightState({ type: "cell", colA, colB });

    // If matrix is collapsed, auto-expand it
    if (!isMatrixOpen) {
      onUpdateSettings?.("corr_heatmap", {
        ...settings,
        method,
        threshold,
        matrix_open: true,
      });
    }

    // Scroll cell into view
    setTimeout(() => {
      const container = matrixContainerRef.current;
      if (!container) return;

      const cellKey = `${colA}_${colB}`;
      const altKey = `${colB}_${colA}`;
      const cellEl =
        container.querySelector(`[data-corr-cell="${CSS.escape(cellKey)}"]`) ||
        container.querySelector(`[data-corr-cell="${CSS.escape(altKey)}"]`);

      if (cellEl) {
        const containerRect = container.getBoundingClientRect();
        const cellRect = cellEl.getBoundingClientRect();
        const stickyHeaderH = 36;
        const stickyColW = 200;

        const cellOffsetTop = cellRect.top - containerRect.top + container.scrollTop;
        container.scrollTop =
          cellOffsetTop - stickyHeaderH - container.clientHeight / 2 + cellRect.height / 2;

        const cellOffsetLeft = cellRect.left - containerRect.left + container.scrollLeft;
        container.scrollLeft =
          cellOffsetLeft - stickyColW - container.clientWidth / 2 + cellRect.width / 2;
      }
    }, 120);
  };

  // Handle clicking a cell in full matrix
  const handleSelectPairFromMatrix = (colA, colB) => {
    const pairKey = `${colA}_${colB}`;
    const altKey = `${colB}_${colA}`;
    const targetKey = pairsMap.has(pairKey) ? pairKey : altKey;

    setHighlightState({ type: "cell", colA, colB });
    setExpandedPairKey(targetKey);

    // If pair is in the filtered list, scroll to its row smoothly
    setTimeout(() => {
      const rowEl = document.querySelector(`[data-pair-row="${CSS.escape(targetKey)}"]`);
      if (rowEl) {
        rowEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }, 150);
  };

  // Fallback pair if selected from matrix but not in the visible list
  const matrixSelectedPair = useMemo(() => {
    if (!expandedPairKey) return null;
    const isVisibleInList = filteredPairs.slice(0, visibleCount).some(
      (p) => `${p.a}_${p.b}` === expandedPairKey || `${p.b}_${p.a}` === expandedPairKey
    );
    if (!isVisibleInList) {
      return pairsMap.get(expandedPairKey) || null;
    }
    return null;
  }, [expandedPairKey, filteredPairs, visibleCount, pairsMap]);

  return (
    <div className="w-full flex flex-col">
      {/* 4. "r là gì?" Info Box */}
      <div className="mb-4">
        <button
          type="button"
          onClick={() => setIsInfoExpanded((prev) => !prev)}
          className="type-label font-semibold text-[#1B4324] hover:underline flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span>{t("visualize.corr_what_is_r_title")}</span>
          {isInfoExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {isInfoExpanded && (
          <div className="mt-2 bg-[#F9F9F8] border border-[#E5E5E3] rounded-lg p-3.5 type-caption text-[#2A342D] leading-relaxed shadow-2xs">
            <p>{t("visualize.corr_what_is_r_content")}</p>
          </div>
        )}
      </div>

      {/* 1. Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3.5 border-b border-[#E5E5E3]">
        {/* Left: Method toggle & Threshold chips */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Method Toggle */}
          <div className="flex items-center gap-1.5">
            <div className="inline-flex rounded-lg border border-[#E5E5E3] bg-[#F9F9F8] p-0.5">
              <button
                type="button"
                onClick={() => handleSetMethod("spearman")}
                className={`px-3 py-1 rounded-md type-label font-medium transition-colors cursor-pointer ${
                  method === "spearman"
                    ? "bg-[#1B4324] text-white shadow-xs"
                    : "text-[#626C65] hover:text-[#121A14]"
                }`}
                title={t("visualize.corr_method_tooltip")}
              >
                Spearman
              </button>
              <button
                type="button"
                onClick={() => handleSetMethod("pearson")}
                className={`px-3 py-1 rounded-md type-label font-medium transition-colors cursor-pointer ${
                  method === "pearson"
                    ? "bg-[#1B4324] text-white shadow-xs"
                    : "text-[#626C65] hover:text-[#121A14]"
                }`}
                title={t("visualize.corr_method_tooltip")}
              >
                Pearson
              </button>
            </div>
            <span
              className="text-[#626C65] hover:text-[#121A14] cursor-help p-1"
              title={t("visualize.corr_method_tooltip")}
            >
              <Info className="w-3.5 h-3.5" />
            </span>
          </div>

          {/* Threshold chips */}
          <div
            className="flex items-center gap-1.5 type-label text-[#626C65]"
            title={t("visualize.corr_threshold_tooltip")}
          >
            <span className="type-label text-[#626C65] cursor-help">|r| ≥</span>
            {[0.3, 0.5, 0.7].map((val) => {
              const active = threshold === val;
              return (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleSetThreshold(val)}
                  className={`px-2 py-0.5 rounded type-label type-number font-medium transition-colors cursor-pointer ${
                    active
                      ? "bg-[#1B4324] text-white font-semibold"
                      : "bg-[#F9F9F8] text-[#626C65] border border-[#EAEAEA] hover:border-[#1B4324]/50"
                  }`}
                  title={t("visualize.corr_threshold_tooltip")}
                >
                  {formatThreshold(val, locale)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Search box */}
        <div className="relative w-full sm:w-64">
          <div className="flex items-center relative">
            <Search className="w-3.5 h-3.5 text-[#8C948D] absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setIsDropdownOpen(true);
              }}
              onFocus={() => setIsDropdownOpen(true)}
              placeholder={t("visualize.corr_search_placeholder")}
              className="w-full pl-8 pr-7 py-1 type-label border border-[#E5E5E3] rounded-lg bg-white focus:outline-hidden focus:border-[#1B4324] placeholder:text-[#8C948D]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setIsDropdownOpen(false);
                }}
                className="absolute right-2 text-[#8C948D] hover:text-[#121A14] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search dropdown */}
          {isDropdownOpen && searchQuery.trim() && matchingColumns.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-[#E5E5E3] rounded-lg shadow-lg z-50 py-1">
              {matchingColumns.map((col) => (
                <button
                  key={col.name}
                  type="button"
                  onClick={() => handlePickSearchCol(col)}
                  className="w-full text-left px-3 py-1.5 type-label hover:bg-[#F9F9F8] flex items-center gap-2 truncate cursor-pointer"
                >
                  <span className="font-semibold type-number text-[#1B4324] bg-[#EAF2EB] px-1 rounded text-[11px]">
                    [{col.letter}]
                  </span>
                  <span className="truncate text-[#121A14]">{col.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Filter notification if filtered by column */}
      {selectedFilterCol && (
        <div className="flex items-center justify-between bg-[#EAF2EB]/60 border border-[#1B4324]/20 rounded-lg px-3 py-2 mb-4 type-label">
          <div className="flex items-center gap-2 truncate">
            <span className="font-medium text-[#1B4324]">
              {t("visualize.corr_correlated_with", {
                letter: selectedFilterCol.letter,
                name: selectedFilterCol.name,
              })}
            </span>
          </div>
          <button
            type="button"
            onClick={handleClearSearchCol}
            className="type-label font-semibold text-[#1B4324] hover:underline flex items-center gap-1 shrink-0 ml-2 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            {t("common.clear", "Bỏ lọc")}
          </button>
        </div>
      )}

      {/* 2. Main Section: Pairs Title with Threshold Count */}
      <div ref={listTopRef} className="mb-4">
        <h4 className="type-card-title text-[#121A14]">
          {selectedFilterCol
            ? t("visualize.corr_correlated_with", {
                letter: selectedFilterCol.letter,
                name: selectedFilterCol.name,
              })
            : t("visualize.corr_main_title_with_count", {
                n: thresholdCount,
                t: formatThreshold(threshold, locale),
              })}
        </h4>
      </div>

      {/* Off-list selected pair from matrix */}
      {matrixSelectedPair && (
        <div className="mb-4">
          <PairDetail
            pair={matrixSelectedPair}
            colA={colMap.get(matrixSelectedPair.a)}
            colB={colMap.get(matrixSelectedPair.b)}
            method={method}
            sessionId={sessionId}
            selectedChartIds={selectedChartIds}
            toggleChart={toggleChart}
            onShowInMatrix={handleShowInMatrix}
            scatterCacheRef={scatterCacheRef}
          />
        </div>
      )}

      {/* Pairs List */}
      {filteredPairs.length === 0 ? (
        <div className="py-10 text-center bg-[#F9F9F8] rounded-lg border border-[#E5E5E3] my-2 px-4">
          <p className="text-xs text-[#626C65] mb-2">
            {t("visualize.corr_empty_state", { t: formatThreshold(threshold, locale) })}
            {threshold > 0.3 && (
              <button
                type="button"
                onClick={() => handleSetThreshold(threshold === 0.7 ? 0.5 : 0.3)}
                className="text-[#1B4324] font-semibold underline hover:opacity-80 cursor-pointer"
              >
                {t("visualize.corr_try_lower_threshold")}
              </button>
            )}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredPairs.slice(0, visibleCount).map((p) => {
            const pairKey = `${p.a}_${p.b}`;
            const isExpanded = expandedPairKey === pairKey;
            const colA = colMap.get(p.a) || { name: p.a, letter: "A", is_discrete: false };
            const colB = colMap.get(p.b) || { name: p.b, letter: "B", is_discrete: false };
            const rVal = p[method];
            const absR = rVal !== null ? Math.abs(rVal) : 0;
            const isPositive = rVal !== null && rVal > 0;
            const strengthText = getCorrelationStrength(absR, currentLang);
            const directionText = isPositive
              ? t("visualize.corr_direction_positive")
              : t("visualize.corr_direction_negative");

            // Line 3 Explanation logic
            const bothDiscrete = colA.is_discrete && colB.is_discrete;
            let explanation = "";
            if (rVal === null) {
              explanation =
                currentLang === "en"
                  ? "Requires at least 10 complete observations."
                  : "Cần tối thiểu 10 dòng quan sát hoàn chỉnh.";
            } else if (bothDiscrete) {
              explanation = isPositive
                ? t("visualize.corr_discrete_positive", { colA: colA.letter, colB: colB.letter })
                : t("visualize.corr_discrete_negative", { colA: colA.letter, colB: colB.letter });
            } else {
              explanation = isPositive
                ? t("visualize.corr_continuous_positive", { colA: colA.letter, colB: colB.letter })
                : t("visualize.corr_continuous_negative", { colA: colA.letter, colB: colB.letter });
            }

            return (
              <div
                key={pairKey}
                data-pair-row={pairKey}
                className="border border-[#E5E5E3] rounded-lg bg-white overflow-hidden transition-all shadow-xs"
              >
                <div
                  onClick={() => {
                    const nextExpanded = isExpanded ? null : pairKey;
                    setExpandedPairKey(nextExpanded);
                    if (nextExpanded) {
                      setHighlightState({ type: "cell", colA: p.a, colB: p.b });
                    }
                  }}
                  className="p-3 hover:bg-[#F9F9F8] cursor-pointer transition-colors"
                >
                  {/* Line 1: [letter] name A ↔ [letter] name B (col names regular, normal color) */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 truncate">
                      <span className="px-1.5 py-0.5 rounded text-xs type-number font-semibold bg-[#EAF2EB] text-[#1B4324] shrink-0">
                        {colA.letter}
                      </span>
                      <span
                        className="font-normal type-body text-[#121A14] truncate max-w-[140px] sm:max-w-[240px] md:max-w-[320px]"
                        title={colA.name}
                      >
                        {colA.name}
                      </span>
                      <span className="text-[#8C948D] shrink-0">↔</span>
                      <span className="px-1.5 py-0.5 rounded text-xs type-number font-semibold bg-[#EAF2EB] text-[#1B4324] shrink-0">
                        {colB.letter}
                      </span>
                      <span
                        className="font-normal type-body text-[#121A14] truncate max-w-[140px] sm:max-w-[240px] md:max-w-[320px]"
                        title={colB.name}
                      >
                        {colB.name}
                      </span>
                    </div>

                    <div className="shrink-0 text-[#8C948D]">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </div>
                  </div>

                  {/* Line 2: r = 0,67 · Khá mạnh · cùng chiều + horizontal bar + n (r semibold, rest regular) */}
                  <div className="flex flex-wrap items-center gap-2.5 mt-2">
                    <span className="type-body-strong type-number text-[#121A14]">
                      r = {formatR(rVal, locale)}
                    </span>
                    <span className="type-caption text-[#8C948D]">·</span>
                    <span
                      className="type-label font-normal text-[#121A14] cursor-help hover:underline decoration-dotted"
                      title={t("visualize.corr_strength_tooltip")}
                    >
                      {strengthText}
                    </span>
                    <span className="type-caption text-[#8C948D]">·</span>
                    <span
                      className="type-label font-normal cursor-help hover:underline decoration-dotted"
                      style={{ color: isPositive ? theme.primary : theme.negative }}
                      title={t("visualize.corr_direction_tooltip")}
                    >
                      {directionText}
                    </span>

                    {/* Small horizontal bar (negative color for negative, primary for positive) */}
                    {rVal !== null && (
                      <div className="w-12 h-1.5 bg-[#EAEAEA] rounded-full overflow-hidden inline-flex items-center ml-1">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${Math.round(Math.min(1, absR) * 100)}%`,
                            backgroundColor: isPositive ? theme.primary : theme.negative,
                          }}
                        />
                      </div>
                    )}

                    <span
                      className="type-caption type-number ml-auto cursor-help hover:underline decoration-dotted"
                      title={t("visualize.corr_n_tooltip")}
                    >
                      n = {p.n}
                    </span>
                  </div>

                  {/* Line 3: Interpretation text (small, muted) */}
                  <p className="type-caption mt-1.5 leading-relaxed font-normal">
                    {explanation}
                  </p>
                </div>

                {/* Inline Expanded Detail */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-0">
                    <PairDetail
                      pair={p}
                      colA={colA}
                      colB={colB}
                      method={method}
                      sessionId={sessionId}
                      selectedChartIds={selectedChartIds}
                      toggleChart={toggleChart}
                      onShowInMatrix={handleShowInMatrix}
                      scatterCacheRef={scatterCacheRef}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* Show More / Show Less Buttons */}
          <div className="flex items-center justify-center gap-3 mt-2">
            {filteredPairs.length > visibleCount && (
              <button
                type="button"
                onClick={handleShowMore}
                className="type-label font-semibold text-[#1B4324] hover:bg-[#EAF2EB] px-4 py-1.5 rounded-lg border border-[#1B4324]/30 transition-colors cursor-pointer"
              >
                {t("visualize.corr_show_more")}
              </button>
            )}
            {visibleCount > 3 && (
              <button
                type="button"
                onClick={handleShowLess}
                className="type-label font-medium text-[#626C65] hover:text-[#121A14] hover:bg-[#F9F9F8] px-3 py-1.5 rounded-lg border border-[#E5E5E3] transition-colors cursor-pointer"
              >
                {t("visualize.corr_show_less")}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Causation disclaimer */}
      <p className="type-caption mt-4 mb-1 italic text-center text-[#8C948D]">
        {t("visualize.corr_causation_note")}
      </p>

      {/* 5. Full Matrix (Expanded by default, numbers back, search highlights row+column) */}
      <FullCorrelationMatrix
        columns={columns}
        pairsMap={pairsMap}
        method={method}
        threshold={threshold}
        droppedColumns={dropped_columns}
        matrixContainerRef={matrixContainerRef}
        highlightState={highlightState}
        onSelectPair={handleSelectPairFromMatrix}
        isExpanded={isMatrixOpen}
        onToggleExpand={handleToggleMatrixExpand}
      />
    </div>
  );
}
