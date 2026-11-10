/**
 * Pure utility functions for chart data transformation and sorting.
 * Shared between Visualize and Report pages.
 */

export function parseSortKey(label) {
  if (!label) return { hasNum: false, num: 0, text: "" };
  const str = String(label).trim();
  const lower = str.toLowerCase();
  const match = str.match(/\d+(?:[.,]\d+)?/);
  if (match) {
    let num = parseFloat(match[0].replace(",", "."));
    if (lower.startsWith("dưới") || lower.startsWith("under") || lower.startsWith("<")) {
      num -= 0.5;
    }
    return { hasNum: true, num, text: str };
  }
  return { hasNum: false, num: Infinity, text: str };
}

export function sortCategories(items, sortMode, locale = "vi-VN") {
  if (sortMode !== "by_value") {
    return [...items].sort((a, b) => (b.count || 0) - (a.count || 0));
  }

  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });

  return [...items].sort((a, b) => {
    // "__other__" is always last
    if (a.value === "__other__") return 1;
    if (b.value === "__other__") return -1;

    const keyA = parseSortKey(a.value);
    const keyB = parseSortKey(b.value);

    // Both have numbers
    if (keyA.hasNum && keyB.hasNum) {
      if (keyA.num !== keyB.num) return keyA.num - keyB.num;
      return (b.count || 0) - (a.count || 0);
    }

    // A has number, B doesn't -> A comes first
    if (keyA.hasNum && !keyB.hasNum) return -1;
    // B has number, A doesn't -> B comes first
    if (!keyA.hasNum && keyB.hasNum) return 1;

    // Neither has number -> A to Z using Intl.Collator
    const textComp = collator.compare(keyA.text, keyB.text);
    if (textComp !== 0) return textComp;

    // Ties keep count order
    return (b.count || 0) - (a.count || 0);
  });
}

/**
 * Generate monochromatic shades for ordered data (e.g. Likert scales)
 * from lightest (lowest level) to darkest (highest level, palette.primary).
 */
export function getOrderedShades(primaryHex = "#1B4324", n = 5) {
  if (n <= 0) return [];
  if (n === 1) return [primaryHex];

  let cleanHex = String(primaryHex || "#1B4324").replace("#", "");
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split("").map((c) => c + c).join("");
  }
  const baseR = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const baseG = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const baseB = parseInt(cleanHex.substring(4, 6), 16) || 0;

  const whiteR = 255;
  const whiteG = 255;
  const whiteB = 255;

  const shades = [];
  for (let i = 0; i < n; i++) {
    const t = 0.22 + (0.78 * i) / (n - 1);
    const r = Math.round(whiteR + (baseR - whiteR) * t);
    const g = Math.round(whiteG + (baseG - whiteG) * t);
    const b = Math.round(whiteB + (baseB - whiteB) * t);
    const hex = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
    shades.push(hex.toUpperCase());
  }
  return shades;
}

export function getOrderedGreenShades(n) {
  return getOrderedShades("#1B4324", n);
}

