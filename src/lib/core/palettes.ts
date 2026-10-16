import type { Shape } from "./ir";

export type PaletteId = "mono" | "tint" | "okabe-ito" | "pastel" | "bold" | "grayscale";

export type ShapeColors = { fill: string; stroke: string; text: string };
export type Palette = {
  id: PaletteId;
  name: string;
  canvas: string;
  ink: string;
  accent: string;
  shapes: Record<Shape, ShapeColors>;
  groupTints: string[];
};

const P = (
  fill: string,
  stroke: string,
  text = "#12161B",
): ShapeColors => ({ fill, stroke, text });

export const PALETTES: Record<PaletteId, Palette> = {
  mono: {
    id: "mono",
    name: "Black and white",
    canvas: "#FFFFFF",
    ink: "#12161B",
    accent: "#1D3B5C",
    shapes: {
      process: P("#FFFFFF", "#12161B"),
      decision: P("#FFFFFF", "#12161B"),
      terminator: P("#FFFFFF", "#12161B"),
      data: P("#FFFFFF", "#12161B"),
      document: P("#FFFFFF", "#12161B"),
      database: P("#FFFFFF", "#12161B"),
    },
    groupTints: ["#FFFFFF"],
  },

  grayscale: {
    id: "grayscale",
    name: "Grayscale",
    canvas: "#FFFFFF",
    ink: "#12161B",
    accent: "#3A444E",
    shapes: {
      process: P("#F2F4F6", "#3A444E"),
      decision: P("#E6E9ED", "#3A444E"),
      terminator: P("#DDE1E6", "#3A444E"),
      data: P("#EDEFF2", "#3A444E"),
      document: P("#F5F5F4", "#3A444E"),
      database: P("#E9EEF2", "#3A444E"),
    },
    groupTints: ["#F7F8F9", "#EFF1F3", "#E7EAED"],
  },

  tint: {
    id: "tint",
    name: "Light tints",
    canvas: "#FFFFFF",
    ink: "#12161B",
    accent: "#1D3B5C",
    shapes: {
      process: P("#EAF0F6", "#2B4A6B"),
      decision: P("#FBF3DC", "#8A6B1A"),
      terminator: P("#E4F1E9", "#2E6B45"),
      data: P("#F2E9F1", "#6E3F68"),
      document: P("#F4F4F1", "#4A4A47"),
      database: P("#E8EEF1", "#3A5565"),
    },
    groupTints: ["#F4F7FA", "#EEF3F7", "#E8EEF4"],
  },

  "okabe-ito": {
    id: "okabe-ito",
    name: "Colorblind-safe",
    canvas: "#FFFFFF",
    ink: "#000000",
    accent: "#0072B2",
    shapes: {
      process: P("#DCE9F2", "#0072B2"),
      decision: P("#FCE9CC", "#E69F00"),
      terminator: P("#D9EFE3", "#009E73"),
      data: P("#F7DDE9", "#CC79A7"),
      document: P("#F0EEF9", "#56B4E9"),
      database: P("#F0F0F0", "#000000"),
    },
    groupTints: ["#F4F8FB", "#FBF6EE", "#F5F0F8"],
  },

  pastel: {
    id: "pastel",
    name: "Pastel",
    canvas: "#FFFFFF",
    ink: "#2B2B2B",
    accent: "#5B4B8A",
    shapes: {
      process: P("#DCE6F5", "#4F6C9F"),
      decision: P("#FBE5C9", "#A87930"),
      terminator: P("#D7EFD9", "#4C8B58"),
      data: P("#F1DCE8", "#9E5A85"),
      document: P("#EFEFEA", "#7A7A70"),
      database: P("#DDE8EE", "#4F6C7C"),
    },
    groupTints: ["#F3F6FB", "#FBF5EC", "#F6EEF5"],
  },

  bold: {
    id: "bold",
    name: "Bold (presentations)",
    canvas: "#FFFFFF",
    ink: "#0A0A0A",
    accent: "#C1272D",
    shapes: {
      process: P("#CBDDF0", "#1F4E79"),
      decision: P("#FCE3A5", "#8A5A00"),
      terminator: P("#C9E8D2", "#1E6B3A"),
      data: P("#EAC9E6", "#6E1F6A"),
      document: P("#E5E5DC", "#3A3A33"),
      database: P("#D0DDE4", "#1F4E5F"),
    },
    groupTints: ["#EDF3FA", "#FCF3DC", "#F3E7F2"],
  },
};

export const DEFAULT_PALETTE_ID: PaletteId = "mono";

export const getPalette = (id: PaletteId | string | undefined): Palette =>
  PALETTES[(id as PaletteId) ?? DEFAULT_PALETTE_ID] ?? PALETTES.mono;

export const PALETTE_LIST: Palette[] = Object.values(PALETTES);

export const groupTint = (p: Palette, i: number) =>
  p.groupTints[i % p.groupTints.length];

/** Curated per-shape swatch list for the color picker in the inspector. */
export const SWATCHES: { name: string; fill: string; stroke: string }[] = [
  { name: "Default", fill: "", stroke: "" },
  { name: "Blue", fill: "#EAF0F6", stroke: "#2B4A6B" },
  { name: "Green", fill: "#E4F1E9", stroke: "#2E6B45" },
  { name: "Amber", fill: "#FBF3DC", stroke: "#8A6B1A" },
  { name: "Plum", fill: "#F2E9F1", stroke: "#6E3F68" },
  { name: "Slate", fill: "#EEF1F4", stroke: "#3A444E" },
  { name: "Rose", fill: "#FBE6EC", stroke: "#9C3D5A" },
  { name: "Mint", fill: "#E1F1EC", stroke: "#2F7D6B" },
  { name: "Sand", fill: "#F4F0E6", stroke: "#8B7A4C" },
  { name: "White", fill: "#FFFFFF", stroke: "#12161B" },
];