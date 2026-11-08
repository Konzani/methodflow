export type PageSize = "a4" | "a3" | "a5" | "letter" | "legal" | "custom";
export type Orientation = "portrait" | "landscape";
export type FitMode = "fit" | "actual";
export type FontStyle = "sans" | "serif";

export type PageSettings = {
  size: PageSize;
  custom?: { w: number; h: number; unit: "mm" | "in" };
  orientation: Orientation;
  margin: number;
  fit: FitMode;
  dpi: number;
  font: FontStyle;
  theme: "mono" | "tint";
};

export const DEFAULT_PAGE: PageSettings = {
  size: "a4",
  orientation: "portrait",
  margin: 20,
  fit: "fit",
  dpi: 300,
  font: "sans",
  theme: "mono",
};

const MM: Record<Exclude<PageSize, "custom">, [number, number]> = {
  a4: [210, 297],
  a3: [297, 420],
  a5: [148, 210],
  letter: [215.9, 279.4],
  legal: [215.9, 355.6],
};

export function pageSizeMM(p: PageSettings): { w: number; h: number } {
  let w: number, h: number;
  if (p.size === "custom" && p.custom) {
    const m = p.custom.unit === "in" ? 25.4 : 1;
    w = p.custom.w * m;
    h = p.custom.h * m;
  } else if (p.size === "custom") {
    w = 210; h = 297;
  } else {
    [w, h] = MM[p.size];
  }
  return p.orientation === "landscape" ? { w: h, h: w } : { w, h };
}

export function computeFit(
  svgUnitsW: number,
  svgUnitsH: number,
  page: PageSettings,
  reserveMM = 0,
): { scale: number; pxW: number; pxH: number; mmW: number; mmH: number; overflow: boolean } {
  const pageMM = pageSizeMM(page);
  const contentMM = {
    w: pageMM.w - 2 * page.margin,
    h: pageMM.h - 2 * page.margin - reserveMM,
  };
  const svgMMW = svgUnitsW * 25.4 / 96;
  const svgMMH = svgUnitsH * 25.4 / 96;

  let scale = page.fit === "actual" ? 1 : Math.min(contentMM.w / svgMMW, contentMM.h / svgMMH);
  if (page.fit === "fit") scale = Math.min(scale, 1);

  const mmW = svgMMW * scale;
  const mmH = svgMMH * scale;
  const pxPerMM = page.dpi / 25.4;
  const pxW = Math.round(mmW * pxPerMM);
  const pxH = Math.round(mmH * pxPerMM);
  const overflow = mmW > contentMM.w || mmH > contentMM.h;
  return { scale, pxW, pxH, mmW, mmH, overflow };
}

export function loadPageSettings(): PageSettings {
  if (typeof window === "undefined") return DEFAULT_PAGE;
  try {
    const raw = localStorage.getItem("mf:page-settings");
    if (!raw) return DEFAULT_PAGE;
    return { ...DEFAULT_PAGE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PAGE;
  }
}

export function savePageSettings(p: PageSettings) {
  try { localStorage.setItem("mf:page-settings", JSON.stringify(p)); } catch {}
}