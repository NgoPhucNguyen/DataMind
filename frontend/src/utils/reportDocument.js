/**
 * reportDocument.js
 * ------------------
 * Pure JavaScript report document model builder.
 * Transforms session, charts, statistics, settings, and cover page configuration
 * into a structured, platform-agnostic document model representation.
 *
 * Reusable across DOCX, PDF, and future export engines.
 * Contains NO React or DOM dependencies.
 */

import { formatFigureTitle, formatTableCaption, getCorrTableCaption } from "./reportNumbering";
import { buildKeyFindings, getIncludedSections } from "./reportFindings";
import { computeEffectiveChart } from "./chartView";

/**
 * Normalizes hex string into [r, g, b].
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
 * Returns correlation strength label based on |r|.
 */
export function getCorrelationStrength(absR, lang = "vi") {
  if (absR >= 0.7) return lang === "en" ? "Strong" : "Mạnh";
  if (absR >= 0.5) return lang === "en" ? "Fairly strong" : "Khá mạnh";
  if (absR >= 0.3) return lang === "en" ? "Moderate" : "Vừa";
  return lang === "en" ? "Weak" : "Yếu";
}

/**
 * Pure diverging style calculator for correlation matrix cells.
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
 * Pure insight formatter.
 */
export function formatInsight(insight, t, lang) {
  if (!insight) return "";
  if (insight.text) return insight.text;
  const { key, params = {} } = insight;
  if (!key) return "";

  const currentLang = lang || (t?.i18n ? t.i18n.language : "vi");
  const locale = currentLang.startsWith("en") ? "en-US" : "vi-VN";

  const formattedParams = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "number") {
      if (k === "mean") {
        formattedParams[k] = v.toLocaleString(locale, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
      } else if (k === "pct") {
        formattedParams[k] = v.toLocaleString(locale, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        });
      } else {
        formattedParams[k] = v.toLocaleString(locale, {
          maximumFractionDigits: Number.isInteger(v) ? 0 : 1,
          minimumFractionDigits: Number.isInteger(v) ? 0 : 1,
        });
      }
    } else {
      formattedParams[k] = v;
    }
  }

  const translationKey = `visualize.insight.${key}`;
  const translated = t(translationKey, formattedParams);
  if (!translated || translated === translationKey) {
    return "";
  }
  return translated;
}

/**
 * Converts rgb(...) or hex string into 6-digit hex without '#' for docx compatibility.
 */
export function toHexColor(colorStr, fallback = "1B4324") {
  if (!colorStr) return fallback.replace("#", "");
  const str = String(colorStr).trim();
  if (str.startsWith("#")) {
    const clean = str.replace("#", "");
    if (clean.length === 3) {
      return clean.split("").map((c) => c + c).join("").toUpperCase();
    }
    return clean.toUpperCase();
  }
  const rgbMatch = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgbMatch) {
    const r = Math.min(255, Math.max(0, parseInt(rgbMatch[1], 10)));
    const g = Math.min(255, Math.max(0, parseInt(rgbMatch[2], 10)));
    const b = Math.min(255, Math.max(0, parseInt(rgbMatch[3], 10)));
    return ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
  }
  return fallback.replace("#", "");
}

