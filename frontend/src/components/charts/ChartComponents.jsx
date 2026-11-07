import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { ZoomIn, ZoomOut } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, LabelList
} from "recharts";
import { getOrderedGreenShades } from "../../utils/chartView";

export const CHART_THEME = {
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
  color = CHART_THEME.primary,
  isDiscrete = false,
  isAnimationActive = true,
  debounce,
}) => {
  const { t } = useTranslation();
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
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.borderGrid} vertical={false} />
        <XAxis
          dataKey="name"
          stroke={CHART_THEME.tickColor}
          tick={{ fill: CHART_THEME.tickColor, fontWeight: CHART_THEME.tickFontWeight }}
          fontSize={10}
          tickFormatter={isDiscreteMode ? undefined : (val) => val.split(" - ")[0]}
        />
        <YAxis
          stroke={CHART_THEME.tickColor}
          tick={{ fill: CHART_THEME.tickColor, fontWeight: CHART_THEME.tickFontWeight }}
          fontSize={10}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: CHART_THEME.tooltipCursor }}
          wrapperStyle={{ zIndex: 1000 }}
        />
        <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} isAnimationActive={isAnimationActive}>
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
                      fill={CHART_THEME.valueMutedColor}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight={CHART_THEME.valueFontWeight}
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
  color = CHART_THEME.primary,
  isAnimationActive = true,
  debounce,
}) => {
  const { t } = useTranslation();

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
          fill={CHART_THEME.tickColor}
          fontWeight={CHART_THEME.tickFontWeight}
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
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.borderGrid} horizontal={false} />
        <XAxis
          type="number"
          stroke={CHART_THEME.tickColor}
          tick={{ fill: CHART_THEME.tickColor, fontWeight: CHART_THEME.tickFontWeight }}
          fontSize={10}
        />
        <YAxis 
          dataKey="value" 
          type="category" 
          width={130} 
          tick={renderYTick}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: CHART_THEME.tooltipCursor }} wrapperStyle={{ zIndex: 1000 }} />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} isAnimationActive={isAnimationActive}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.value === "__other__" ? CHART_THEME.otherCategory : color}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

export const TrendChart = React.memo(({
  data = [],
  color = CHART_THEME.primary,
  isAnimationActive = true,
  debounce,
}) => {
  return (
    <ResponsiveContainer width="100%" height="100%" debounce={debounce}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.borderGrid} vertical={false} />
        <XAxis
          dataKey="period"
          stroke={CHART_THEME.tickColor}
          tick={{ fill: CHART_THEME.tickColor, fontWeight: CHART_THEME.tickFontWeight }}
          fontSize={10}
        />
        <YAxis
          stroke={CHART_THEME.tickColor}
          tick={{ fill: CHART_THEME.tickColor, fontWeight: CHART_THEME.tickFontWeight }}
          fontSize={10}
        />
        <Tooltip contentStyle={{ backgroundColor: "#ffffff", border: `1px solid ${CHART_THEME.borderGrid}`, borderRadius: 8, color: CHART_THEME.textDark }} wrapperStyle={{ zIndex: 1000 }} />
        <Line type="monotone" dataKey="count" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} isAnimationActive={isAnimationActive} />
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
  color = CHART_THEME.primary,
  isDiscrete = false,
  isScale = false,
  isAnimationActive = true,
  debounce,
}) => {
  const { t } = useTranslation();

  if (!data || data.length === 0) return null;

  const isOrdered = Boolean(isDiscrete || isScale);
  const nonOtherItems = data.filter((d) => (d.value ?? d.name) !== "__other__");
  const orderedShades = isOrdered ? getOrderedGreenShades(nonOtherItems.length) : [];

  let nonOtherIdx = 0;
  const sliceColors = data.map((entry) => {
    const val = entry.value ?? entry.name;
    if (val === "__other__") {
      return CHART_THEME.otherCategory;
    }
    if (isOrdered) {
      const c = orderedShades[nonOtherIdx] || color || CHART_THEME.primary;
      nonOtherIdx++;
      return c;
    }
    const c = CHART_THEME.piePalette[nonOtherIdx % CHART_THEME.piePalette.length];
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
        fontWeight={CHART_THEME.valueFontWeight}
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
            <Tooltip content={<CustomPieTooltip />} wrapperStyle={{ zIndex: 1000 }} />
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
                className="font-mono shrink-0 text-[11px] whitespace-nowrap"
                style={{ color: CHART_THEME.valueColor, fontWeight: CHART_THEME.valueFontWeight }}
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
  color = CHART_THEME.primary,
  isAnimationActive = true,
  debounce,
}) => {
  const { t } = useTranslation();
  if (!stats || stats.min === undefined || stats.p25 === undefined || stats.median === undefined || stats.p75 === undefined || stats.max === undefined) {
    return null;
  }
  const data = [
    { name: t("visualize.boxplot_distribution"), box: [stats.p25 || 0, stats.p75 || 0], min: stats.min, max: stats.max, median: stats.median }
  ];
  return (
    <ResponsiveContainer width="100%" height="100%" debounce={debounce}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.borderGrid} horizontal={false} />
        <XAxis
          type="number"
          stroke={CHART_THEME.tickColor}
          tick={{ fill: CHART_THEME.tickColor, fontWeight: CHART_THEME.tickFontWeight }}
          fontSize={10}
          domain={[stats.min || 0, stats.max || 0]}
        />
        <YAxis
          dataKey="name"
          type="category"
          width={80}
          stroke={CHART_THEME.tickColor}
          tick={{ fill: CHART_THEME.tickColor, fontWeight: CHART_THEME.tickFontWeight }}
          fontSize={10}
        />
        <Tooltip 
          cursor={{ fill: CHART_THEME.tooltipCursor }} 
          contentStyle={{ backgroundColor: "#ffffff", border: `1px solid ${CHART_THEME.borderGrid}`, borderRadius: 8, color: CHART_THEME.textDark }} 
          formatter={(value, name, props) => {
            if (name === "box") return `p25: ${props.payload.box[0].toFixed(2)}, p75: ${props.payload.box[1].toFixed(2)}`;
            return value;
          }}
        />
        <Bar dataKey="box" fill={color} radius={[4, 4, 4, 4]} barSize={40} isAnimationActive={isAnimationActive} />
      </BarChart>
    </ResponsiveContainer>
  );
});