export function computeEffectiveChart(chart, stats, settings = {}, summary, t, currentLang) {
  const locale = currentLang?.startsWith("en") ? "en-US" : "vi-VN";

  // 1. Continuous numeric
  if (stats?.dtype === "numeric" && !stats?.is_discrete) {
    const canBox = Boolean(stats?.box);
    const displayType = (settings.display_type === "box" && canBox) ? "box" : "histogram";
    return {
      displayType,
      effectiveData: chart?.data || stats?.distribution_bins || [],
      isCapped200: false,
      calculatedBarHeight: 260,
      canBox,
      hasSettings: canBox,
    };
  }

  // 2. Discrete numeric
  if (stats?.is_discrete) {
    const isScale = stats?.is_scale;
    const baseBins = stats?.distribution_bins || chart?.data || [];
    const displayType = settings.display_type === "pie" ? "pie" : "bar";

    if (displayType === "pie") {
      const pieData = baseBins.filter(d => (d.count ?? 0) > 0);
      let effectiveData = pieData;
      if (isScale) {
        if (pieData.length > 6) {
          const top5 = pieData.slice(0, 5);
          const rest = pieData.slice(5);
          const sumRestCount = rest.reduce((s, x) => s + (x.count || 0), 0);
          const sumRestPct = rest.reduce((s, x) => s + (x.pct || 0), 0);
          const otherItem = {
            value: "__other__",
            count: sumRestCount,
            pct: Math.round(sumRestPct * 10) / 10,
            other_n: rest.length,
            hidden_items: rest,
          };
          effectiveData = [...top5, otherItem];
        }
      } else {
        const sortedByCount = [...pieData].sort((a, b) => (b.count || 0) - (a.count || 0));
        if (sortedByCount.length > 6) {
          const top5 = sortedByCount.slice(0, 5);
          const rest = sortedByCount.slice(5);
          const sumRestCount = rest.reduce((s, x) => s + (x.count || 0), 0);
          const sumRestPct = rest.reduce((s, x) => s + (x.pct || 0), 0);
          const otherItem = {
            value: "__other__",
            count: sumRestCount,
            pct: Math.round(sumRestPct * 10) / 10,
            other_n: rest.length,
            hidden_items: rest,
          };
          effectiveData = [...top5, otherItem];
        } else {
          effectiveData = sortedByCount;
        }
      }

      return {
        displayType: "pie",
        effectiveData,
        isCapped200: false,
        calculatedBarHeight: 260,
        hasSettings: true,
      };
    }

    // displayType === "bar"
    let effectiveData = baseBins;
    if (settings.hide_zero && isScale) {
      effectiveData = baseBins.filter(d => (d.count ?? 0) > 0);
    }

    return {
      displayType: "histogram",
      effectiveData,
      isCapped200: false,
      calculatedBarHeight: 260,
      hasSettings: true,
    };
  }

  // 3. Categorical / Multiple choice
  if (stats?.dtype === "categorical" || stats?.dtype === "multiple_choice" || chart?.type === "bar") {
    const isMultipleChoice = stats?.dtype === "multiple_choice";
    const rawValues = (stats?.all_values && stats.all_values.length > 0)
      ? stats.all_values
      : (stats?.top_values || chart?.data || []);
    const cleanValues = rawValues.filter(d => d.value !== "__other__");
    const uniqueCount = stats?.unique_count || cleanValues.length;
    const totalRespondents = stats?.respondents || summary?.shape?.[0] || cleanValues.reduce((s, x) => s + (x.count || 0), 0) || 1;

    const displayType = (!isMultipleChoice && settings.display_type === "pie") ? "pie" : "bar";

    if (displayType === "pie") {
      const sortedByCount = [...cleanValues].sort((a, b) => (b.count || 0) - (a.count || 0));
      let effectiveData = sortedByCount;
      if (sortedByCount.length > 6) {
        const top5 = sortedByCount.slice(0, 5);
        const rest = sortedByCount.slice(5);
        const sumCount = rest.reduce((s, x) => s + (x.count || 0), 0);
        const sumPct = rest.reduce((s, x) => s + (x.pct || 0), 0);
        const otherItem = {
          value: "__other__",
          count: sumCount,
          pct: Math.round(sumPct * 10) / 10,
          other_n: rest.length,
          hidden_items: rest,
        };
        effectiveData = [...top5, otherItem];
      }
      return {
        displayType: "pie",
        effectiveData,
        isCapped200: false,
        calculatedBarHeight: 280,
        hasSettings: true,
      };
    }

    // displayType === "bar"
    const topN = settings.top_n || "auto";
    let limit = Infinity;
    if (topN === "auto") {
      limit = uniqueCount <= 15 ? Infinity : 10;
    } else if (topN === 10) {
      limit = 10;
    } else if (topN === 15) {
      limit = 15;
    } else if (topN === "all") {
      limit = Infinity;
    }

    let displayedItems = cleanValues;
    let otherItem = null;
    if (cleanValues.length > limit && limit !== Infinity) {
      displayedItems = cleanValues.slice(0, limit);
      const rest = cleanValues.slice(limit);
      const sumCount = rest.reduce((s, x) => s + (x.count || 0), 0);
      const sumPct = isMultipleChoice
        ? Math.round((sumCount / totalRespondents) * 1000) / 10
        : Math.round(rest.reduce((s, x) => s + (x.pct || 0), 0) * 10) / 10;
      otherItem = {
        value: "__other__",
        count: sumCount,
        pct: sumPct,
        other_n: rest.length,
        hidden_items: rest,
      };
    }

    if (!isMultipleChoice && settings.sort === "by_value") {
      displayedItems = sortCategories(displayedItems, "by_value", locale);
    } else {
      displayedItems = sortCategories(displayedItems, "by_count", locale);
    }

    const effectiveData = otherItem ? [...displayedItems, otherItem] : displayedItems;
    const isCapped200 = topN === "all" && (uniqueCount > 200 || cleanValues.length >= 200);
    const rowCount = effectiveData.length;
    const calculatedBarHeight = Math.max(220, rowCount * 26 + 40);

    return {
      displayType: "bar",
      effectiveData,
      isCapped200,
      calculatedBarHeight,
      hasSettings: true,
    };
  }

  // 4. Fallback (Heatmap, Line, etc.)
  return {
    displayType: chart?.type,
    effectiveData: chart?.data || [],
    isCapped200: false,
    calculatedBarHeight: 260,
    hasSettings: false,
  };
}

export * from "./reportNumbering";


