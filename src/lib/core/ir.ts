import { z } from "zod";
export const SHAPES = ["process", "decision", "terminator", "data", "document", "database"] as const;
export const METHODS = ["quantitative", "qualitative", "mixed", "prisma", "consort", "dsr", "survey", "experimental", "custom"] as const;
export const DENSITIES = ["compact", "balanced", "spacious"] as const;
export const PALETTE_IDS = ["mono", "grayscale", "tint", "okabe-ito", "pastel", "bold"] as const;
export const FLOW_DIRECTIONS = ["auto", "tb", "lr"] as const;

const id = z.string().min(1).max(40);
const hex = z.string().regex(/^#[0-9A-Fa-f]{3,8}$/);

export const NodeS = z.object({
  id,
  label: z.string().min(1).max(80),
  shape: z.enum(SHAPES),
  groupId: id.optional(),
  notes: z.string().max(300).optional(),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  fill: hex.optional(),
  stroke: hex.optional(),
  text: hex.optional(),
});

export const EdgeS = z.object({
  id,
  source: id,
  target: id,
  label: z.string().max(40).optional(),
  dashed: z.boolean().optional(),
});

export const GroupS = z.object({
  id,
  label: z.string().min(1).max(60),
  color: hex.optional(),
});

export const IRSchema = z.object({
  version: z.union([z.literal("1.0"), z.literal("1.1")]),
  meta: z.object({
    title: z.string().max(120),
    methodology: z.enum(METHODS),
    caption: z.string().max(300).optional(),
    paletteId: z.enum(PALETTE_IDS).optional(),
    density: z.enum(DENSITIES).optional(),
    flowDirection: z.enum(FLOW_DIRECTIONS).optional(),
  }),
  groups: z.array(GroupS).max(8),
  nodes: z.array(NodeS).min(1).max(60),
  edges: z.array(EdgeS).max(120),
});

export type IR = z.infer<typeof IRSchema>;
export type N = IR["nodes"][number];
export type E = IR["edges"][number];
export type Shape = (typeof SHAPES)[number];
export type Method = (typeof METHODS)[number];
export type Density = (typeof DENSITIES)[number];
export type PaletteId = (typeof PALETTE_IDS)[number];
export type FlowDirection = (typeof FLOW_DIRECTIONS)[number];

export const emptyIR = (): IR => ({
  version: "1.1",
  meta: {
    title: "Untitled flowchart",
    methodology: "custom",
    paletteId: "mono",
    density: "balanced",
    flowDirection: "tb", // Default changed to Top-to-Bottom
  },
  groups: [],
  nodes: [{ id: "n1", label: "Start", shape: "terminator" }],
  edges: [],
});