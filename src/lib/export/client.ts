"use client";
import type { IR } from "@/lib/core/ir";
import { toSVG } from "./svg";
import { captionOf, figureCaption } from "./caption";
import { computeFit, contentBoxes, pageSizeMM, resolvePage, type PageSettings } from "./page";

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

export async function toPng(ir: IR, page: PageSettings, watermark = false) {
  const { svg, w, h } = toSVG(ir, page.theme, page.font, undefined, watermark, contentBoxes(page));
  page = resolvePage(page, w, h);
  const fit = computeFit(w, h, page);
  const blob = await svgToPngBlob(svg, fit.pxW, fit.pxH);
  return { blob, ...fit, w, h };
}

const CAPTION_MM = 14;

export async function toPdf(ir: IR, page: PageSettings, watermark = false) {
  const { svg, w, h } = toSVG(ir, page.theme, page.font, undefined, watermark, contentBoxes(page));
  page = resolvePage(page, w, h, CAPTION_MM);
  const fit = computeFit(w, h, page, CAPTION_MM);
  
  const { jsPDF } = await import("jspdf");
  const { svg2pdf } = await import("svg2pdf.js");
  
  const dims = pageSizeMM(page);
  const doc = new jsPDF({
    orientation: page.orientation === "landscape" ? "landscape" : "portrait",
    unit: "mm",
    format: [dims.w, dims.h],
  });

  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.innerHTML = svg;
  document.body.appendChild(container);

  const svgElement = container.querySelector("svg");
  if (!svgElement) {
    document.body.removeChild(container);
    throw new Error("SVG element not found");
  }

  const x = (dims.w - fit.mmW) / 2;
  const blockH = fit.mmH + CAPTION_MM;
  const y = Math.max(page.margin, (dims.h - blockH) / 2);

  await svg2pdf(svgElement, doc, {
    x: x,
    y: y,
    width: fit.mmW,
    height: fit.mmH,
  });

  const caption = figureCaption(ir);
  if (caption) {
    doc.setFont(page.font === "serif" ? "times" : "helvetica", "normal");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(caption, dims.w - 2 * page.margin) as string[];
    doc.text(lines.slice(0, 3), dims.w / 2, y + fit.mmH + 6, { align: "center" });
  }

  document.body.removeChild(container);
  
  return doc.output("blob");
}

export async function toDocx(ir: IR, page: PageSettings, watermark = false) {
  const { svg, w, h } = toSVG(ir, page.theme, page.font, undefined, watermark, contentBoxes(page));
  page = resolvePage(page, w, h, CAPTION_MM);
  const fit = computeFit(w, h, page);
  const png = await svgToPngBlob(svg, fit.pxW, fit.pxH);
  const {
    Document, Packer, Paragraph, TextRun, ImageRun, SimpleField,
    AlignmentType, convertMillimetersToTwip,
  } = await import("docx");

  const dims = pageSizeMM(page);
  const data = new Uint8Array(await png.arrayBuffer());

  const contentWidthPx = (dims.w - 2 * page.margin) * 3.7795; 
  const contentHeightPx = (dims.h - 2 * page.margin) * 3.7795;
  const scale = Math.min(contentWidthPx / w, (contentHeightPx - 60) / h, 1.5);
  const finalW = Math.round(w * scale);
  const finalH = Math.round(h * scale);

  const caption = captionOf(ir);
  const children: any[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      keepNext: true,
      children: [
        new ImageRun({
          type: "png",
          data,
          transformation: { width: finalW, height: finalH },
          altText: { name: "figure", title: ir.meta.title, description: caption || ir.meta.title },
        }),
      ],
    }),
  ];

  if (caption) {
    children.push(
      new Paragraph({
        style: "Caption",
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "Figure ", bold: true }),
          new SimpleField("SEQ Figure \\* ARABIC", "1"),
          new TextRun({ text: ". " + caption }),
        ],
      })
    );
  }

  const doc = new Document({
    creator: "MethodFlow",
    title: ir.meta.title,
    styles: {
      paragraphStyles: [
        {
          id: "Caption",
          name: "Caption",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { italics: false, size: 20, color: "000000" },
          paragraph: { spacing: { before: 120, after: 240 } },
        },
      ],
    },
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
        children,
      },
    ],
  });
  return Packer.toBlob(doc);
}