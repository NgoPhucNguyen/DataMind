/**
 * chartImages.js
 * --------------
 * Off-screen high-resolution chart image capture for DOCX export.
 *
 * Renders required charts into an off-screen container at fixed export resolution
 * (960x440px, or 960x420px for Pie), disables animations, applies theme palette,
 * waits for font and layout readiness, and captures sharp PNG data URLs using html-to-image.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import {
  DistributionChart,
  CategoricalChart,
  TrendChart,
  PieChartComponent,
  BoxPlotChart,
} from "../components/charts/ChartComponents";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { computeEffectiveChart } from "./chartView";
import { ChartThemeProvider } from "../contexts/ChartThemeContext";

/**
 * Stage component that renders all target charts with fixed dimensions and no animations.
 * Written using React.createElement so this file remains 100% pure standard JavaScript.
 */
function ChartExportStage({
  targetCharts = [],
  statsMap = {},
  settings = {},
  summary = {},
  palette = null,
  lang = "vi",
  t = (k) => k,
  figureWidths = {},
}) {
  const primaryColor = palette?.primary || "#1B4324";
  const borderGrid = "#EAEAEA";
  const tickColor = "#3F4742";
  const fontFamily = "'Be Vietnam Pro', system-ui, -apple-system, sans-serif";

  const chartElements = targetCharts.map((chart, idx) => {
    const cid = String(chart.chart_id || chart.id || `chart_${idx}`);
    const colName = chart.column || chart.col;
    const stats = statsMap[colName] || {};
    const chartSettings = settings?.[cid] ?? chart.settings ?? {};

    const isCorrPair = chart.type === "corr_pair";
    const effective = computeEffectiveChart(chart, stats, chartSettings, summary, t, lang);
    const displayType = effective.displayType;
    const effectiveData = effective.effectiveData || [];
    const effectiveStats = effective.effectiveStats || stats;
    const isPie = displayType === "pie";

    const isHalf = figureWidths?.[cid] === "half";
    const containerWidth = isHalf ? 640 : 960;
    const isBox = displayType === "box";
    const containerHeight = isHalf ? 400 : isBox ? 300 : isPie ? 420 : 440;

    let chartContent = null;
    if (isCorrPair) {
      chartContent = React.createElement(
        "div",
        { style: { width: "100%", height: "100%" } },
        React.createElement(
          ResponsiveContainer,
          { width: "100%", height: "100%" },
          React.createElement(
            ScatterChart,
            { margin: { top: 15, right: 35, bottom: 40, left: 20 } },
            React.createElement(CartesianGrid, { strokeDasharray: "3 3", stroke: borderGrid }),
            React.createElement(XAxis, {
              dataKey: "x",
              type: "number",
              name: chart.col_x,
              stroke: tickColor,
              tick: { fill: tickColor, fontFamily },
              fontSize: 11,
              label: {
                value: `[${chart.letter_x || "X"}] ${chart.col_x || ""}`,
                position: "insideBottomRight",
                offset: -5,
                fill: tickColor,
                fontSize: 12,
                fontFamily,
              },
            }),
            React.createElement(YAxis, {
              dataKey: "y",
              type: "number",
              name: chart.col_y,
              stroke: tickColor,
              tick: { fill: tickColor, fontFamily },
              fontSize: 11,
              label: {
                value: `[${chart.letter_y || "Y"}] ${chart.col_y || ""}`,
                position: "insideTopLeft",
                offset: -5,
                fill: tickColor,
                fontSize: 12,
                angle: -90,
                fontFamily,
              },
            }),
            React.createElement(Scatter, {
              data: chart.payload?.points || [],
              fill: primaryColor,
              fillOpacity: 0.65,
              r: 4,
              isAnimationActive: false,
            })
          )
        )
      );
    } else if (displayType === "box") {
      chartContent = React.createElement(
        "div",
        { style: { width: "100%", height: "100%" } },
        React.createElement(BoxPlotChart, {
          stats: effectiveStats,
          color: primaryColor,
          isAnimationActive: false,
          isExport: true,
        })
      );
    } else if (isPie) {
      chartContent = React.createElement(
        "div",
        { style: { width: "100%", height: "100%" } },
        React.createElement(PieChartComponent, {
          data: effectiveData,
          color: primaryColor,
          isDiscrete: effectiveStats?.is_discrete,
          isScale: effectiveStats?.is_scale,
          isAnimationActive: false,
        })
      );
    } else if (displayType === "trend") {
      chartContent = React.createElement(
        "div",
        { style: { width: "100%", height: "100%" } },
        React.createElement(TrendChart, {
          data: effectiveData,
          color: primaryColor,
          isAnimationActive: false,
        })
      );
    } else if (displayType === "bar") {
      chartContent = React.createElement(
        "div",
        { style: { width: "100%", height: "100%" } },
        React.createElement(CategoricalChart, {
          data: effectiveData,
          color: primaryColor,
          isDiscrete: effectiveStats?.is_discrete,
          isScale: effectiveStats?.is_scale,
          isAnimationActive: false,
        })
      );
    } else {
      chartContent = React.createElement(
        "div",
        { style: { width: "100%", height: "100%" } },
        React.createElement(DistributionChart, {
          data: effectiveData,
          color: primaryColor,
          isAnimationActive: false,
        })
      );
    }

    return React.createElement(
      "div",
      {
        key: cid,
        "data-export-chart-id": cid,
        style: {
          width: containerWidth,
          height: containerHeight,
          background: "#ffffff",
          boxSizing: "border-box",
          padding: "16px 24px",
          position: "relative",
        },
      },
      chartContent
    );
  });

  return React.createElement(
    ChartThemeProvider,
    { paletteId: palette?.id || "datamind" },
    React.createElement(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: 32, background: "#ffffff" } },
      chartElements
    )
  );
}

