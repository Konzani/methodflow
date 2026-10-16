"use client";
import type { IR } from "@/lib/core/ir";
import { toSVG } from "./svg";
import { computeFit, pageSizeMM, type PageSettings } from "./page";

export const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "flowchart";

export function download(b: Blob, name: string) {
  const u = URL.createObjectURL(b);
  const a = document.createElement("a");
  a.href = u;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 2000);
}

export async function copy(t: string) {
  try {
    await navigator.clipboard.writeText(t);
    return true;
  } catch {
    const a = document.createElement("textarea");
    a.value = t;
    a.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(a);
    a.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch {}
    a.remove();
    return ok;
  }
}

async function svgToPngBlob(svg: string, pxW: number, pxH: number, bg = "#fff"): Promise<Blob> {
  const sized = svg.replace(
    /<svg\b([^>]*?)width="[^"]*"\s+height="[^"]*"/,
    `<svg$1width="${pxW}" height="${pxH}"`,
  );
  const url = URL.createObjectURL(new Blob([sized], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = pxW;
    c.height = pxH;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("canvas 2d not available");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, pxW, pxH);
    ctx.drawImage(img, 0, 0, pxW, pxH);
    return await new Promise<Blob>((res, rej) =>
      c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/png"),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

const dataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const f = new FileReader();
    f.onload = () => res(String(f.result));
    f.onerror = () => rej(f.error);
    f.readAsDataURL(b);
  });

export async function toPng(ir: IR, page: PageSettings) {
  const { svg, w, h } = toSVG(ir, page.theme, page.font);
  const fit = computeFit(w, h, page);
  const blob = await svgToPngBlob(svg, fit.pxW, fit.pxH);
  return { blob, ...fit, w, h };
}

export async function toPdf(ir: IR, page: PageSettings) {
  const { svg, w, h } = toSVG(ir, page.theme, page.font);
  const fit = computeFit(w, h, page);
  const png = await svgToPngBlob(svg, fit.pxW, fit.pxH);
  const { jsPDF } = await import("jspdf");
  const dims = pageSizeMM(page);
  const doc = new jsPDF({
    orientation: page.orientation,
    unit: "mm",
    format: [dims.w, dims.h],
  });
  const x = (dims.w - fit.mmW) / 2;
  const y = (dims.h - fit.mmH) / 2 - 4;
  doc.addImage(await dataUrl(png), "PNG", x, y, fit.mmW, fit.mmH);
  const caption = "Figure 1. " + (ir.meta.caption || ir.meta.title);
  doc.setFontSize(10);
  doc.text(caption, dims.w / 2, dims.h - page.margin + 2, {
    align: "center",
    maxWidth: dims.w - 2 * page.margin,
  });
  return doc.output("blob");
}

export async function toDocx(ir: IR, page: PageSettings) {
  const { svg, w, h } = toSVG(ir, page.theme, page.font);
  const fit = computeFit(w, h, page);
  const png = await svgToPngBlob(svg, fit.pxW, fit.pxH);
  const {
    Document, Packer, Paragraph, TextRun, ImageRun, SimpleField,
    AlignmentType, convertMillimetersToTwip,
  } = await import("docx");

  const dims = pageSizeMM(page);
  const data = new Uint8Array(await png.arrayBuffer());

  const doc = new Document({
    creator: "MethodFlow",
    title: ir.meta.title,
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(dims.w),
              height: convertMillimetersToTwip(dims.h),
              orientation: page.orientation === "landscape" ? "landscape" : "portrait",
            },
            margin: {
              top: convertMillimetersToTwip(page.margin),
              right: convertMillimetersToTwip(page.margin),
              bottom: convertMillimetersToTwip(page.margin),
              left: convertMillimetersToTwip(page.margin),
            },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new ImageRun({
                type: "png",
                data,
                transformation: { width: fit.pxW, height: fit.pxH },
                altText: { name: "figure", title: ir.meta.title, description: ir.meta.title },
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun("Figure "),
              new SimpleField("SEQ Figure \\* ARABIC", "1"),
              new TextRun(". " + (ir.meta.caption || ir.meta.title)),
            ],
          }),
        ],
      },
    ],
  });
  return Packer.toBlob(doc);
}