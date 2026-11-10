/**
 * reportFindings.js
 * -----------------
 * Pure utility functions for extracting key findings ("Điểm chính")
 * from confirmed report charts and dataset summary statistics.
 *
 * Does NOT call Gemini / AI. Reusable across Report UI, PDF, and DOCX exports.
 */

export const DEFAULT_REPORT_SECTIONS = {
  overview: true,
  key_findings: true,
  methodology: true,
  detailed_analysis: true,
  appendix: true,
};

/**
 * Returns an object with boolean flags for each report section.
 * Falls back to DEFAULT_REPORT_SECTIONS for any missing section key.
 */
export function getIncludedSections(fileSession) {
  return {
    ...DEFAULT_REPORT_SECTIONS,
    ...(fileSession?.reportSectionsIncluded || {}),
  };
}

/**
 * Truncate long column or value names at word boundary (~60 chars).
 */
export function truncateName(name, maxChars = 60) {
  if (!name || typeof name !== "string") return "";
  const trimmed = name.trim();
  if (trimmed.length <= maxChars) return trimmed;
  const sub = trimmed.slice(0, maxChars - 3);
  const lastSpace = sub.lastIndexOf(" ");
  if (lastSpace > 20) {
    return sub.slice(0, lastSpace) + "...";
  }
  return sub + "...";
}

/**
 * Resolves figure number (1-based) for a given chart.
 */
function resolveFigureNumber(chart, idx, figureNumbers) {
  if (typeof figureNumbers === "function") {
    return figureNumbers(chart, idx);
  }
  if (figureNumbers && typeof figureNumbers === "object") {
    const cid = chart.chart_id || chart.id;
    const col = chart.column || chart.col;
    if (cid && figureNumbers[cid] !== undefined) return figureNumbers[cid];
    if (col && figureNumbers[col] !== undefined) return figureNumbers[col];
  }
  return idx + 1;
}

/**
 * Extract candidate key findings from confirmed charts and summary statistics.
 * Scores candidates, enforces max 1 bullet per chart, and picks top 5 max.
 *
 * @param {Array} confirmedCharts - List of chart objects in the report
 * @param {Object} summary - Statistical summary ({ columns, top_correlations, correlation_v2, ... })
 * @param {Object|Function} figureNumbers - Mapping or resolver for figure numbers
 * @param {string} lang - "vi" | "en"
 * @returns {Array<string>} Array of bullet point strings
 */
