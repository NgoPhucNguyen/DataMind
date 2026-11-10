import React, { createContext, useContext, useMemo } from "react";
import { useFileSession } from "./FileSessionContext";
import { getPalette, CHART_PALETTES } from "../utils/chartPalettes";

export const BASE_CHART_THEME = {
  fontFamily: "'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
  textMuted: "#626C65",
  textDark: "#121A14",
  borderGrid: "#EAEAEA",
  borderCard: "#E5E5E3",
  tooltipCursor: "rgba(0,0,0,0.02)",
  tickColor: "#3F4742",
  tickFontWeight: 500,
  valueColor: "#1F2923",
  valueMutedColor: "#4B5563",
  valueFontWeight: 600,
};

export const DEFAULT_CHART_THEME = {
  ...BASE_CHART_THEME,
  paletteId: CHART_PALETTES.datamind.id,
  paletteName: CHART_PALETTES.datamind.name,
  primary: CHART_PALETTES.datamind.primary,
  categorical: CHART_PALETTES.datamind.categorical,
  piePalette: CHART_PALETTES.datamind.categorical,
  negative: CHART_PALETTES.datamind.negative,
  neutral: CHART_PALETTES.datamind.neutral,
  other: CHART_PALETTES.datamind.other,
  otherCategory: CHART_PALETTES.datamind.other,
};

export const ChartThemeContext = createContext(DEFAULT_CHART_THEME);

export function ChartThemeProvider({ paletteId, children }) {
  let fileSessionPaletteId = null;
  try {
    const session = useFileSession();
    fileSessionPaletteId = session?.fileSession?.chartPalette;
  } catch {
    // Graceful fallback if used outside of FileSessionProvider
  }

  const effectiveId = paletteId || fileSessionPaletteId || "datamind";
  const palette = useMemo(() => getPalette(effectiveId), [effectiveId]);

  const theme = useMemo(() => ({
    ...BASE_CHART_THEME,
    paletteId: palette.id,
    paletteName: palette.name,
    primary: palette.primary,
    categorical: palette.categorical,
    piePalette: palette.categorical,
    negative: palette.negative,
    neutral: palette.neutral,
    other: palette.other,
    otherCategory: palette.other,
  }), [palette]);

  return (
    <ChartThemeContext.Provider value={theme}>
      {children}
    </ChartThemeContext.Provider>
  );
}

export function useChartTheme() {
  const context = useContext(ChartThemeContext);
  return context || DEFAULT_CHART_THEME;
}

