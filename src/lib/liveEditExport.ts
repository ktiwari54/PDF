/**
 * Non-destructive PDF export for dragonPDF Live Editor.
 * Original page content streams, fonts, and images stay intact.
 * Only NEW annotations are drawn as overlay content on top.
 */
import {
  PDFDocument,
  rgb,
  StandardFonts,
  degrees,
  LineCapStyle,
} from '@cantoo/pdf-lib'
import type { Annotation, PageMeta } from '../types/annotations'

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255,
  }
}

/** Convert screen/top-left normalized coords (0–1) to PDF bottom-left points */
function toPdfBox(
  pageW: number,
  pageH: number,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  return {
    x: x * pageW,
    y: pageH - (y + h) * pageH,
    w: w * pageW,
    h: h * pageH,
  }
}

export async function exportEditedPdf(
  originalBytes: Uint8Array,
  annotations: Annotation[],
  pageMetas: PageMeta[],
): Promise<Uint8Array> {
  // Load original — preserve structure, fonts, images, forms
  const doc = await PDFDocument.load(originalBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  })

  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  // Group annotations by page index
  const byPage = new Map<number, Annotation[]>()
  for (const a of annotations) {
    const list = byPage.get(a.page) || []
    list.push(a)
    byPage.set(a.page, list)
  }

  const pages = doc.getPages()

  for (const [pageIndex, anns] of byPage) {
    const page = pages[pageIndex]
    if (!page) continue
    const { width: pageW, height: pageH } = page.getSize()
    const meta = pageMetas[pageIndex]
    // Prefer live page size from original PDF (structure source of truth)
    const W = pageW
    const H = pageH
    void meta

    for (const ann of anns) {
      if (ann.type === 'text') {
        const color = hexToRgb(ann.color || '#111827')
        // Size is in points relative to page height for consistency
        const size = Math.max(8, Math.min(72, ann.fontSize || 14))
        const x = ann.x * W
        // y is top-left normalized; baseline sits slightly below top
        const y = H - ann.y * H - size
        const f = ann.bold ? fontBold : font
        // Word-wrap for long lines
        const maxWidth = (ann.maxWidth ?? 0.9) * W
        const lines = wrapText(ann.text, f, size, maxWidth)
        lines.forEach((line, i) => {
          page.drawText(line, {
            x,
            y: y - i * size * 1.25,
            size,
            font: f,
            color: rgb(color.r, color.g, color.b),
            opacity: ann.opacity ?? 1,
            rotate: degrees(ann.rotate || 0),
          })
        })
      } else if (ann.type === 'highlight') {
        const box = toPdfBox(W, H, ann.x, ann.y, ann.w, ann.h)
        const color = hexToRgb(ann.color || '#fde047')
        page.drawRectangle({
          x: box.x,
          y: box.y,
          width: box.w,
          height: box.h,
          color: rgb(color.r, color.g, color.b),
          opacity: ann.opacity ?? 0.35,
          borderWidth: 0,
        })
      } else if (ann.type === 'rect') {
        const box = toPdfBox(W, H, ann.x, ann.y, ann.w, ann.h)
        const fill = ann.fill ? hexToRgb(ann.fill) : null
        const stroke = hexToRgb(ann.stroke || '#111827')
        page.drawRectangle({
          x: box.x,
          y: box.y,
          width: box.w,
          height: box.h,
          color: fill ? rgb(fill.r, fill.g, fill.b) : undefined,
          borderColor: rgb(stroke.r, stroke.g, stroke.b),
          borderWidth: ann.strokeWidth ?? 1.5,
          opacity: ann.opacity ?? (fill ? 0.15 : 1),
        })
      } else if (ann.type === 'ink') {
        // Handwriting / freehand — draw as path segments (preserves vector strokes)
        if (ann.points.length < 2) continue
        const color = hexToRgb(ann.color || '#1e293b')
        const strokeW = ann.width ?? 2
        for (let i = 1; i < ann.points.length; i++) {
          const a = ann.points[i - 1]
          const b = ann.points[i]
          const x1 = a.x * W
          const y1 = H - a.y * H
          const x2 = b.x * W
          const y2 = H - b.y * H
          page.drawLine({
            start: { x: x1, y: y1 },
            end: { x: x2, y: y2 },
            thickness: strokeW,
            color: rgb(color.r, color.g, color.b),
            opacity: ann.opacity ?? 1,
            lineCap: LineCapStyle.Round,
          })
        }
      } else if (ann.type === 'image') {
        const box = toPdfBox(W, H, ann.x, ann.y, ann.w, ann.h)
        const raw = dataUrlToBytes(ann.dataUrl)
        let img
        if (ann.dataUrl.includes('image/png') || ann.dataUrl.startsWith('data:image/png')) {
          img = await doc.embedPng(raw)
        } else {
          img = await doc.embedJpg(raw)
        }
        page.drawImage(img, {
          x: box.x,
          y: box.y,
          width: box.w,
          height: box.h,
          opacity: ann.opacity ?? 1,
        })
      } else if (ann.type === 'cover') {
        // White cover used for "replace text" without deleting original glyphs
        const box = toPdfBox(W, H, ann.x, ann.y, ann.w, ann.h)
        const color = hexToRgb(ann.color || '#ffffff')
        page.drawRectangle({
          x: box.x,
          y: box.y,
          width: box.w,
          height: box.h,
          color: rgb(color.r, color.g, color.b),
          borderWidth: 0,
          opacity: 1,
        })
      }
    }
  }

  doc.setModificationDate(new Date())
  doc.setProducer('dragonPDF Live Editor')
  // Save without object stream rewrite that could break structure unnecessarily
  return doc.save({ useObjectStreams: false, updateFieldAppearances: false })
}

function wrapText(
  text: string,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number,
  maxWidth: number,
): string[] {
  const paragraphs = text.split('\n')
  const lines: string[] = []
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean)
    if (!words.length) {
      lines.push('')
      continue
    }
    let current = words[0]
    for (let i = 1; i < words.length; i++) {
      const test = current + ' ' + words[i]
      if (font.widthOfTextAtSize(test, size) <= maxWidth) {
        current = test
      } else {
        lines.push(current)
        current = words[i]
      }
    }
    lines.push(current)
  }
  return lines
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || ''
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}