function formatR(val, locale = "vi-VN") {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return Number(val).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function truncateText(str = "", maxChars = 40) {
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
 * Builds the canonical document model for export.
 */
export function buildReportDocument({
  fileSession = {},
  summary = null,
  charts = [],
  settings = {},
  palette = null,
  included = null,
  cover = null,
  plan = "free",
  lang = "vi",
  t = (k, p) => p?.defaultValue || k,
}) {
  const isEn = typeof lang === "string" && lang.startsWith("en");
  const locale = isEn ? "en-US" : "vi-VN";
  const statSummary = summary || fileSession.statisticalSummary || {};
  const columnsStats = statSummary.columns || {};
  const effectiveIncluded = included || getIncludedSections(fileSession);
  const effectivePalette = palette || {
    primary: "#1B4324",
    negative: "#A24936",
    neutral: "#ECEEEC",
    other: "#9CA3AF",
  };

  const fileName = fileSession.fileName || "Dataset";
  const totalRows = fileSession.profileData?.total_rows ??
    fileSession.profileData?.row_count ??
    statSummary?.shape?.[0] ?? 0;
  const totalCols = fileSession.profileData?.total_columns ??
    fileSession.profileData?.col_count ??
    statSummary?.shape?.[1] ?? 0;

  const today = new Date();
  const defaultDateStr = today.toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const rowsStr = Number(totalRows).toLocaleString(locale);
  const metaLineText = isEn
    ? `${fileName} · ${rowsStr} rows × ${totalCols} columns · ${defaultDateStr}`
    : `${fileName} · ${rowsStr} dòng × ${totalCols} cột · ${defaultDateStr}`;

  // Cover page structure
  const coverEnabled = Boolean(cover?.enabled ?? true);
  const coverModel = coverEnabled
    ? {
        title: cover?.title?.trim() || (isEn ? "Data Analysis Report" : "Báo cáo phân tích dữ liệu"),
        author: cover?.author?.trim() || "",
        organization: cover?.organization?.trim() || "",
        date: cover?.date?.trim() || defaultDateStr,
        fileName,
        rows: totalRows,
        cols: totalCols,
        rowsStr,
        showBranding: plan !== "pro",
      }
    : null;

  const tocEnabled = Boolean(cover?.toc ?? true);

  const blocks = [];

  // Metadata line at the start of document body only when cover block is disabled
  if (!coverEnabled) {
    blocks.push({
      type: "paragraph",
      text: metaLineText,
      style: "muted",
    });
  }

  // 1. Overview Section
  if (effectiveIncluded.overview !== false) {
    blocks.push({
      type: "heading",
      level: 1,
      text: t("report.sec_overview", { defaultValue: isEn ? "Overview" : "Tổng quan" }),
    });

    let introText = "";
    if (fileSession.introText && typeof fileSession.introText === "string" && fileSession.introText.trim()) {
      introText = fileSession.introText.trim();
    } else {
      const pDesc = (typeof fileSession.userContext === "string" ? fileSession.userContext : fileSession.userContext?.description) || "";
      const defaultIntro = t("report.overview_default_intro", {
        fileName,
        rows: rowsStr,
        cols: totalCols,
        defaultValue: isEn
          ? `The dataset ${fileName} contains ${rowsStr} rows and ${totalCols} columns. The data is ready for tracking key analytical metrics.`
          : `Tập dữ liệu ${fileName} gồm ${rowsStr} dòng và ${totalCols} cột. Dữ liệu đã sẵn sàng phục vụ cho việc theo dõi các chỉ số quan trọng.`,
      });
      introText = pDesc.trim() ? `${pDesc.trim()}\n\n${defaultIntro}` : defaultIntro;
    }

    blocks.push({
      type: "paragraph",
      text: introText,
    });
  }

  // 2. Key Findings Section (Điểm chính)
  if (effectiveIncluded.key_findings !== false) {
    blocks.push({
      type: "heading",
      level: 1,
      text: t("report.sec_key_findings", { defaultValue: isEn ? "Key Findings" : "Điểm chính" }),
    });

    if (fileSession.keyFindingsText && typeof fileSession.keyFindingsText === "string" && fileSession.keyFindingsText.trim()) {
      const lines = fileSession.keyFindingsText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.replace(/^[•\-\*]\s*/, ""));
      if (lines.length > 0) {
        blocks.push({
          type: "bullets",
          items: lines,
        });
      } else {
        blocks.push({
          type: "paragraph",
          text: fileSession.keyFindingsText.trim(),
        });
      }
    } else {
      const autoBullets = buildKeyFindings(charts, statSummary, null, lang);
      if (autoBullets && autoBullets.length > 0) {
        blocks.push({
          type: "bullets",
          items: autoBullets,
        });
      } else {
        blocks.push({
          type: "paragraph",
          text: t("report.key_findings_empty", {
            defaultValue: isEn
              ? "No key highlights found from the selected charts."
              : "Chưa có điểm nổi bật từ các biểu đồ đã chọn.",
          }),
          style: "muted",
        });
      }
    }
  }

  // 3. Methodology Section
  if (effectiveIncluded.methodology !== false) {
    blocks.push({
      type: "heading",
      level: 1,
      text: t("report.sec_methodology", { defaultValue: isEn ? "Methodology & Data Cleaning" : "Phương pháp & Làm sạch Dữ liệu" }),
    });

    const methodText = fileSession.methodologyText && fileSession.methodologyText.trim()
      ? fileSession.methodologyText.trim()
      : t("report.methodology_default", {
          defaultValue: isEn ? "Data retained as-is, no cleaning performed." : "Dữ liệu được giữ nguyên, không làm sạch.",
        });

    blocks.push({
      type: "paragraph",
      text: methodText,
    });
  }

  // 4. Detailed Analysis Section
  if (effectiveIncluded.detailed_analysis !== false) {
    blocks.push({
      type: "heading",
      level: 1,
      text: t("report.sec_detailed_analysis", { defaultValue: isEn ? "Detailed Analysis" : "Phân tích Chi tiết" }),
    });

    let figureCounter = 1;
    let tableCounter = 1;

    charts.forEach((chart, idx) => {
      const cid = String(chart.chart_id || chart.id || `chart_${idx}`);
      const colName = chart.column || chart.col;
      const stats = columnsStats[colName] || {};
      const chartSettings = settings?.[cid] ?? chart.settings ?? {};

      const isCorrPair = chart.type === "corr_pair";
      const isHeatmap = chart.type === "heatmap" || chart.display_type === "heatmap" || cid === "corr_heatmap";

      const effective = computeEffectiveChart(chart, stats, chartSettings, statSummary, t, lang);
      const displayType = effective.displayType || chart.display_type || chart.type;
      const effectiveData = effective.effectiveData || [];
      const isPie = displayType === "pie" || chart.type === "pie";

      let chartTitle = "";
      if (isCorrPair) {
        chartTitle = chart.user_title || `[${chart.letter_x || "X"}] ${chart.col_x} × [${chart.letter_y || "Y"}] ${chart.col_y}`;
      } else {
        chartTitle = chart.user_title || chart.title || chart.auto_title || `${t("visualize.chart_tab_title", { defaultValue: isEn ? "Chart" : "Biểu đồ" })} ${idx + 1}`;
      }

      // A) Correlation Heatmap
      if (isHeatmap) {
        // Chart subheading (Heading 2) for Correlation Heatmap section
        blocks.push({
          type: "heading",
          level: 2,
          text: chartTitle,
        });

        const corrV2 = chart.correlation_v2 || statSummary.correlation_v2;
        if (!corrV2 || !corrV2.columns || corrV2.columns.length < 2) {
          blocks.push({
            type: "paragraph",
            text: statSummary?.correlation_error || (isEn ? "Not enough numerical columns for correlation analysis." : "Dữ liệu không đủ cột dạng số để phân tích tương quan."),
            style: "muted",
          });
          return;
        }

        const method = chartSettings?.method || corrV2.default_method || "spearman";
        const threshold = chartSettings?.threshold ?? 0.5;
        const methodName = method === "pearson" ? "Pearson" : "Spearman";
        const formattedThreshold = threshold.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

        const colMap = new Map();
        (corrV2.columns || []).forEach((c) => colMap.set(c.name, c));

        const pairsMap = new Map();
        (corrV2.pairs || []).forEach((p) => {
          pairsMap.set(`${p.a}_${p.b}`, p);
        });

        const matchingPairs = (corrV2.pairs || [])
          .filter((p) => {
            const r = p[method];
            return r !== null && r !== undefined && !isNaN(r) && Math.abs(r) >= threshold;
          })
          .sort((p1, p2) => Math.abs(p2[method]) - Math.abs(p1[method]));

        const tablePairs = matchingPairs.slice(0, 8);
        const band = getCorrelationStrength(threshold, lang).toLowerCase();
        const strongest = matchingPairs[0] || null;
        const strongestColA = strongest ? colMap.get(strongest.a) || { name: strongest.a, letter: strongest.a } : null;
        const strongestColB = strongest ? colMap.get(strongest.b) || { name: strongest.b, letter: strongest.b } : null;
        const strongestR = strongest ? formatR(strongest[method], locale) : null;

        // Caption & Summary sentence
        let summarySentence = isEn
          ? `Method: ${methodName} · Threshold |r| ≥ ${formattedThreshold} · ${matchingPairs.length} pairs.`
          : `Phương pháp: ${methodName} · Ngưỡng |r| ≥ ${formattedThreshold} · ${matchingPairs.length} cặp.`;

        if (matchingPairs.length > 0 && strongest) {
          const sentence2 = isEn
            ? ` ${matchingPairs.length} column pairs are related at ${band} level or above (${methodName}, |r| ≥ ${formattedThreshold}). Strongest: [${strongestColA.letter || strongestColA.name}] ↔ [${strongestColB.letter || strongestColB.name}] (r = ${strongestR}).`
            : ` Có ${matchingPairs.length} cặp cột liên quan từ mức ${band} trở lên (${methodName}, |r| ≥ ${formattedThreshold}). Mạnh nhất: [${strongestColA.letter || strongestColA.name}] ↔ [${strongestColB.letter || strongestColB.name}] (r = ${strongestR}).`;
          summarySentence += sentence2;
        }

        blocks.push({
          type: "paragraph",
          text: summarySentence,
        });

        // Pairs Table (Bảng m.)
        if (tablePairs.length > 0) {
          const pairsTableCaption = formatTableCaption(
            tableCounter++,
            isEn ? "Strongest related column pairs" : "Các cặp cột liên quan mạnh nhất",
            lang
          );

          const pairsColumns = [
            { title: isEn ? "Column pair" : "Cặp cột", widthPct: 45 },
            { title: "r", widthPct: 15 },
            { title: isEn ? "Strength & Direction" : "Mức độ & Chiều", widthPct: 25 },
            { title: "n", widthPct: 15 },
          ];

          const pairsRows = tablePairs.map((p) => {
            const colA = colMap.get(p.a) || { name: p.a, letter: "A" };
            const colB = colMap.get(p.b) || { name: p.b, letter: "B" };
            const rVal = p[method];
            const absR = rVal !== null ? Math.abs(rVal) : 0;
            const isPositive = rVal !== null && rVal >= 0;
            const strengthText = getCorrelationStrength(absR, lang);
            const directionWord = isPositive
              ? (isEn ? "positive" : "cùng chiều")
              : (isEn ? "negative" : "ngược chiều");

            const pairLabel = `[${colA.letter}] ${truncateText(colA.name, 35)} ↔ [${colB.letter}] ${truncateText(colB.name, 35)}`;
            const rColor = toHexColor(rVal !== null && rVal < 0 ? effectivePalette.negative : effectivePalette.primary);

            return [
              { text: pairLabel, align: "left" },
              { text: formatR(rVal, locale), color: rColor, bold: true, align: "center" },
              { text: `${strengthText} · ${directionWord}`, align: "center" },
              { text: String(p.n ?? ""), align: "center" },
            ];
          });

          blocks.push({
            type: "table",
            caption: pairsTableCaption,
            columns: pairsColumns,
            rows: pairsRows,
          });
        }

        // Active matrix columns
        const activeNames = new Set();
        tablePairs.forEach((p) => {
          activeNames.add(p.a);
          activeNames.add(p.b);
        });
        const matrixCols = (corrV2.columns || []).filter((c) => activeNames.has(c.name)).slice(0, 12);

        // Compact Matrix Table
        if (matrixCols.length >= 2) {
          const matrixTableCaption = formatTableCaption(
            tableCounter++,
            isEn ? `Correlation matrix (${methodName})` : `Ma trận tương quan (${methodName})`,
            lang
          );

          const colPct = Math.floor(90 / matrixCols.length);
          const matrixColumns = [
            { title: "", widthPct: 10 },
            ...matrixCols.map((c) => ({ title: c.letter, widthPct: colPct })),
          ];

          const matrixRows = matrixCols.map((rowCol) => {
            const rowCells = [
              { text: rowCol.letter, bold: true, fill: "F9F9F8", align: "center" },
            ];

            matrixCols.forEach((colCol) => {
              if (rowCol.name === colCol.name) {
                rowCells.push({ text: "—", fill: "EAEAEA", color: "8C948D", align: "center" });
                return;
              }

              const pair = pairsMap.get(`${rowCol.name}_${colCol.name}`) || pairsMap.get(`${colCol.name}_${rowCol.name}`);
              const rVal = pair ? pair[method] : null;

              if (rVal === null || rVal === undefined || isNaN(rVal)) {
                rowCells.push({ text: "–", fill: "F5F5F4", color: "8C948D", align: "center" });
                return;
              }

              const cellStyle = getMatrixCellStyle(rVal, threshold, effectivePalette);
              const fillHex = toHexColor(cellStyle.backgroundColor, "F5F5F4");
              const textHex = toHexColor(cellStyle.color, "121A14");

              rowCells.push({
                text: formatR(rVal, locale),
                fill: fillHex,
                color: textHex,
                bold: cellStyle.fontWeight === 600,
                align: "center",
              });
            });

            return rowCells;
          });

          blocks.push({
            type: "table",
            caption: matrixTableCaption,
            columns: matrixColumns,
            rows: matrixRows,
          });

          // Letter key 2-column table
          const keyColumns = [
            { title: isEn ? "Code" : "Ký hiệu", widthPct: 15 },
            { title: isEn ? "Column name" : "Tên cột", widthPct: 85 },
          ];
          const keyRows = matrixCols.map((c) => [
            { text: `[${c.letter}]`, bold: true, color: toHexColor(effectivePalette.primary), align: "center" },
            { text: c.name, align: "left" },
          ]);

          blocks.push({
            type: "table",
            caption: isEn ? "Column reference key" : "Bảng chú giải ký hiệu cột",
            columns: keyColumns,
            rows: keyRows,
          });
        }

        // Causation note
        blocks.push({
          type: "note",
          text: t("visualize.corr_causation_note", {
            defaultValue: isEn
              ? "* Correlation reflects association, not direct causation. Consider external factors."
              : "* Tương quan phản ánh mối liên hệ thống kê, không khẳng định quan hệ nhân quả trực tiếp.",
          }),
        });

        return;
      }

      // B) Correlation Pair (Discrete Rating Scale Grid Mode)
      if (isCorrPair && chart.payload?.mode === "grid") {
        blocks.push({
          type: "heading",
          level: 2,
          text: chartTitle,
        });

        const gridData = chart.payload;
        const sortedY = [...(gridData.y_levels || [])].sort((a, b) => b - a);
        const sortedX = [...(gridData.x_levels || [])].sort((a, b) => a - b);
        const maxCount = Math.max(...(gridData.grid || []).map((c) => c.count || 0), 1);
        const countMap = new Map();
        (gridData.grid || []).forEach((c) => countMap.set(`${c.x}_${c.y}`, c.count));

        const gridCaption = formatTableCaption(
          tableCounter++,
          isEn
            ? `Frequency grid: [${chart.letter_x || "X"}] ${chart.col_x} × [${chart.letter_y || "Y"}] ${chart.col_y}`
            : `Bảng phân bố tần suất: [${chart.letter_x || "X"}] ${chart.col_x} × [${chart.letter_y || "Y"}] ${chart.col_y}`,
          lang
        );

        const colWidthPct = Math.floor(85 / Math.max(sortedX.length, 1));
        const gridColumns = [
          { title: `Y \\ X`, widthPct: 15 },
          ...sortedX.map((x) => ({ title: String(x), widthPct: colWidthPct })),
        ];

        const [pR, pG, pB] = hexToRgb(effectivePalette.primary);

        const gridRows = sortedY.map((yVal) => {
          const rowCells = [
            { text: String(yVal), bold: true, fill: "F9F9F8", align: "center" },
          ];

          sortedX.forEach((xVal) => {
            const cnt = countMap.get(`${xVal}_${yVal}`) ?? 0;
            const ratio = cnt / maxCount;
            const isZero = cnt === 0;

            let fillHex = "FFFFFF";
            let colorHex = "87938B";

            if (!isZero) {
              const r = Math.round(255 + ratio * (pR - 255));
              const g = Math.round(255 + ratio * (pG - 255));
              const b = Math.round(255 + ratio * (pB - 255));
              fillHex = ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
              colorHex = ratio > 0.55 ? "FFFFFF" : toHexColor(effectivePalette.primary);
            }

            rowCells.push({
              text: String(cnt),
              fill: fillHex,
              color: colorHex,
              bold: !isZero,
              align: "center",
            });
          });

          return rowCells;
        });

        blocks.push({
          type: "table",
          caption: gridCaption,
          columns: gridColumns,
          rows: gridRows,
        });

        return;
      }

      // C) All Standard Charts & Scatter Points Mode -> Render Figure Block
      const figureCaption = formatFigureTitle(figureCounter++, chartTitle, lang);

      // Auto insights bullets
      const autoInsights = stats.auto_insights || [];
      const insightTexts = autoInsights
        .map((ins) => formatInsight(ins, t, lang))
        .filter(Boolean);

      // AI explanation paragraph
      const aiExpl = chart.ai_explanation || fileSession.chartExplanations?.[cid]?.content;
      const hasAiExpl = Boolean(aiExpl && aiExpl.trim());

      // Print rule matching:
      // Full if: has an AI explanation, or is points-mode corr_pair, or pie with legend > 6 rows, or categorical with > 8 bars; otherwise half.
      const isPointsCorrPair = Boolean(isCorrPair && chart.payload?.mode !== "grid");
      const isLargePie = Boolean(isPie && effectiveData && effectiveData.length > 6);
      const isLargeBar = Boolean(displayType === "bar" && effectiveData && effectiveData.length > 8);

      const isFullWidth = Boolean(hasAiExpl || isPointsCorrPair || isLargePie || isLargeBar);

      blocks.push({
        type: "figure",
        chartId: cid,
        title: chartTitle,
        caption: figureCaption,
        width: isFullWidth ? "full" : "half",
        widthCm: isFullWidth ? 15 : 7.8,
        insights: insightTexts,
        aiExplanation: hasAiExpl ? aiExpl.trim() : null,
      });
    });
  }

  // 5. Appendix: Data Dictionary Section
  if (effectiveIncluded.appendix !== false) {
    blocks.push({
      type: "heading",
      level: 1,
      text: t("report.sec_appendix", { defaultValue: isEn ? "Appendix: Data Dictionary" : "Phụ lục: Từ điển dữ liệu" }),
    });

    const colsMap = statSummary.columns || {};
    let colNames = [];
    if (fileSession.profileData?.columns && Array.isArray(fileSession.profileData.columns)) {
      colNames = fileSession.profileData.columns
        .map((c) => (typeof c === "string" ? c : c?.name))
        .filter((n) => n && colsMap[n]);
      Object.keys(colsMap).forEach((col) => {
        if (!colNames.includes(col)) colNames.push(col);
      });
    } else {
      colNames = Object.keys(colsMap);
    }

    const dictColumns = [
      { title: isEn ? "Col" : "Cột", widthPct: 8 },
      { title: isEn ? "Column name" : "Tên cột", widthPct: 34 },
      { title: isEn ? "Type" : "Kiểu dữ liệu", widthPct: 16 },
      { title: isEn ? "Missing %" : "% trống", widthPct: 12 },
      { title: isEn ? "Unique" : "Số giá trị", widthPct: 12 },
      { title: isEn ? "Notes" : "Ghi chú", widthPct: 18 },
    ];

    const dictRows = colNames.map((colName, cIdx) => {
      const colStats = colsMap[colName] || {};
      const letter = colStats.letter || String.fromCharCode(65 + (cIdx % 26));

      let typeLabel = isEn ? "Text" : "Văn bản";
      const dtype = colStats.dtype;
      const isScale = colStats.is_scale === true || (dtype === "numeric" && colStats.is_discrete && colStats.is_scale);
      if (dtype === "numeric") {
        if (isScale) {
          typeLabel = isEn ? "Scale" : "Thang điểm";
        } else if (colStats.is_discrete) {
          typeLabel = isEn ? "Discrete" : "Số rời rạc";
        } else {
          typeLabel = isEn ? "Numeric" : "Số";
        }
      } else if (dtype === "categorical") {
        typeLabel = isEn ? "Categorical" : "Danh mục";
      } else if (dtype === "multiple_choice") {
        typeLabel = isEn ? "Multiple choice" : "Nhiều lựa chọn";
      } else if (dtype === "datetime") {
        typeLabel = isEn ? "Datetime" : "Thời gian";
      }

      let note = "";
      if (isScale) {
        note = isEn
          ? `Scale ${colStats.scale_min ?? 1}–${colStats.scale_max ?? 5}`
          : `Thang ${colStats.scale_min ?? 1}–${colStats.scale_max ?? 5}`;
      } else if (colStats.skip_chart) {
        let reason = colStats.skip_reason || "";
        if (colStats.skip_key === "missing_high") {
          reason = isEn ? "High missing rate (≥ 40%)" : "Tỷ lệ trống cao (≥ 40%)";
        } else if (colStats.skip_key === "single_value") {
          reason = isEn ? "Single unique value" : "Chỉ có 1 giá trị";
        } else if (colStats.skip_key === "free_text") {
          reason = isEn ? "Free text" : "Văn bản tự do";
        }
        note = `${isEn ? "Not charted: " : "Không vẽ biểu đồ: "}${reason}`;
      }

      return [
        { text: letter, bold: true, color: toHexColor(effectivePalette.primary), align: "center" },
        { text: colName, align: "left" },
        { text: typeLabel, align: "left" },
        { text: `${colStats.missing_pct ?? 0}%`, align: "right" },
        { text: Number(colStats.unique_count ?? 0).toLocaleString(locale), align: "right" },
        { text: note || "—", align: "left" },
      ];
    });

    blocks.push({
      type: "table",
      caption: isEn ? "Dataset column dictionary" : "Từ điển dữ liệu tập tin",
      columns: dictColumns,
      rows: dictRows,
    });
  }

  return {
    meta: {
      fileName,
      rows: totalRows,
      cols: totalCols,
      date: defaultDateStr,
      plan,
      showBranding: plan !== "pro",
    },
    cover: coverModel,
    toc: tocEnabled,
    blocks,
  };
}