export function buildKeyFindings(confirmedCharts = [], summary = {}, figureNumbers = null, lang = "vi") {
  const isEn = typeof lang === "string" && lang.startsWith("en");
  const locale = isEn ? "en-US" : "vi-VN";
  if (!Array.isArray(confirmedCharts) || confirmedCharts.length === 0 || !summary?.columns) {
    return [];
  }

  const columnsStats = summary.columns || {};
  const candidates = [];

  // Helper for figure reference
  const figRef = (n) => (isEn ? `Figure ${n}` : `Hình ${n}`);

  // Chart identifiers helper
  const getCid = (chart, idx) => String(chart.chart_id || chart.id || chart.column || chart.col || `chart_${idx}`);

  // 1. Check for Scale charts: evaluate Scale extreme (highest/lowest mean) & Scale top box
  const scaleCharts = [];
  confirmedCharts.forEach((chart, idx) => {
    const col = chart.column || chart.col;
    if (!col) return;
    const stats = columnsStats[col];
    if (!stats) return;

    const isScale = stats.is_scale === true || (stats.dtype === "numeric" && stats.is_discrete && stats.is_scale);
    if (!isScale) return;

    const cid = getCid(chart, idx);
    const figNum = resolveFigureNumber(chart, idx, figureNumbers);
    const mean = typeof stats.mean === "number" ? stats.mean : null;
    const scaleMax = stats.scale_max ?? 5;

    scaleCharts.push({
      cid,
      col,
      figNum,
      mean,
      scaleMax,
      stats,
      chartIndex: idx,
    });
  });

  // 1a. Scale extreme (highest/lowest mean) - only if >= 2 scale charts in report with valid mean
  const validScaleMeans = scaleCharts.filter((s) => s.mean !== null);
  if (validScaleMeans.length >= 2) {
    validScaleMeans.sort((a, b) => a.mean - b.mean);
    const low = validScaleMeans[0];
    const high = validScaleMeans[validScaleMeans.length - 1];

    if (low.col !== high.col) {
      const highMeanStr = high.mean.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
      const lowMeanStr = low.mean.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 2 });
      const highColName = truncateName(high.col);
      const lowColName = truncateName(low.col);

      const text = isEn
        ? `Highest rated item is '${highColName}' with an average score of ${highMeanStr} / ${high.scaleMax} (${figRef(high.figNum)}); lowest is '${lowColName}' at ${lowMeanStr} / ${low.scaleMax} (${figRef(low.figNum)}).`
        : `Tiêu chí được đánh giá cao nhất là '${highColName}' với điểm trung bình ${highMeanStr} / ${high.scaleMax} (${figRef(high.figNum)}); thấp nhất là '${lowColName}' đạt ${lowMeanStr} / ${low.scaleMax} (${figRef(low.figNum)}).`;

      candidates.push({
        chartIds: [high.cid, low.cid],
        score: 90,
        text,
        order: Math.min(high.chartIndex, low.chartIndex),
      });
    }
  }

  // 1b. Scale top box (pct >= 70% or <= 30%)
  scaleCharts.forEach((item) => {
    const { cid, col, figNum, stats, scaleMax, chartIndex } = item;
    let pct = null;
    let lowBox = scaleMax - 1;
    let highBox = scaleMax;

    // Check auto_insights first
    const autoInsights = stats.auto_insights || [];
    const topBoxInsight = autoInsights.find((ins) => ins.key === "scale_top_box");
    if (topBoxInsight && topBoxInsight.params?.pct !== undefined) {
      pct = topBoxInsight.params.pct;
      if (topBoxInsight.params.low !== undefined) lowBox = topBoxInsight.params.low;
      if (topBoxInsight.params.high !== undefined) highBox = topBoxInsight.params.high;
    } else if (Array.isArray(stats.distribution_bins) && stats.respondents > 0) {
      const sumTopBox = stats.distribution_bins
        .filter((b) => typeof b.value === "number" && b.value >= lowBox && b.value <= highBox)
        .reduce((sum, b) => sum + (b.count || 0), 0);
      pct = Math.round((sumTopBox / stats.respondents) * 100);
    }

    if (pct !== null && (pct >= 70 || pct <= 30)) {
      const score = (pct >= 75 || pct <= 25) ? 75 : 50;
      const colName = truncateName(col);
      let text = "";

      if (pct >= 50) {
        text = isEn
          ? `${pct}% of respondents gave high ratings to '${colName}' (levels ${lowBox}–${highBox}, ${figRef(figNum)}).`
          : `${pct}% người tham gia đánh giá cao '${colName}' (mức ${lowBox}–${highBox}, ${figRef(figNum)}).`;
      } else {
        text = isEn
          ? `Only ${pct}% of respondents gave high ratings to '${colName}' (levels ${lowBox}–${highBox}, ${figRef(figNum)}).`
          : `Chỉ ${pct}% người tham gia đánh giá cao '${colName}' (mức ${lowBox}–${highBox}, ${figRef(figNum)}).`;
      }

      candidates.push({
        chartIds: [cid],
        score,
        text,
        order: chartIndex,
      });
    }
  });

  // 2. Correlation heatmap: if heatmap in report, take the strongest pair if |r| >= 0.5
  const heatmapChartIdx = confirmedCharts.findIndex(
    (c) => c.type === "heatmap" || c.display_type === "heatmap" || c.id === "corr_heatmap" || c.chart_id === "corr_heatmap"
  );
  if (heatmapChartIdx !== -1) {
    const heatmapChart = confirmedCharts[heatmapChartIdx];
    const heatmapCid = getCid(heatmapChart, heatmapChartIdx);

    let strongestPair = null;

    // Check correlation_v2 pairs
    const v2Pairs = summary.correlation_v2?.pairs;
    if (Array.isArray(v2Pairs) && v2Pairs.length > 0) {
      const defaultMethod = summary.correlation_v2.default_method || "spearman";
      let maxAbs = -1;
      v2Pairs.forEach((p) => {
        const val = p[defaultMethod] ?? p.spearman ?? p.pearson;
        if (typeof val === "number" && !Number.isNaN(val)) {
          const absVal = Math.abs(val);
          if (absVal > maxAbs) {
            maxAbs = absVal;
            strongestPair = { col_a: p.a, col_b: p.b, r: val };
          }
        }
      });
    } else if (Array.isArray(summary.top_correlations) && summary.top_correlations.length > 0) {
      const top = summary.top_correlations[0];
      if (typeof top.r === "number") {
        strongestPair = top;
      }
    }

    if (strongestPair) {
      const absR = Math.abs(strongestPair.r);
      if (absR >= 0.5) {
        const score = absR >= 0.7 ? 80 : 70;
        const colA = truncateName(strongestPair.col_a);
        const colB = truncateName(strongestPair.col_b);
        const rStr = strongestPair.r.toFixed(2);
        const direction = strongestPair.r > 0 ? (isEn ? "positive" : "thuận") : (isEn ? "negative" : "nghịch");

        const text = isEn
          ? `Strongest correlation between '${colA}' and '${colB}' (r = ${rStr}, ${direction}).`
          : `Mối tương quan mạnh nhất giữa '${colA}' và '${colB}' (r = ${rStr}, ${direction}).`;

        candidates.push({
          chartIds: [heatmapCid],
          score,
          text,
          order: heatmapChartIdx,
        });
      }
    }
  }

  // 3. Loop through all charts for Categorical top_value / top3_share, Trend, Outliers
  confirmedCharts.forEach((chart, idx) => {
    const col = chart.column || chart.col;
    if (!col) return;
    const stats = columnsStats[col];
    if (!stats) return;

    const cid = getCid(chart, idx);
    const figNum = resolveFigureNumber(chart, idx, figureNumbers);
    const autoInsights = stats.auto_insights || [];
    const isScale = stats.is_scale === true || (stats.dtype === "numeric" && stats.is_discrete && stats.is_scale);

    // 3a. Categorical / Multiple Choice
    if (stats.dtype === "categorical" || stats.dtype === "multiple_choice" || (stats.dtype === "numeric" && stats.is_discrete && !isScale)) {
      // Top value
      let topVal = null;
      let topPct = null;

      const topInsight = autoInsights.find((ins) => ins.key === "top_value" || ins.key === "mc_top" || ins.key === "discrete_top");
      if (topInsight && topInsight.params?.value !== undefined && topInsight.params.pct !== undefined) {
        topVal = String(topInsight.params.value);
        topPct = Math.round(topInsight.params.pct);
      } else if (Array.isArray(stats.top_values) && stats.top_values.length > 0) {
        const first = stats.top_values[0];
        if (first.value !== "__other__") {
          topVal = String(first.value);
          topPct = Math.round(first.pct);
        }
      }

      if (topVal && topPct !== null && topVal !== "__other__") {
        if (topPct >= 70 || topPct >= 50) {
          const score = topPct >= 70 ? 85 : 65;
          const valName = truncateName(topVal);
          const colName = truncateName(col);
          const text = isEn
            ? `'${valName}' is the dominant choice for '${colName}' at ${topPct}% (${figRef(figNum)}).`
            : `'${valName}' là lựa chọn áp đảo ở '${colName}' với ${topPct}% (${figRef(figNum)}).`;

          candidates.push({
            chartIds: [cid],
            score,
            text,
            order: idx,
          });
        }
      }

      // Top 3 share (>= 70%)
      const top3Insight = autoInsights.find((ins) => ins.key === "top3_share");
      let top3Pct = top3Insight?.params?.pct;
      if (top3Pct === undefined && Array.isArray(stats.all_values) && stats.all_values.length >= 3) {
        const top3Sum = stats.all_values
          .slice(0, 3)
          .filter((v) => v.value !== "__other__")
          .reduce((sum, v) => sum + (v.pct || 0), 0);
        if (top3Sum >= 70) {
          top3Pct = Math.round(top3Sum);
        }
      }

      if (typeof top3Pct === "number" && top3Pct >= 70) {
        const colName = truncateName(col);
        const text = isEn
          ? `Top 3 values in '${colName}' account for ${Math.round(top3Pct)}% of the total (${figRef(figNum)}).`
          : `Top 3 giá trị ở '${colName}' chiếm ${Math.round(top3Pct)}% tổng số (${figRef(figNum)}).`;

        candidates.push({
          chartIds: [cid],
          score: 55,
          text,
          order: idx,
        });
      }
    }

    // 3b. Time / Trend (>= 30%)
    if (stats.dtype === "datetime") {
      const trendInsight = autoInsights.find((ins) => ins.key === "trend_up" || ins.key === "trend_down");
      if (trendInsight && trendInsight.params?.pct !== undefined) {
        const pct = Math.round(Math.abs(trendInsight.params.pct));
        if (pct >= 30) {
          const isUp = trendInsight.key === "trend_up";
          const colName = truncateName(col);
          const text = isEn
            ? `${isUp ? "Upward" : "Downward"} trend of ${pct}% for '${colName}' (${figRef(figNum)}).`
            : `Xu hướng ${isUp ? "tăng" : "giảm"} ${pct}% ở '${colName}' (${figRef(figNum)}).`;

          candidates.push({
            chartIds: [cid],
            score: 60,
            text,
            order: idx,
          });
        }
      }
    }

    // 3c. Numeric continuous outliers (count > 0)
    if (stats.dtype === "numeric" && !stats.is_discrete) {
      let outlierCount = typeof stats.outlier_count === "number" ? stats.outlier_count : 0;
      if (outlierCount === 0) {
        const outInsight = autoInsights.find((ins) => ins.key === "outliers");
        if (outInsight && typeof outInsight.params?.n === "number") {
          outlierCount = outInsight.params.n;
        }
      }

      if (outlierCount > 0) {
        const colName = truncateName(col);
        const countStr = outlierCount.toLocaleString(locale);
        const text = isEn
          ? `Detected ${countStr} outlier value${outlierCount > 1 ? "s" : ""} in '${colName}' (${figRef(figNum)}).`
          : `Phát hiện ${countStr} giá trị ngoại lệ ở '${colName}' (${figRef(figNum)}).`;

        candidates.push({
          chartIds: [cid],
          score: 40,
          text,
          order: idx,
        });
      }
    }
  });

  // 4. Sort candidates: score descending, tie break by chart order
  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.order - b.order;
  });

  // 5. Select top 5 max with at most 1 bullet per chart
  const selectedBullets = [];
  const usedChartIds = new Set();

  for (const cand of candidates) {
    const isConflict = cand.chartIds.some((id) => usedChartIds.has(id));
    if (!isConflict) {
      selectedBullets.push(cand.text);
      cand.chartIds.forEach((id) => usedChartIds.add(id));
      if (selectedBullets.length >= 5) break;
    }
  }

  return selectedBullets;
}

