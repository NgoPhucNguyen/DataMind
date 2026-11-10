import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ZoomIn, ZoomOut, ChevronDown, ChevronUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, LabelList
} from "recharts";
import { getOrderedShades, getOrderedGreenShades } from "../../utils/chartView";
import { useChartTheme, BASE_CHART_THEME } from "../../contexts/ChartThemeContext";

export { useChartTheme };

export const CHART_THEME = {
  fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
  primary: "#1B4324",
  textMuted: "#626C65",
  textDark: "#121A14",
  borderGrid: "#EAEAEA",
  borderCard: "#E5E5E3",
  otherCategory: "#9CA3AF",
  tooltipCursor: "rgba(0,0,0,0.02)",
  piePalette: ["#1B4324", "#2E6F65", "#B87A28", "#3B5B78", "#A24936", "#5B7038", "#6B4C6E", "#8C7355"],
  // Bolder numbers and labels (Phase 2c)
  tickColor: "#3F4742",
  tickFontWeight: 500,
  valueColor: "#1F2923",
  valueMutedColor: "#4B5563",
  valueFontWeight: 600,
};

export const DistributionChart = React.memo(({
  data = [],
  color,
  isDiscrete = false,
  isAnimationActive = true,
  debounce,
}) => {
  const { t } = useTranslation();
  const theme = useChartTheme();
  const activeColor = color || theme.primary;
  const isDiscreteMode = Boolean(isDiscrete || (data.length > 0 && data[0]?.label !== undefined));

  const chartData = data.map(d => {
    if (isDiscreteMode) {
      return {
        name: String(d.label ?? d.value ?? ""),
        count: d.count ?? 0,
        pct: d.pct,
      };
    }
    const start = typeof d.bin_start === "number" ? d.bin_start.toFixed(1) : (d.bin_start ?? "");
    const end = typeof d.bin_end === "number" ? d.bin_end.toFixed(1) : (d.bin_end ?? "");
    return {
      name: `${start} - ${end}`,
      count: d.count ?? 0,
      pct: d.pct,
    };
  });

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const count = item.count ?? 0;
      return (
        <div className="bg-white border border-[#E5E5E3] rounded-lg p-2.5 shadow-md text-xs z-50 pointer-events-none">
          <p className="font-semibold text-[#121A14] mb-1">{item.name}</p>
          <p className="text-[#626C65]">
            {isDiscreteMode && count === 0 ? (
              <span className="font-medium text-[#8C948D]">{t("visualize.zero_respondents")}</span>
            ) : isDiscreteMode && item.pct !== undefined ? (
              `${count} (${item.pct}%)`
            ) : (
              count
            )}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%" debounce={debounce}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.borderGrid} vertical={false} />
        <XAxis
          dataKey="name"
          stroke={theme.tickColor}
          tick={{ fill: theme.tickColor, fontWeight: theme.tickFontWeight, fontFamily: theme.fontFamily }}
          fontSize={10}
          tickFormatter={isDiscreteMode ? undefined : (val) => val.split(" - ")[0]}
        />
        <YAxis
          stroke={theme.tickColor}
          tick={{ fill: theme.tickColor, fontWeight: theme.tickFontWeight, fontFamily: theme.fontFamily }}
          fontSize={10}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: theme.tooltipCursor }}
          wrapperStyle={{ zIndex: 1000, fontFamily: theme.fontFamily }}
        />
        <Bar dataKey="count" fill={activeColor} radius={[4, 4, 0, 0]} isAnimationActive={isAnimationActive}>
          {isDiscreteMode && (
            <LabelList
              dataKey="count"
              position="top"
              content={(props) => {
                const { x, y, width, value } = props;
                if (value === 0) {
                  return (
                    <text
                      x={x + width / 2}
                      y={y - 4}
                      fill={theme.valueMutedColor}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={theme.valueFontWeight}
                      fontFamily={theme.fontFamily}
                    >
                      0
                    </text>
                  );
                }
                return null;
              }}
            />
          )}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

export const CategoricalChart = React.memo(({
  data = [],
  color,
  isAnimationActive = true,
  debounce,
}) => {
  const { t } = useTranslation();
  const theme = useChartTheme();
  const activeColor = color || theme.primary;

  const getLabel = (val, entry) => {
    if (val === "__other__") {
      const otherN = entry?.other_n;
      return otherN ? t("visualize.other_label", { n: otherN }) : t("visualize.other_fallback");
    }
    return String(val ?? "");
  };

  const renderYTick = (props) => {
    const { x, y, payload } = props;
    const entry = data.find(d => String(d.value) === String(payload.value));
    const fullText = getLabel(payload.value, entry);
    
    // Wrap to 2 lines (~22 chars per line)
    const maxLine = 22;
    let line1 = fullText;
    let line2 = "";
    if (fullText.length > maxLine) {
      const spaceIdx = fullText.lastIndexOf(" ", maxLine);
      const splitAt = spaceIdx > 10 ? spaceIdx : maxLine;
      line1 = fullText.substring(0, splitAt);
      line2 = fullText.substring(splitAt).trim();
      if (line2.length > maxLine) {
        line2 = line2.substring(0, maxLine - 1) + "…";
      }
    }

    let tooltipTitle = fullText;
    if (entry?.hidden_items && entry.hidden_items.length > 0) {
      const sample = entry.hidden_items.slice(0, 10).map(h => `${h.value} (${h.count})`).join(", ");
      const more = entry.hidden_items.length > 10 ? ` +${entry.hidden_items.length - 10}` : "";
      tooltipTitle = `${fullText} [${sample}${more}]`;
    }

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={-6}
          y={line2 ? -4 : 3}
          textAnchor="end"
          fill={theme.tickColor}
          fontWeight={theme.tickFontWeight}
          fontFamily={theme.fontFamily}
          fontSize={10}
          className="select-none"
        >
          <title>{tooltipTitle}</title>
          <tspan x={-6}>{line1}</tspan>
          {line2 && <tspan x={-6} dy={12}>{line2}</tspan>}
        </text>
      </g>
    );
  };

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const isOther = item.value === "__other__";
      const label = isOther ? (item.other_n ? t("visualize.other_label", { n: item.other_n }) : t("visualize.other_fallback")) : item.value;
      const hiddenList = item.hidden_items || [];
      const showHidden = isOther && hiddenList.length > 0;
      const top10Hidden = hiddenList.slice(0, 10);
      const remainingHiddenCount = hiddenList.length - 10;

      return (
        <div className="bg-white border border-[#E5E5E3] rounded-lg p-2.5 shadow-md text-xs z-50 max-w-[280px] pointer-events-none">
          <p className="font-semibold text-[#121A14] break-words mb-1">{label}</p>
          <p className="text-[#626C65]">
            {t("visualize.tooltip_count")} <span className="font-semibold text-[#121A14]">{item.count}</span>
          </p>
          {item.pct !== undefined && (
            <p className="text-[#626C65]">
              {t("visualize.tooltip_pct")} <span className="font-semibold text-[#121A14]">{item.pct}%</span>
            </p>
          )}

          {showHidden && (
            <div className="mt-2 pt-2 border-t border-[#EAEAEA] text-[11px] text-[#626C65] space-y-0.5">
              <p className="font-medium text-[#2A342D] mb-1">
                {t("visualize.other_hidden_header")}
              </p>
              {top10Hidden.map((h, i) => (
                <div key={i} className="truncate">
                  • {h.value} ({h.count})
                </div>
              ))}
              {remainingHiddenCount > 0 && (
                <p className="italic text-[#8C948D] pt-0.5">
                  {t("visualize.other_hidden_more", { count: remainingHiddenCount })}
                </p>
              )}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%" debounce={debounce}>
      <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.borderGrid} horizontal={false} />
        <XAxis
          type="number"
          stroke={theme.tickColor}
          tick={{ fill: theme.tickColor, fontWeight: theme.tickFontWeight, fontFamily: theme.fontFamily }}
          fontSize={10}
        />
        <YAxis 
          dataKey="value" 
          type="category" 
          width={130} 
          tick={renderYTick}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: theme.tooltipCursor }} wrapperStyle={{ zIndex: 1000, fontFamily: theme.fontFamily }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={isAnimationActive}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.value === "__other__" ? theme.other : activeColor}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

export const TrendChart = React.memo(({
  data = [],
  color,
  isAnimationActive = true,
  debounce,
}) => {
  const theme = useChartTheme();
  const activeColor = color || theme.primary;

  return (
    <ResponsiveContainer width="100%" height="100%" debounce={debounce}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={theme.borderGrid} vertical={false} />
        <XAxis
          dataKey="period"
          stroke={theme.tickColor}
          tick={{ fill: theme.tickColor, fontWeight: theme.tickFontWeight, fontFamily: theme.fontFamily }}
          fontSize={10}
        />
        <YAxis
          stroke={theme.tickColor}
          tick={{ fill: theme.tickColor, fontWeight: theme.tickFontWeight, fontFamily: theme.fontFamily }}
          fontSize={10}
        />
        <Tooltip contentStyle={{ backgroundColor: "#ffffff", border: `1px solid ${theme.borderGrid}`, borderRadius: 8, color: theme.textDark, fontFamily: theme.fontFamily }} wrapperStyle={{ zIndex: 1000, fontFamily: theme.fontFamily }} />
        <Line type="monotone" dataKey="count" stroke={activeColor} strokeWidth={2} dot={{ r: 3, fill: activeColor }} isAnimationActive={isAnimationActive} />
      </LineChart>
    </ResponsiveContainer>
  );
});

export const CorrelationHeatmap = React.memo(({ matrix, topCorr, onCellClick, anchorPair }) => {
  const { t, i18n } = useTranslation();
  const [zoom, setZoom] = useState(1);

  if (!matrix || Object.keys(matrix).length === 0) return <p className="text-muted text-sm">{t("visualize.heatmap_insufficient")}</p>;

  const currentLang = i18n?.language || "vi";
  const locale = currentLang.startsWith("en") ? "en-US" : "vi-VN";

  const cols = Object.keys(matrix);

  const getColor = (val) => {
    if (val === 1) return "bg-sage text-forest font-semibold border border-forest/10";
    if (val > 0.5) return "bg-[#EAF2EB] text-[#1B4324] font-medium border border-[#c8e0cb]/50";
    if (val > 0) return "bg-[#EAF2EB]/40 text-[#1B4324]/80";
    if (val < -0.5) return "bg-[#FDEBEC] text-[#9F2F2D] font-medium border border-[#f5c6cb]/50";
    if (val < 0) return "bg-[#FDEBEC]/40 text-[#9F2F2D]/80";
    return "bg-[#F9F9F8] text-muted";
  };

  const isAnchored = (row, col) => {
    if (!anchorPair) return false;
    return (anchorPair.colA === row && anchorPair.colB === col) ||
           (anchorPair.colA === col && anchorPair.colB === row);
  };

  const isDiagonal = (row, col) => row === col;

  return (
    <div className="flex flex-col w-full">
      <div className="flex justify-end gap-2 mb-2 shrink-0">
        <button onClick={() => setZoom(z => Math.max(0.4, z - 0.2))} className="p-1.5 border border-[#EAEAEA] bg-white text-[#626C65] hover:bg-[#EAF2EB] hover:text-[#1B4324] rounded-md transition-colors" title={t("visualize.btn_zoom_out")}>
          <ZoomOut size={16} strokeWidth={1.5} />
        </button>
        <span className="text-xs font-mono flex items-center justify-center w-12 text-[#626C65]">{Math.round(zoom * 100)}%</span>
        <button onClick={() => setZoom(z => Math.min(2, z + 0.2))} className="p-1.5 border border-[#EAEAEA] bg-white text-[#626C65] hover:bg-[#EAF2EB] hover:text-[#1B4324] rounded-md transition-colors" title={t("visualize.btn_zoom_in")}>
          <ZoomIn size={16} strokeWidth={1.5} />
        </button>
      </div>
      
      <div className="overflow-auto max-h-[420px] relative border border-[#EAEAEA] rounded-lg bg-[#F9F9F8]">
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', minWidth: 'max-content' }} className="p-2 transition-transform duration-200">
          <table className="w-full text-xs text-center border-collapse bg-white shadow-sm">
            <thead>
              <tr>
                <th className="p-2 border border-border bg-[#F9F9F8] sticky top-0 left-0 z-[60]"></th>
                {cols.map(c => {
                  const isColActive = anchorPair && (anchorPair.colA === c || anchorPair.colB === c);
                  return (
                    <th key={c} className={`p-2 border border-border text-ink truncate max-w-[100px] sticky top-0 z-[50] shadow-[0_1px_0_#EAEAEA] transition-colors ${isColActive ? "bg-[#EAF2EB] text-[#1B4324] font-bold" : "bg-[#F9F9F8]"}`} title={c}>{c}</th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {cols.map(row => (
                <tr key={row}>
                  {(() => {
                    const isRowActive = anchorPair && (anchorPair.colA === row || anchorPair.colB === row);
                    return (
                      <th className={`p-2 border border-border text-left text-ink truncate max-w-[100px] sticky left-0 z-[50] shadow-[1px_0_0_#EAEAEA] transition-colors ${isRowActive ? "bg-[#EAF2EB] text-[#1B4324] font-bold" : "bg-[#F9F9F8]"}`} title={row}>{row}</th>
                    );
                  })()}
                  {cols.map(col => {
                    const val = matrix[row][col];
                    const diagonal = isDiagonal(row, col);
                    const anchored = isAnchored(row, col);
                    const isCrosshair = anchorPair && (anchorPair.colA === row || anchorPair.colB === row || anchorPair.colA === col || anchorPair.colB === col);

                    return (
                      <td
                        key={col}
                        style={{ fontWeight: CHART_THEME.valueFontWeight }}
                        className={`p-2 border border-border transition-all duration-150 relative ${getColor(val)} ${
                          diagonal
                            ? "opacity-50 cursor-default"
                            : `cursor-pointer hover:ring-2 hover:ring-[#1B4324]/50 hover:z-40 ${
                                anchored 
                                   ? "outline outline-2 outline-[#1B4324] outline-offset-[-2px] z-40 font-bold shadow-lg" 
                                  : isCrosshair 
                                    ? "after:absolute after:inset-0 after:bg-[#1B4324]/5 z-10"
                                    : ""
                              }`
                        }`}
                        onClick={diagonal ? undefined : () => onCellClick?.(row, col, val)}
                        title={diagonal ? `${row} (self)` : `${row} × ${col}: ${val.toFixed(4)}`}
                      >
                        {val.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {onCellClick && (
        <p className="text-xs text-[#626C65] mt-3 text-center">
          {t("visualize.heatmap_click_hint")}
        </p>
      )}

      {topCorr && topCorr.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#EAEAEA]">
          <p className="text-xs font-semibold mb-2 text-[#121A14]">{t("visualize.heatmap_top_corr")}</p>
          <div className="space-y-1.5">
            {topCorr.slice(0, 5).map((tc, idx) => {
              const pairLabel = `${tc.col_a} ↔ ${tc.col_b}`;
              const rNum = typeof tc.r === "number" ? tc.r : parseFloat(tc.r);
              const rVal = !isNaN(rNum)
                ? rNum.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : tc.r;
              const isPositive = !isNaN(rNum) ? rNum >= 0 : true;
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-[#F9F9F8] border border-[#EAEAEA] gap-2"
                  title={`${pairLabel}: ${rVal}`}
                >
                  <span className="truncate text-[#2A342D]" title={pairLabel}>
                    {pairLabel}
                  </span>
                  <span className={`font-mono font-semibold shrink-0 ${isPositive ? "text-[#1B4324]" : "text-[#9F2F2D]"}`}>
                    {rVal}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
});

export const PieChartComponent = React.memo(({
  data = [],
  color,
  isDiscrete = false,
  isScale = false,
  isAnimationActive = true,
  debounce,
}) => {
  const { t } = useTranslation();
  const theme = useChartTheme();

  if (!data || data.length === 0) return null;

  const isOrdered = Boolean(isDiscrete || isScale);
  const nonOtherItems = data.filter((d) => (d.value ?? d.name) !== "__other__");
  const orderedShades = isOrdered ? getOrderedShades(theme.primary, nonOtherItems.length) : [];

  let nonOtherIdx = 0;
  const sliceColors = data.map((entry) => {
    const val = entry.value ?? entry.name;
    if (val === "__other__") {
      return theme.other;
    }
    if (isOrdered) {
      const c = orderedShades[nonOtherIdx] || color || theme.primary;
      nonOtherIdx++;
      return c;
    }
    const c = theme.categorical[nonOtherIdx % theme.categorical.length];
    nonOtherIdx++;
    return c;
  });

  const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const isOther = item.value === "__other__";
      const label = isOther
        ? (item.other_n ? t("visualize.other_label", { n: item.other_n }) : t("visualize.other_fallback"))
        : String(item.label ?? item.value ?? item.name ?? "");
      const hiddenList = item.hidden_items || [];
      const showHidden = isOther && hiddenList.length > 0;
      const top10Hidden = hiddenList.slice(0, 10);
      const remainingHiddenCount = hiddenList.length - 10;

      return (
        <div className="bg-white border border-[#E5E5E3] rounded-lg p-2.5 shadow-md text-xs z-50 max-w-[280px] pointer-events-none">
          <p className="font-semibold text-[#121A14] break-words mb-1">
            {label}: <span className="font-normal text-[#626C65]">{item.count} {item.pct !== undefined ? `(${item.pct}%)` : ""}</span>
          </p>
          {showHidden && (
            <div className="mt-2 pt-2 border-t border-[#EAEAEA] text-[11px] text-[#626C65] space-y-0.5">
              <p className="font-medium text-[#2A342D] mb-1">
                {t("visualize.other_hidden_header")}
              </p>
              {top10Hidden.map((h, i) => (
                <div key={i} className="truncate">
                  • {h.value} ({h.count})
                </div>
              ))}
              {remainingHiddenCount > 0 && (
                <p className="italic text-[#8C948D] pt-0.5">
                  {t("visualize.other_hidden_more", { count: remainingHiddenCount })}
                </p>
              )}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const renderSliceLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, pct }) => {
    if (pct === undefined || pct < 4) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill="#ffffff"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={11}
        fontWeight={theme.valueFontWeight}
        fontFamily={theme.fontFamily}
      >
        {`${Math.round(pct)}%`}
      </text>
    );
  };

  return (
    <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
      <div className="w-[180px] h-[180px] sm:w-[210px] sm:h-[210px] shrink-0">
        <ResponsiveContainer width="100%" height="100%" debounce={debounce}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={data.length <= 4 ? 45 : 40}
              outerRadius={data.length <= 4 ? 80 : 75}
              paddingAngle={2}
              dataKey="count"
              nameKey="value"
              labelLine={false}
              label={data.length <= 4 ? renderSliceLabel : undefined}
              isAnimationActive={isAnimationActive}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={sliceColors[index]}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomPieTooltip />} wrapperStyle={{ zIndex: 1000, fontFamily: theme.fontFamily }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className={`flex flex-col justify-center space-y-1.5 min-w-[160px] max-w-[280px] w-full sm:w-auto text-xs py-1 ${data.length > 8 ? "max-h-[190px] overflow-y-auto pr-1" : ""}`}>
        {data.map((item, index) => {
          const isOther = item.value === "__other__";
          const label = isOther
            ? (item.other_n ? t("visualize.other_label", { n: item.other_n }) : t("visualize.other_fallback"))
            : String(item.label ?? item.value ?? item.name ?? "");
          const sliceColor = sliceColors[index];
          const pctStr = item.pct !== undefined ? `(${Math.round(item.pct)}%)` : "";
          return (
            <div key={index} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: sliceColor }}
                />
                <span className="truncate text-[#2A342D]" title={label}>
                  {label}
                </span>
              </div>
              <span
                className="type-number shrink-0 text-[11px] whitespace-nowrap"
                style={{ color: theme.valueColor, fontWeight: theme.valueFontWeight }}
              >
                {item.count} {pctStr}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export const BoxPlotChart = React.memo(({
  stats,
  data,
  color,
  isExport = false,
  isEnlarged = false,
}) => {
  const { t, i18n } = useTranslation();
  const theme = useChartTheme();
  const activeColor = color || theme.primary;
  const negativeColor = theme.negative || "#DC2626";

  const effectiveStats = stats || data;
  const box = effectiveStats?.box;

  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(isExport ? 960 : 500);
  const [tooltip, setTooltip] = useState(null);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect?.width) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (
    !box ||
    box.q1 === undefined ||
    box.median === undefined ||
    box.q3 === undefined ||
    box.whisker_low === undefined ||
    box.whisker_high === undefined
  ) {
    return null;
  }

  const locale = i18n?.language?.startsWith("en") ? "en-US" : "vi-VN";
  const numFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const formatNum = (v) => (typeof v === "number" ? numFormatter.format(v) : (v ?? ""));

  const whiskerLow = box.whisker_low;
  const whiskerHigh = box.whisker_high;
  const q1 = box.q1;
  const median = box.median;
  const q3 = box.q3;
  const mean = box.mean ?? (q1 + q3) / 2;
  const outliers = Array.isArray(box.outliers) ? box.outliers : [];
  const outliersTotal = box.outliers_total ?? outliers.length;

  const allValues = [whiskerLow, whiskerHigh, q1, median, q3, mean, ...outliers].filter(
    (v) => typeof v === "number" && !isNaN(v)
  );
  const dataMin = allValues.length > 0 ? Math.min(...allValues) : 0;
  const dataMax = allValues.length > 0 ? Math.max(...allValues) : 100;

  // Nice tick calculation (5-6 ticks)
  let ticks = [];
  let domain = [dataMin, dataMax];
  if (dataMin === dataMax) {
    ticks = [dataMin];
    domain = [dataMin - 1, dataMax + 1];
  } else {
    const range = dataMax - dataMin;
    const rawStep = range / 4.5;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / mag;
    let step = mag;
    if (norm < 1.5) step = 1 * mag;
    else if (norm < 3) step = 2 * mag;
    else if (norm < 7) step = 5 * mag;
    else step = 10 * mag;

    const start = Math.floor(dataMin / step) * step;
    const end = Math.ceil(dataMax / step) * step;
    const maxTicks = 12;
    for (let cur = start; cur <= end + step * 0.001 && ticks.length < maxTicks; cur += step) {
      ticks.push(Number(cur.toFixed(6)));
    }
    if (ticks.length > 0) {
      domain = [ticks[0], ticks[ticks.length - 1]];
    }
  }

  const marginLeft = isEnlarged ? 45 : 35;
  const marginRight = isEnlarged ? 45 : 35;
  const plotWidth = Math.max(20, containerWidth - marginLeft - marginRight);
  const domainSpan = domain[1] - domain[0] || 1;
  const xScale = (val) => marginLeft + ((val - domain[0]) / domainSpan) * plotWidth;

  const svgHeight = isEnlarged ? 170 : 145;
  const yCenter = isEnlarged ? 68 : 58;
  const boxHeight = isEnlarged ? 48 : 36;
  const capH = isEnlarged ? 20 : 16;
  const axisY = svgHeight - 22;

  // Number labels above the box; if closer than 36px, put below
  const rawLabels = [
    { key: "whisker_low", val: whiskerLow, x: xScale(whiskerLow), isMedian: false },
    { key: "q1", val: q1, x: xScale(q1), isMedian: false },
    { key: "median", val: median, x: xScale(median), isMedian: true },
    { key: "q3", val: q3, x: xScale(q3), isMedian: false },
    { key: "whisker_high", val: whiskerHigh, x: xScale(whiskerHigh), isMedian: false },
  ];

  let prevAboveX = -Infinity;
  const positionedLabels = rawLabels.map((lbl, idx) => {
    if (idx > 0 && lbl.x - prevAboveX < 36) {
      return { ...lbl, placement: "below" };
    }
    prevAboveX = lbl.x;
    return { ...lbl, placement: "above" };
  });

  const boxX = xScale(q1);
  const boxW = Math.max(2, xScale(q3) - xScale(q1));
  const boxY = yCenter - boxHeight / 2;

  const whiskerLowX = xScale(whiskerLow);
  const whiskerHighX = xScale(whiskerHigh);
  const medianX = xScale(median);
  const meanX = xScale(mean);

  return (
    <div className="w-full relative flex flex-col" ref={containerRef}>
      {/* Floating Hover Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-30 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white text-[#121A14] border border-[#E5E5E3] shadow-md transition-opacity duration-150 whitespace-nowrap"
          style={{
            left: Math.min(Math.max(10, tooltip.x - 40), Math.max(10, containerWidth - 260)),
            top: Math.max(0, tooltip.y - 40),
            fontFamily: theme.fontFamily,
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Responsive Horizontal SVG */}
      <svg
        width="100%"
        height={svgHeight}
        viewBox={`0 0 ${containerWidth} ${svgHeight}`}
        className="overflow-visible select-none"
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Vertical background grid at ticks */}
        {ticks.map((tVal) => (
          <line
            key={`grid-${tVal}`}
            x1={xScale(tVal)}
            x2={xScale(tVal)}
            y1={16}
            y2={axisY}
            stroke={theme.borderGrid || "#EAEAEA"}
            strokeDasharray="2 2"
            strokeWidth={1}
          />
        ))}

        {/* Low whisker line + end cap */}
        <line
          x1={whiskerLowX}
          x2={boxX}
          y1={yCenter}
          y2={yCenter}
          stroke={activeColor}
          strokeWidth={1.5}
        />
        <line
          x1={whiskerLowX}
          x2={whiskerLowX}
          y1={yCenter - capH / 2}
          y2={yCenter + capH / 2}
          stroke={activeColor}
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Invisible hit area for low whisker */}
        <line
          x1={whiskerLowX}
          x2={boxX}
          y1={yCenter}
          y2={yCenter}
          stroke="transparent"
          strokeWidth={16}
          className="cursor-pointer"
          onMouseEnter={() => {
            setTooltip({
              x: whiskerLowX + (boxX - whiskerLowX) / 2,
              y: yCenter,
              text: t("visualize.boxplot_tooltip_whiskers", {
                low: formatNum(whiskerLow),
                high: formatNum(whiskerHigh),
              }),
            });
          }}
        />

        {/* High whisker line + end cap */}
        <line
          x1={boxX + boxW}
          x2={whiskerHighX}
          y1={yCenter}
          y2={yCenter}
          stroke={activeColor}
          strokeWidth={1.5}
        />
        <line
          x1={whiskerHighX}
          x2={whiskerHighX}
          y1={yCenter - capH / 2}
          y2={yCenter + capH / 2}
          stroke={activeColor}
          strokeWidth={2}
          strokeLinecap="round"
        />
        {/* Invisible hit area for high whisker */}
        <line
          x1={boxX + boxW}
          x2={whiskerHighX}
          y1={yCenter}
          y2={yCenter}
          stroke="transparent"
          strokeWidth={16}
          className="cursor-pointer"
          onMouseEnter={() => {
            setTooltip({
              x: boxX + boxW + (whiskerHighX - (boxX + boxW)) / 2,
              y: yCenter,
              text: t("visualize.boxplot_tooltip_whiskers", {
                low: formatNum(whiskerLow),
                high: formatNum(whiskerHigh),
              }),
            });
          }}
        />

        {/* Box from Q1 to Q3 */}
        <rect
          x={boxX}
          y={boxY}
          width={boxW}
          height={boxHeight}
          fill={activeColor}
          fillOpacity={0.25}
          stroke={activeColor}
          strokeWidth={1.5}
          rx={3}
          ry={3}
          className="cursor-pointer"
          onMouseEnter={() => {
            setTooltip({
              x: boxX + boxW / 2,
              y: yCenter,
              text: `Q1: ${formatNum(q1)} — Q3: ${formatNum(q3)} (IQR: ${formatNum(box.iqr ?? q3 - q1)})`,
            });
          }}
        />

        {/* Q1 invisible hit area */}
        <line
          x1={boxX}
          x2={boxX}
          y1={boxY}
          y2={boxY + boxHeight}
          stroke="transparent"
          strokeWidth={14}
          className="cursor-pointer"
          onMouseEnter={() => {
            setTooltip({
              x: boxX,
              y: yCenter,
              text: t("visualize.boxplot_tooltip_q1", { v: formatNum(q1) }),
            });
          }}
        />

        {/* Q3 invisible hit area */}
        <line
          x1={boxX + boxW}
          x2={boxX + boxW}
          y1={boxY}
          y2={boxY + boxHeight}
          stroke="transparent"
          strokeWidth={14}
          className="cursor-pointer"
          onMouseEnter={() => {
            setTooltip({
              x: boxX + boxW,
              y: yCenter,
              text: t("visualize.boxplot_tooltip_q3", { v: formatNum(q3) }),
            });
          }}
        />

        {/* Median thick line */}
        <line
          x1={medianX}
          x2={medianX}
          y1={boxY}
          y2={boxY + boxHeight}
          stroke={activeColor}
          strokeWidth={3}
          className="cursor-pointer"
        />
        {/* Median hit area */}
        <line
          x1={medianX}
          x2={medianX}
          y1={boxY}
          y2={boxY + boxHeight}
          stroke="transparent"
          strokeWidth={14}
          className="cursor-pointer"
          onMouseEnter={() => {
            setTooltip({
              x: medianX,
              y: yCenter,
              text: t("visualize.boxplot_tooltip_median", { v: formatNum(median) }),
            });
          }}
        />

        {/* Mean diamond ◆ */}
        <path
          d={`M ${meanX} ${yCenter - 5} L ${meanX + 5} ${yCenter} L ${meanX} ${yCenter + 5} L ${meanX - 5} ${yCenter} Z`}
          fill={activeColor}
          stroke="#ffffff"
          strokeWidth={1.5}
          className="cursor-pointer"
        />
        <circle
          cx={meanX}
          cy={yCenter}
          r={10}
          fill="transparent"
          className="cursor-pointer"
          onMouseEnter={() => {
            setTooltip({
              x: meanX,
              y: yCenter,
              text: t("visualize.boxplot_tooltip_mean", { v: formatNum(mean) }),
            });
          }}
        />

        {/* Outlier dots in palette.negative */}
        {outliers.map((oVal, idx) => {
          const oX = xScale(oVal);
          const oY = yCenter + (outliers.length > 1 ? ((idx % 3) - 1) * 4 : 0);
          return (
            <g key={`outlier-${idx}-${oVal}`}>
              <circle
                cx={oX}
                cy={oY}
                r={3.5}
                fill={negativeColor}
                fillOpacity={0.85}
                stroke="#ffffff"
                strokeWidth={1}
                className="cursor-pointer"
              />
              <circle
                cx={oX}
                cy={oY}
                r={9}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => {
                  setTooltip({
                    x: oX,
                    y: oY,
                    text: t("visualize.boxplot_tooltip_outlier", { v: formatNum(oVal) }),
                  });
                }}
              />
            </g>
          );
        })}

        {/* Number labels above/below box */}
        {positionedLabels.map((lbl) => {
          const isAbove = lbl.placement === "above";
          const labelY = isAbove ? boxY - 8 : boxY + boxHeight + 16;
          return (
            <text
              key={`label-${lbl.key}`}
              x={lbl.x}
              y={labelY}
              textAnchor="middle"
              fill={theme.textDark || "#121A14"}
              fontFamily={theme.fontFamily}
              fontSize={isEnlarged ? 12 : 11}
              fontWeight={lbl.isMedian ? 600 : 500}
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {formatNum(lbl.val)}
            </text>
          );
        })}

        {/* Horizontal Axis Line */}
        <line
          x1={marginLeft}
          x2={marginLeft + plotWidth}
          y1={axisY}
          y2={axisY}
          stroke={theme.tickColor || "#3F4742"}
          strokeWidth={1}
        />

        {/* Axis Ticks & Labels */}
        {ticks.map((tVal) => {
          const tX = xScale(tVal);
          return (
            <g key={`tick-${tVal}`}>
              <line
                x1={tX}
                x2={tX}
                y1={axisY}
                y2={axisY + 4}
                stroke={theme.tickColor || "#3F4742"}
                strokeWidth={1}
              />
              <text
                x={tX}
                y={axisY + 16}
                textAnchor="middle"
                fill={theme.tickColor || "#3F4742"}
                fontFamily={theme.fontFamily}
                fontSize={10}
                fontWeight={theme.tickFontWeight || 500}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {formatNum(tVal)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Legend Line */}
      <div
        className="mt-2 text-[11.5px] text-[#626C65] font-normal leading-relaxed select-none"
        style={{ fontFamily: theme.fontFamily }}
      >
        <span>
          {t("visualize.boxplot_legend", {
            q1: formatNum(q1),
            q3: formatNum(q3),
            n: outliersTotal,
          })}
        </span>
        {outliersTotal > outliers.length && (
          <span>
            {t("visualize.boxplot_legend_shown", {
              shown: outliers.length,
              n: outliersTotal,
            })}
          </span>
        )}
      </div>

      {/* Collapsible How-To-Read Box (not in exports) */}
      {!isExport && (
        <div className="mt-3 select-none">
          <button
            type="button"
            onClick={() => setIsInfoExpanded((prev) => !prev)}
            className="type-label font-semibold text-[#1B4324] hover:underline flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>{t("visualize.boxplot_how_to_read_title")}</span>
            {isInfoExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {isInfoExpanded && (
            <div className="mt-2 bg-[#F9F9F8] border border-[#E5E5E3] rounded-lg p-3.5 type-caption text-[#2A342D] leading-relaxed shadow-2xs">
              <p>{t("visualize.boxplot_how_to_read_content")}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