/**
 * Capture high-resolution PNG images of all specified chart IDs.
 *
 * @param {Array<string>} chartIds - IDs of charts that need images
 * @param {Object} options - Configuration and dataset contexts
 * @returns {Promise<Object>} Map of { [chartId]: { dataUrl, widthPx, heightPx } }
 */
export async function captureChartImages(
  chartIds = [],
  {
    charts = [],
    statsMap = {},
    settings = {},
    summary = {},
    palette = null,
    lang = "vi",
    t = (k) => k,
    onProgress = null,
    figureWidths = {},
  } = {}
) {
  if (!chartIds || chartIds.length === 0) {
    return {};
  }

  // Filter charts to only those that require an image (excluding heatmaps and corr_pair grid mode)
  const targetCharts = charts.filter((c) => {
    const cid = String(c.chart_id || c.id);
    if (!chartIds.includes(cid)) return false;
    if (c.type === "heatmap" || c.display_type === "heatmap" || cid === "corr_heatmap") return false;
    if (c.type === "corr_pair" && c.payload?.mode === "grid") return false;
    return true;
  });

  if (targetCharts.length === 0) {
    return {};
  }

  // Dynamically import html-to-image
  const { toPng } = await import("html-to-image");

  // Create off-screen DOM stage
  const stage = document.createElement("div");
  stage.id = "docx-chart-export-stage";
  stage.style.position = "fixed";
  stage.style.left = "-10000px";
  stage.style.top = "0";
  stage.style.zIndex = "-99999";
  stage.style.pointerEvents = "none";
  stage.style.background = "#ffffff";
  document.body.appendChild(stage);

  const root = createRoot(stage);

  try {
    // Render all target charts into the stage
    root.render(
      React.createElement(ChartExportStage, {
        targetCharts,
        statsMap,
        settings,
        summary,
        palette,
        lang,
        t,
        figureWidths,
      })
    );

    // Wait for fonts to load
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    // Wait 2 animation frames + 150ms timeout for SVG measurement stability
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    await new Promise((resolve) => setTimeout(resolve, 150));

    const results = {};
    const total = targetCharts.length;
    let done = 0;

    for (let i = 0; i < targetCharts.length; i++) {
      const chart = targetCharts[i];
      const cid = String(chart.chart_id || chart.id);
      const isHalf = figureWidths?.[cid] === "half";
      const isPie = chart.type === "pie" || chart.display_type === "pie";
      const node = stage.querySelector(`[data-export-chart-id="${cid}"]`);

      if (node) {
        try {
          const dataUrl = await toPng(node, {
            pixelRatio: 2,
            backgroundColor: "#ffffff",
            cacheBust: true,
          });

          results[cid] = {
            dataUrl,
            widthPx: isHalf ? 640 : (node.offsetWidth || 960),
            heightPx: isHalf ? 400 : (node.offsetHeight || (isPie ? 420 : 440)),
            isHalf,
          };
        } catch (err) {
          console.warn(`Could not render chart ${cid} image:`, err);
        }
      }

      done++;
      if (typeof onProgress === "function") {
        onProgress(done, total);
      }
    }

    return results;
  } finally {
    // Clean up stage from DOM
    try {
      root.unmount();
      stage.remove();
    } catch (_) {
      // Ignore unmount errors during cleanup
    }
  }
}

