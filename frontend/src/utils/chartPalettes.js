/**
 * Chart color palette definitions for DataMind.
 * Provides unified color schemes for all charts (Visualize, Report, Exports).
 */

export const CHART_PALETTES = {
  datamind: {
    id: "datamind",
    name: {
      vi: "DataMind",
      en: "DataMind",
    },
    primary: "#1B4324",
    categorical: ["#1B4324", "#2E6F65", "#B87A28", "#3B5B78", "#A24936", "#5B7038", "#6B4C6E", "#8C7355"],
    negative: "#A24936",
    neutral: "#ECEEEC",
    other: "#9CA3AF",
  },
  ocean: {
    id: "ocean",
    name: {
      vi: "Đại dương",
      en: "Ocean",
    },
    primary: "#1F4E79",
    categorical: ["#1F4E79", "#2A9D8F", "#E9A23B", "#6C5B7B", "#C8553D", "#4C956C", "#8E7DBE", "#A0785A"],
    negative: "#C8553D",
    neutral: "#ECEEEC",
    other: "#9CA3AF",
  },
  warm: {
    id: "warm",
    name: {
      vi: "Ấm",
      en: "Warm",
    },
    primary: "#8C3B1E",
    categorical: ["#8C3B1E", "#D08C2E", "#6B705C", "#B5523B", "#3D5A80", "#A68A64", "#7F4F24", "#CB997E"],
    negative: "#3D5A80",
    neutral: "#ECEEEC",
    other: "#9CA3AF",
  },
  colorblind: {
    id: "colorblind",
    name: {
      vi: "Dễ phân biệt (mù màu)",
      en: "Colorblind-friendly",
    },
    primary: "#0072B2",
    categorical: ["#0072B2", "#E69F00", "#009E73", "#CC79A7", "#56B4E9", "#D55E00", "#000000", "#F0E442"],
    negative: "#D55E00",
    neutral: "#ECEEEC",
    other: "#9CA3AF",
  },
  print: {
    id: "print",
    name: {
      vi: "Đen trắng (in ấn)",
      en: "Grayscale (print)",
    },
    primary: "#222222",
    categorical: ["#222222", "#555555", "#888888", "#AAAAAA", "#3A3A3A", "#707070", "#9A9A9A", "#C4C4C4"],
    negative: "#6B6B6B",
    neutral: "#ECEEEC",
    other: "#9CA3AF",
  },
};

export const PALETTE_LIST = [
  CHART_PALETTES.datamind,
  CHART_PALETTES.ocean,
  CHART_PALETTES.warm,
  CHART_PALETTES.colorblind,
  CHART_PALETTES.print,
];

export function getPalette(paletteId) {
  return CHART_PALETTES[paletteId] || CHART_PALETTES.datamind;
}

