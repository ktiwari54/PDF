/**
 * Non-destructive PDF export for dragonPDF Live Editor.
 * Original page content stays intact; replacements cover glyphs and redraw text
 * with the closest matching standard font to the PDF’s original typeface.
 */
import {
  PDFDocument,
  rgb,
  degrees,
  LineCapStyle,
} from '@cantoo/pdf-lib'
import type { Annotation, PageMeta } from '../types/annotations'
import { clearFontCache, embedMatchedFont } from './fontMatch'

function hexToRgb(hex: string) {
  const h = hex.replace('#', '')
  const n = parseInt(
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h,
    16,
  )
  return {
    r: ((n >> 16) & 255) / 255,
    g: ((n >> 8) & 255) / 255,
    b: (n & 255) / 255,
  }
}

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
  clearFontCache()
  const doc = await PDFDocument.load(originalBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  })

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
    const { width: W, height: H } = page.getSize()
    void pageMetas

    // Covers first (so text draws above)
    for (const ann of anns) {
      if (ann.type === 'cover') {
        const box = toPdfBox(W, H, ann.x, ann.y, ann.w, ann.h)
        const color = hexToRgb(ann.color || '#ffffff')
        page.drawRectangle({
          x: box.x,
          y: box.y,
          width: Math.max(box.w, 1),
          height: Math.max(box.h, 1),
          color: rgb(color.r, color.g, color.b),
          borderWidth: 0,
        })
      }
      if (ann.type === 'text' && ann.coverOriginal && ann.w && ann.h) {
        // Slight padding so original glyphs don't peek through
        const padX = 0.002
        const padY = 0.001
        const box = toPdfBox(
          W,
          H,
          Math.max(0, ann.x - padX),
          Math.max(0, ann.y - padY),
          ann.w + padX * 2,
          ann.h + padY * 2,
        )
        page.drawRectangle({
          x: box.x,
          y: box.y,
          width: Math.max(box.w, 1),
          height: Math.max(box.h, 1),
          color: rgb(1, 1, 1),
          borderWidth: 0,
        })
      }
    }

    for (const ann of anns) {
      if (ann.type === 'text') {
        const color = hexToRgb(ann.color || '#111827')
        const size = Math.max(6, Math.min(96, ann.fontSize || 12))
        const font = await embedMatchedFont(
          doc,
          ann.fontName || (ann.bold ? 'Helvetica-Bold' : 'Helvetica'),
        )
        const x = ann.x * W
        // baseline: top of box + ~80% of font size (PDF baseline)
        const top = ann.y * H
        const y = H - top - size * 0.85
        const maxWidth = ann.w ? ann.w * W : (ann.maxWidth ?? 0.9) * W
        const lines = wrapText(ann.text, font, size, maxWidth)
        lines.forEach((line, i) => {
          try {
            page.drawText(line, {
              x,
              y: y - i * size * 1.15,
              size,
              font,
              color: rgb(color.r, color.g, color.b),
              opacity: ann.opacity ?? 1,
              rotate: degrees(ann.rotate || 0),
            })
          } catch {
            // skip glyphs missing from standard font
            const safe = line.replace(/[^\x20-\x7E]/g, '?')
            page.drawText(safe, {
              x,
              y: y - i * size * 1.15,
              size,
              font,
              color: rgb(color.r, color.g, color.b),
            })
          }
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
        if (ann.points.length < 2) continue
        const color = hexToRgb(ann.color || '#1e293b')
        const strokeW = ann.width ?? 2
        for (let i = 1; i < ann.points.length; i++) {
          const a = ann.points[i - 1]
          const b = ann.points[i]
          page.drawLine({
            start: { x: a.x * W, y: H - a.y * H },
            end: { x: b.x * W, y: H - b.y * H },
            thickness: strokeW,
            color: rgb(color.r, color.g, color.b),
            opacity: ann.opacity ?? 1,
            lineCap: LineCapStyle.Round,
          })
        }
      } else if (ann.type === 'image') {
        const box = toPdfBox(W, H, ann.x, ann.y, ann.w, ann.h)
        const raw = dataUrlToBytes(ann.dataUrl)
        const img =
          ann.dataUrl.includes('image/png') ||
          ann.dataUrl.startsWith('data:image/png')
            ? await doc.embedPng(raw)
            : await doc.embedJpg(raw)
        page.drawImage(img, {
          x: box.x,
          y: box.y,
          width: box.w,
          height: box.h,
          opacity: ann.opacity ?? 1,
        })
      }
    }
  }

  doc.setModificationDate(new Date())
  doc.setProducer('dragonPDF Live Editor')
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
      const test = `${current} ${words[i]}`
      if (font.widthOfTextAtSize(test, size) <= maxWidth) current = test
      else {
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
