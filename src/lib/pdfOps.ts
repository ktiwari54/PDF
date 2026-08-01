import {
  PDFDocument,
  degrees,
  rgb,
  StandardFonts,
  type PDFFont,
  type PDFPage,
} from '@cantoo/pdf-lib'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { jsPDF } from 'jspdf'
import * as pdfjs from 'pdfjs-dist'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import Tesseract from 'tesseract.js'
import html2canvas from 'html2canvas'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const LOAD = { ignoreEncryption: true } as const

export async function fileToBytes(file: File | Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer())
}

export function downloadBytes(
  bytes: Uint8Array,
  filename: string,
  mime = 'application/pdf',
) {
  // Copy into a plain ArrayBuffer-backed Uint8Array for Blob compatibility
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const blob = new Blob([copy], { type: mime })
  try {
    saveAs(blob, filename)
  } catch {
    // Fallback download
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  }
}

export function downloadBlob(blob: Blob, filename: string) {
  saveAs(blob, filename)
}

export function baseName(name: string) {
  return name.replace(/\.[^.]+$/, '')
}

async function loadDoc(file: File | Blob | Uint8Array, password?: string) {
  const data = file instanceof Uint8Array ? file : await fileToBytes(file)
  try {
    return await PDFDocument.load(data, {
      ignoreEncryption: !password,
      password: password || undefined,
    })
  } catch {
    return PDFDocument.load(data, LOAD)
  }
}

export async function mergePdfs(files: File[]): Promise<Uint8Array> {
  if (files.length < 2) throw new Error('Select at least 2 PDF files to merge.')
  const out = await PDFDocument.create()
  for (const file of files) {
    const src = await loadDoc(file)
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach((p) => out.addPage(p))
  }
  return out.save()
}

export async function splitPdf(
  file: File,
  mode: 'all' | 'range' = 'all',
  ranges?: string,
): Promise<Blob> {
  const src = await loadDoc(file)
  const zip = new JSZip()
  const n = src.getPageCount()

  if (mode === 'range' && ranges?.trim()) {
    const groups = ranges.split(';').map((g) => g.trim()).filter(Boolean)
    let part = 1
    for (const g of groups) {
      const indices = parsePageSpec(g, n).map((p) => p - 1)
      if (!indices.length) continue
      const doc = await PDFDocument.create()
      const copied = await doc.copyPages(src, indices)
      copied.forEach((p) => doc.addPage(p))
      zip.file(`${baseName(file.name)}_part_${part++}.pdf`, await doc.save())
    }
  } else {
    for (let i = 0; i < n; i++) {
      const doc = await PDFDocument.create()
      const [page] = await doc.copyPages(src, [i])
      doc.addPage(page)
      zip.file(`${baseName(file.name)}_page_${i + 1}.pdf`, await doc.save())
    }
  }
  return zip.generateAsync({ type: 'blob' })
}

export async function extractPages(
  file: File,
  pages1Based: number[],
): Promise<Uint8Array> {
  const src = await loadDoc(file)
  if (!pages1Based.length) throw new Error('Select at least one page.')
  const out = await PDFDocument.create()
  const indices = pages1Based
    .map((p) => p - 1)
    .filter((i) => i >= 0 && i < src.getPageCount())
  if (!indices.length) throw new Error('No valid pages in selection.')
  const copied = await out.copyPages(src, indices)
  copied.forEach((p) => out.addPage(p))
  return out.save()
}

export async function removePages(
  file: File,
  pages1Based: number[],
): Promise<Uint8Array> {
  const src = await loadDoc(file)
  if (!pages1Based.length) throw new Error('Select pages to remove.')
  const remove = new Set(pages1Based.map((p) => p - 1))
  const keep = src.getPageIndices().filter((i) => !remove.has(i))
  if (!keep.length) throw new Error('Cannot remove all pages.')
  const out = await PDFDocument.create()
  const copied = await out.copyPages(src, keep)
  copied.forEach((p) => out.addPage(p))
  return out.save()
}

export async function organizePages(
  file: File,
  order1Based: number[],
): Promise<Uint8Array> {
  const src = await loadDoc(file)
  const out = await PDFDocument.create()
  const indices = order1Based
    .map((p) => p - 1)
    .filter((i) => i >= 0 && i < src.getPageCount())
  if (!indices.length) throw new Error('Invalid page order.')
  const copied = await out.copyPages(src, indices)
  copied.forEach((p) => out.addPage(p))
  return out.save()
}

export async function rotatePdf(
  file: File,
  angle: 90 | 180 | 270,
  pages1Based?: number[],
): Promise<Uint8Array> {
  const doc = await loadDoc(file)
  const targets = pages1Based?.length
    ? new Set(pages1Based.map((p) => p - 1))
    : null
  doc.getPages().forEach((p, i) => {
    if (targets && !targets.has(i)) return
    p.setRotation(degrees((p.getRotation().angle + angle) % 360))
  })
  return doc.save()
}

export async function addPageNumbers(
  file: File,
  opts: {
    position: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center'
    startFrom?: number
    format?: string
  } = { position: 'bottom-center' },
): Promise<Uint8Array> {
  const doc = await loadDoc(file)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const start = opts.startFrom ?? 1
  const total = doc.getPageCount()
  doc.getPages().forEach((page, i) => {
    const num = start + i
    const label = (opts.format || '{n}').replace('{n}', String(num)).replace('{total}', String(total))
    placeText(page, font, label, opts.position, 12)
  })
  return doc.save()
}

function placeText(
  page: PDFPage,
  font: PDFFont,
  label: string,
  position: string,
  size: number,
) {
  const { width, height } = page.getSize()
  const tw = font.widthOfTextAtSize(label, size)
  let x = (width - tw) / 2
  let y = 24
  if (position === 'bottom-right') {
    x = width - tw - 36
  } else if (position === 'bottom-left') {
    x = 36
  } else if (position === 'top-center') {
    y = height - 36
  }
  page.drawText(label, { x, y, size, font, color: rgb(0.2, 0.2, 0.2) })
}

export type WatermarkOptions = {
  text: string
  opacity?: number
  /** rotation degrees (counter-clockwise in PDF) */
  angle?: number
  /** font size as fraction of min(page w,h); default 0.12 */
  scale?: number
  position?: 'center' | 'tile' | 'top' | 'bottom' | 'diagonal'
  color?: { r: number; g: number; b: number }
  /** optional PNG/JPG image watermark (data URL or bytes) */
  imageBytes?: Uint8Array
  imageType?: 'png' | 'jpg'
}

/**
 * Place text so its visual center sits at (cx, cy) after rotation.
 * pdf-lib rotates around the baseline origin (x, y).
 */
function originForCenteredText(
  cx: number,
  cy: number,
  textWidth: number,
  fontSize: number,
  angleDeg: number,
) {
  const rad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  // Midpoint of baseline → page center; nudge up by ~0.35*size for glyph body
  const midX = textWidth / 2
  const midY = fontSize * 0.35
  return {
    x: cx - midX * cos + midY * sin,
    y: cy - midX * sin - midY * cos,
  }
}

/** Sanitize to WinAnsi-safe characters for StandardFonts */
function winAnsiSafe(text: string) {
  return text
    .normalize('NFKD')
    .replace(/[^\x20-\x7E\u00A0-\u00FF]/g, '?')
    .trim()
}

export async function addWatermark(
  file: File,
  textOrOpts: string | WatermarkOptions,
  opacityArg = 0.5,
): Promise<Uint8Array> {
  const opts: WatermarkOptions =
    typeof textOrOpts === 'string'
      ? { text: textOrOpts, opacity: opacityArg }
      : textOrOpts

  const rawText = (opts.text || '').trim()
  const text = winAnsiSafe(rawText || 'WATERMARK')
  if (!text && !opts.imageBytes) {
    throw new Error('Enter watermark text or provide an image.')
  }

  const opacity = Math.min(1, Math.max(0.05, opts.opacity ?? 0.5))
  // default diagonal look
  const position = opts.position ?? 'diagonal'
  const angle =
    opts.angle ??
    (position === 'top' || position === 'bottom' ? 0 : 45)
  const color = opts.color ?? { r: 0.55, g: 0.55, b: 0.55 }
  const scale = opts.scale ?? 0.12

  const doc = await loadDoc(file)
  const font = await doc.embedFont(StandardFonts.HelveticaBold)

  let embeddedImage:
    | Awaited<ReturnType<PDFDocument['embedPng']>>
    | Awaited<ReturnType<PDFDocument['embedJpg']>>
    | null = null
  if (opts.imageBytes && opts.imageBytes.length > 0) {
    try {
      embeddedImage =
        opts.imageType === 'jpg'
          ? await doc.embedJpg(opts.imageBytes)
          : await doc.embedPng(opts.imageBytes)
    } catch {
      try {
        embeddedImage = await doc.embedJpg(opts.imageBytes)
      } catch {
        embeddedImage = null
      }
    }
  }

  const pages = doc.getPages()
  if (!pages.length) throw new Error('PDF has no pages.')

  for (const page of pages) {
    const { width, height } = page.getSize()
    // Fit text on the page diagonal/width so it never draws as a tiny off-page glyph
    let fontSize = Math.max(16, Math.min(width, height) * scale)
    let tw = font.widthOfTextAtSize(text, fontSize)
    const maxTextWidth = Math.min(width, height) * 0.85
    if (tw > maxTextWidth) {
      fontSize = fontSize * (maxTextWidth / tw)
      fontSize = Math.max(12, fontSize)
      tw = font.widthOfTextAtSize(text, fontSize)
    }

    const stampText = (cx: number, cy: number, rot: number) => {
      const { x, y } = originForCenteredText(cx, cy, tw, fontSize, rot)
      try {
        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(color.r, color.g, color.b),
          opacity,
          rotate: degrees(rot),
        })
      } catch {
        // Fallback without rotation if something fails
        page.drawText(text, {
          x: Math.max(10, cx - tw / 2),
          y: Math.max(10, cy - fontSize / 3),
          size: fontSize,
          font,
          color: rgb(color.r, color.g, color.b),
          opacity,
        })
      }
    }

    const stampImage = (cx: number, cy: number) => {
      if (!embeddedImage) return
      const maxW = width * 0.45
      const maxH = height * 0.35
      const ratio = embeddedImage.width / embeddedImage.height
      let w = maxW
      let h = w / ratio
      if (h > maxH) {
        h = maxH
        w = h * ratio
      }
      page.drawImage(embeddedImage, {
        x: cx - w / 2,
        y: cy - h / 2,
        width: w,
        height: h,
        opacity,
        rotate: degrees(angle),
      })
    }

    if (position === 'tile') {
      const cols = 3
      const rows = 4
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cx = ((c + 0.5) / cols) * width
          const cy = ((r + 0.5) / rows) * height
          if (embeddedImage) stampImage(cx, cy)
          else stampText(cx, cy, angle)
        }
      }
    } else if (position === 'top') {
      if (embeddedImage) stampImage(width / 2, height * 0.88)
      else stampText(width / 2, height * 0.88, angle)
    } else if (position === 'bottom') {
      if (embeddedImage) stampImage(width / 2, height * 0.12)
      else stampText(width / 2, height * 0.12, angle)
    } else {
      // center / diagonal — always stamp at page center with correct rotation
      if (embeddedImage) stampImage(width / 2, height / 2)
      else stampText(width / 2, height / 2, angle)
    }
  }

  const saved = await doc.save({ useObjectStreams: false })
  if (!saved || saved.length < 50) {
    throw new Error('Watermark save failed — empty PDF output.')
  }
  return saved
}

export type RemoveWatermarkOptions = {
  /** Text to find and cover (e.g. CONFIDENTIAL). Empty = common patterns + auto. */
  keyword?: string
  mode?: 'text' | 'center-band' | 'both'
  /** Cover color (default white) */
  coverColor?: { r: number; g: number; b: number }
}

const COMMON_WATERMARKS = [
  'confidential',
  'draft',
  'sample',
  'watermark',
  'do not copy',
  'preview',
  'unauthorized',
  'internal use',
  'copy',
  'top secret',
  'not for distribution',
  'specimen',
]

/**
 * Remove / cover watermarks.
 * - text: find matching text runs via pdf.js and cover their boxes
 * - center-band: cover typical center watermark strip
 * - both: try text first; if nothing found, use center band
 * Image/baked watermarks may need center-band or Live Editor whiteout.
 */
export async function removeWatermark(
  file: File,
  options: RemoveWatermarkOptions = {},
): Promise<{ bytes: Uint8Array; covered: number; method: string }> {
  const mode = options.mode || 'both'
  const cover = options.coverColor ?? { r: 1, g: 1, b: 1 }
  const keyword = (options.keyword || '').trim().toLowerCase()
  const doc = await loadDoc(file)
  const data = await fileToBytes(file)
  const pdf = await pdfjs.getDocument({ data: data.slice() }).promise
  const pages = doc.getPages()

  let covered = 0

  if (mode === 'text' || mode === 'both') {
    for (let i = 0; i < pdf.numPages; i++) {
      const page = pages[i]
      if (!page) continue
      const { width: W, height: H } = page.getSize()
      const p = await pdf.getPage(i + 1)
      const viewport = p.getViewport({ scale: 1 })
      const content = await p.getTextContent()

      for (const item of content.items) {
        if (!('str' in item)) continue
        const it = item as {
          str: string
          transform: number[]
          width: number
          height: number
        }
        const str = String(it.str).trim()
        if (!str) continue
        const lower = str.toLowerCase()
        const matchesKeyword = keyword
          ? lower.includes(keyword)
          : COMMON_WATERMARKS.some((w) => lower.includes(w))
        const fontH = Math.hypot(it.transform[2], it.transform[3])
        const largeCaps =
          !keyword &&
          fontH > Math.min(W, H) * 0.035 &&
          str.length >= 4 &&
          str.length < 48 &&
          str === str.toUpperCase() &&
          /[A-Z]/.test(str)

        if (!matchesKeyword && !largeCaps) continue

        const m = pdfjs.Util.transform(viewport.transform, it.transform)
        const fontHeight = Math.hypot(m[2], m[3])
        const fontWidthScale = Math.hypot(m[0], m[1])
        const wPx = (it.width || str.length * 0.5) * fontWidthScale
        const hPx = Math.max(fontHeight, 8)
        const left = m[4]
        const topVp = m[5] - hPx * 0.85
        const scaleX = W / viewport.width
        const scaleY = H / viewport.height
        const boxW = Math.max(wPx * scaleX + 12, 24)
        const boxH = hPx * scaleY + 10
        const x = left * scaleX - 6
        const y = H - (topVp * scaleY + boxH)

        page.drawRectangle({
          x: Math.max(0, x),
          y: Math.max(0, y),
          width: Math.min(boxW, W),
          height: Math.min(boxH, H),
          color: rgb(cover.r, cover.g, cover.b),
          borderWidth: 0,
        })
        covered++
      }
    }
  }

  let method = covered > 0 ? `covered ${covered} text region(s)` : ''

  if (mode === 'center-band' || (mode === 'both' && covered === 0)) {
    for (const page of pages) {
      const { width: W, height: H } = page.getSize()
      const bandH = H * 0.16
      page.drawRectangle({
        x: W * 0.06,
        y: H / 2 - bandH / 2,
        width: W * 0.88,
        height: bandH,
        color: rgb(cover.r, cover.g, cover.b),
        borderWidth: 0,
      })
    }
    method =
      covered > 0
        ? method
        : 'applied center-band cover (use keyword for precise text removal)'
  }

  if (mode === 'text' && covered === 0) {
    throw new Error(
      keyword
        ? `No text matching “${options.keyword}” was found. Try Center band mode or Live Editor whiteout.`
        : 'No common watermark text found. Enter the watermark words, or use Center band mode.',
    )
  }

  return {
    bytes: await doc.save(),
    covered,
    method: method || 'done',
  }
}

export async function cropPdf(file: File, margin: number): Promise<Uint8Array> {
  const doc = await loadDoc(file)
  doc.getPages().forEach((page) => {
    const { width, height } = page.getSize()
    const m = Math.max(0, Math.min(margin, width / 2 - 2, height / 2 - 2))
    page.setCropBox(m, m, width - 2 * m, height - 2 * m)
  })
  return doc.save()
}

/** Real password encryption via @cantoo/pdf-lib when available */
export async function protectPdf(
  file: File,
  userPassword: string,
): Promise<Uint8Array> {
  if (!userPassword) throw new Error('Enter a password.')
  const doc = await loadDoc(file)
  try {
    doc.encrypt({
      userPassword,
      ownerPassword: userPassword,
    })
    return await doc.save()
  } catch {
    // Fallback: AES container unlockable by this app
    const plain = await fileToBytes(file)
    const encrypted = await aesEncrypt(plain, userPassword)
    const magic = new TextEncoder().encode('PDFTOOLSLK1')
    const out = new Uint8Array(magic.length + encrypted.length)
    out.set(magic, 0)
    out.set(encrypted, magic.length)
    return out
  }
}

export async function unlockPdf(
  file: File,
  password?: string,
): Promise<Uint8Array> {
  const bytes = await fileToBytes(file)
  const magic = new TextEncoder().encode('PDFTOOLSLK1')
  let isLocked = bytes.length > magic.length
  for (let i = 0; i < magic.length && isLocked; i++) {
    if (bytes[i] !== magic[i]) isLocked = false
  }
  if (isLocked) {
    if (!password) throw new Error('Password required to unlock this file.')
    const decrypted = await aesDecrypt(bytes.slice(magic.length), password)
    return decrypted
  }
  try {
    const doc = await PDFDocument.load(bytes, {
      ignoreEncryption: false,
      password: password || undefined,
    })
    return doc.save()
  } catch {
    if (!password) {
      throw new Error('This PDF is encrypted. Enter the password to unlock.')
    }
    const doc = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      password,
    })
    return doc.save()
  }
}

async function aesEncrypt(data: Uint8Array, password: string): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt'],
  )
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data)
  const result = new Uint8Array(salt.length + iv.length + cipher.byteLength)
  result.set(salt, 0)
  result.set(iv, 16)
  result.set(new Uint8Array(cipher), 28)
  return result
}

async function aesDecrypt(payload: Uint8Array, password: string): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const salt = payload.slice(0, 16)
  const iv = payload.slice(16, 28)
  const data = payload.slice(28)
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 120000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  )
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
    return new Uint8Array(plain)
  } catch {
    throw new Error('Wrong password or corrupted file.')
  }
}

export async function imagesToPdf(
  files: File[],
  opts?: { margin?: number; pageSize?: 'fit' | 'a4' },
): Promise<Uint8Array> {
  if (!files.length) throw new Error('Select at least one image.')
  const doc = await PDFDocument.create()
  const margin = opts?.margin ?? 0
  for (const file of files) {
    const bytes = await fileToBytes(file)
    const type = file.type.toLowerCase()
    let image
    if (type.includes('png') || file.name.toLowerCase().endsWith('.png')) {
      image = await doc.embedPng(bytes)
    } else {
      try {
        image = await doc.embedJpg(bytes)
      } catch {
        // convert via canvas
        const url = URL.createObjectURL(file)
        try {
          const img = await loadImage(url)
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth
          canvas.height = img.naturalHeight
          canvas.getContext('2d')!.drawImage(img, 0, 0)
          const png = await canvasToPngBytes(canvas)
          image = await doc.embedPng(png)
        } finally {
          URL.revokeObjectURL(url)
        }
      }
    }
    if (opts?.pageSize === 'a4') {
      const page = doc.addPage([595.28, 841.89])
      const { width, height } = page.getSize()
      const maxW = width - margin * 2
      const maxH = height - margin * 2
      const scale = Math.min(maxW / image.width, maxH / image.height)
      const w = image.width * scale
      const h = image.height * scale
      page.drawImage(image, {
        x: (width - w) / 2,
        y: (height - h) / 2,
        width: w,
        height: h,
      })
    } else {
      const page = doc.addPage([
        image.width + margin * 2,
        image.height + margin * 2,
      ])
      page.drawImage(image, {
        x: margin,
        y: margin,
        width: image.width,
        height: image.height,
      })
    }
  }
  return doc.save()
}

async function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'),
  )
  return fileToBytes(blob)
}

export async function renderPageToCanvas(
  file: File | Uint8Array,
  pageIndex: number,
  scale = 1.5,
): Promise<HTMLCanvasElement> {
  const data = file instanceof Uint8Array ? file : await fileToBytes(file)
  const pdf = await pdfjs.getDocument({ data: data.slice() }).promise
  const page = await pdf.getPage(pageIndex + 1)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  const ctx = canvas.getContext('2d')!
  // pdfjs v4+ render API
  await page.render({
    canvasContext: ctx,
    viewport,
    canvas,
  } as Parameters<typeof page.render>[0]).promise
  return canvas
}

export async function pdfToJpg(
  file: File,
  scale = 2,
  quality = 0.92,
): Promise<Blob> {
  const data = await fileToBytes(file)
  const pdf = await pdfjs.getDocument({ data: data.slice() }).promise
  const zip = new JSZip()
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')!
    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    } as Parameters<typeof page.render>[0]).promise
    const blob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob(
        (b) => (b ? res(b) : rej(new Error('JPG encode failed'))),
        'image/jpeg',
        quality,
      ),
    )
    zip.file(`${baseName(file.name)}_page_${i}.jpg`, blob)
  }
  return zip.generateAsync({ type: 'blob' })
}

/** Re-encode pages as JPEG for real size reduction */
export async function compressPdf(
  file: File,
  quality: 'low' | 'medium' | 'high' = 'medium',
): Promise<Uint8Array> {
  const scale = quality === 'low' ? 1.0 : quality === 'high' ? 1.8 : 1.35
  const jpegQ = quality === 'low' ? 0.55 : quality === 'high' ? 0.82 : 0.7
  const data = await fileToBytes(file)
  const pdf = await pdfjs.getDocument({ data: data.slice() }).promise
  const out = await PDFDocument.create()
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    await page.render({
      canvasContext: ctx,
      viewport,
      canvas,
    } as Parameters<typeof page.render>[0]).promise
    const jpgBlob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob(
        (b) => (b ? res(b) : rej(new Error('compress failed'))),
        'image/jpeg',
        jpegQ,
      ),
    )
    const jpg = await fileToBytes(jpgBlob)
    const image = await out.embedJpg(jpg)
    const p = out.addPage([image.width, image.height])
    p.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
  }
  return out.save({ useObjectStreams: true })
}

export async function repairPdf(file: File): Promise<Uint8Array> {
  try {
    const src = await loadDoc(file)
    const out = await PDFDocument.create()
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach((p) => out.addPage(p))
    out.setTitle(baseName(file.name))
    out.setProducer('PDF Tools')
    return out.save()
  } catch {
    return compressPdf(file, 'high')
  }
}

export async function extractText(file: File): Promise<string> {
  const data = await fileToBytes(file)
  const pdf = await pdfjs.getDocument({ data: data.slice() }).promise
  const parts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const lines: string[] = []
    let lastY: number | null = null
    for (const item of content.items) {
      if (!('str' in item)) continue
      const y = 'transform' in item ? (item.transform as number[])[5] : 0
      if (lastY !== null && Math.abs(y - lastY) > 4) lines.push('\n')
      else if (lines.length) lines.push(' ')
      lines.push(item.str)
      lastY = y
    }
    parts.push(lines.join('').trim())
  }
  return parts.filter(Boolean).join('\n\n')
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

export async function pdfToWord(file: File): Promise<Blob> {
  const text = await extractText(file)
  if (!text.trim()) {
    throw new Error('No extractable text. Try OCR PDF first for scanned files.')
  }
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(baseName(file.name))}</title></head><body>${text
    .split('\n')
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('')}</body></html>`
  return new Blob(['\ufeff', html], { type: 'application/msword' })
}

export async function pdfToExcel(file: File): Promise<Blob> {
  const text = await extractText(file)
  const rows = text
    .split(/\n+/)
    .map((line) => {
      if (line.includes('\t')) return line.split('\t')
      if (line.includes(',')) return line.split(',').map((c) => c.trim())
      return line.split(/\s{2,}/).filter(Boolean)
    })
    .filter((r) => r.some((c) => String(c).trim()))
  const ws = XLSX.utils.aoa_to_sheet(
    rows.length ? rows : [['(no structured text found — try OCR)']],
  )
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

export async function pdfToPowerpoint(file: File): Promise<Blob> {
  const text = await extractText(file)
  const pages = text.split(/\n\n+/).filter(Boolean)
  const slides = (pages.length ? pages : ['(empty)'])
    .map(
      (p, i) =>
        `<div class="slide"><h2>Slide ${i + 1}</h2><p>${escapeHtml(p)}</p></div>`,
    )
    .join('')
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    .slide{page-break-after:always;padding:48px;font-family:Arial,sans-serif;min-height:70vh;border-bottom:2px solid #ccc}
    h2{color:#c0392b}
  </style></head><body>${slides}</body></html>`
  return new Blob([html], { type: 'text/html' })
}

export async function wordToPdf(file: File): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer })
  return htmlStringToPdf(result.value || '<p>(empty document)</p>')
}

export async function excelToPdf(file: File): Promise<Uint8Array> {
  const data = await file.arrayBuffer()
  const wb = XLSX.read(data, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]
  const html =
    '<h2>' +
    escapeHtml(wb.SheetNames[0]) +
    '</h2><table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:Arial;font-size:11px;width:100%">' +
    rows
      .map((r, ri) => {
        const cells = (r as unknown[]).map((c) =>
          ri === 0
            ? `<th style="background:#eee">${escapeHtml(String(c ?? ''))}</th>`
            : `<td>${escapeHtml(String(c ?? ''))}</td>`,
        )
        return '<tr>' + cells.join('') + '</tr>'
      })
      .join('') +
    '</table>'
  return htmlStringToPdf(html)
}

export async function htmlFileToPdf(file: File): Promise<Uint8Array> {
  return htmlStringToPdf(await file.text())
}

export async function htmlStringToPdf(html: string): Promise<Uint8Array> {
  const host = document.createElement('div')
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;width:794px;padding:40px;background:#fff;color:#111;font-family:Arial,sans-serif;line-height:1.5'
  host.innerHTML = html
  document.body.appendChild(host)
  try {
    const canvas = await html2canvas(
      host,
      {
        useCORS: true,
        scale: 2,
        backgroundColor: '#ffffff',
      } as Parameters<typeof html2canvas>[1],
    )
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const imgData = canvas.toDataURL('image/jpeg', 0.92)
    const imgH = (pageW / canvas.width) * canvas.height
    let y = 0
    let first = true
    while (y < imgH - 1) {
      if (!first) pdf.addPage()
      first = false
      pdf.addImage(imgData, 'JPEG', 0, -y, pageW, imgH)
      y += pageH
    }
    return new Uint8Array(pdf.output('arraybuffer'))
  } finally {
    document.body.removeChild(host)
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

export async function powerpointToPdf(file: File): Promise<Uint8Array> {
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer())
    const texts: string[] = []
    const slideFiles = Object.keys(zip.files)
      .filter((n) => /ppt\/slides\/slide\d+\.xml$/i.test(n))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    for (const name of slideFiles) {
      const xml = await zip.files[name].async('text')
      const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) || []
      const t = matches
        .map((m) => m.replace(/<[^>]+>/g, ''))
        .join(' ')
        .trim()
      if (t) texts.push(t)
    }
    if (texts.length) {
      const html = texts
        .map(
          (t, i) =>
            `<div style="page-break-after:always;min-height:400px"><h2>Slide ${i + 1}</h2><p>${escapeHtml(t)}</p></div>`,
        )
        .join('')
      return htmlStringToPdf(html)
    }
  } catch {
    /* fall through */
  }
  throw new Error(
    'Could not parse this PowerPoint. Export slides as images and use JPG to PDF, or save as PDF from PowerPoint.',
  )
}

export async function editAddText(
  file: File,
  text: string,
  opts?: { x?: number; yFromTop?: number; size?: number; page?: number },
): Promise<Uint8Array> {
  if (!text.trim()) throw new Error('Enter text to add.')
  const doc = await loadDoc(file)
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const pageIndex = (opts?.page ?? 1) - 1
  const page = doc.getPages()[pageIndex]
  if (!page) throw new Error('Page not found.')
  const { height } = page.getSize()
  const size = opts?.size ?? 14
  const yFromTop = opts?.yFromTop ?? 72
  page.drawText(text, {
    x: opts?.x ?? 72,
    y: height - yFromTop,
    size,
    font,
    color: rgb(0.1, 0.1, 0.75),
  })
  return doc.save()
}

export async function signPdf(
  file: File,
  signaturePng: Uint8Array,
  opts?: { x?: number; y?: number; width?: number; page?: number },
): Promise<Uint8Array> {
  const doc = await loadDoc(file)
  const img = await doc.embedPng(signaturePng)
  const pages = doc.getPages()
  const page = pages[(opts?.page ?? pages.length) - 1]
  const w = opts?.width ?? 160
  const h = (img.height / img.width) * w
  page.drawImage(img, {
    x: opts?.x ?? 72,
    y: opts?.y ?? 72,
    width: w,
    height: h,
  })
  return doc.save()
}

export async function redactDefaultBand(file: File): Promise<Uint8Array> {
  const doc = await loadDoc(file)
  doc.getPages().forEach((page) => {
    const { width, height } = page.getSize()
    page.drawRectangle({
      x: 36,
      y: height - 130,
      width: width - 72,
      height: 48,
      color: rgb(0, 0, 0),
    })
  })
  return doc.save()
}

export async function redactRegions(
  file: File,
  boxes: { page: number; x: number; y: number; w: number; h: number }[],
): Promise<Uint8Array> {
  const doc = await loadDoc(file)
  for (const box of boxes) {
    const page = doc.getPages()[box.page]
    if (!page) continue
    const { width, height } = page.getSize()
    page.drawRectangle({
      x: box.x * width,
      y: height - (box.y + box.h) * height,
      width: box.w * width,
      height: box.h * height,
      color: rgb(0, 0, 0),
    })
  }
  return doc.save()
}

export async function toPdfA(file: File): Promise<Uint8Array> {
  const doc = await loadDoc(file)
  doc.setTitle(baseName(file.name))
  doc.setProducer('PDF Tools')
  doc.setCreator('PDF Tools')
  doc.setCreationDate(new Date())
  doc.setModificationDate(new Date())
  doc.setSubject('PDF/A archival export')
  return doc.save({ useObjectStreams: false })
}

export async function listFormFields(file: File): Promise<string[]> {
  const doc = await loadDoc(file)
  try {
    return doc.getForm().getFields().map((f) => `${f.constructor.name}: ${f.getName()}`)
  } catch {
    return []
  }
}

export async function addSampleFormFields(file: File): Promise<Uint8Array> {
  const doc = await loadDoc(file)
  const form = doc.getForm()
  const page = doc.getPages()[0]
  const { height } = page.getSize()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText('Name:', { x: 50, y: height - 80, size: 12, font })
  const name = form.createTextField('full_name')
  name.addToPage(page, { x: 100, y: height - 90, width: 250, height: 22 })
  page.drawText('Email:', { x: 50, y: height - 120, size: 12, font })
  const email = form.createTextField('email')
  email.addToPage(page, { x: 100, y: height - 130, width: 250, height: 22 })
  const agree = form.createCheckBox('agree')
  agree.addToPage(page, { x: 50, y: height - 170, width: 16, height: 16 })
  page.drawText('I agree to the terms', {
    x: 74,
    y: height - 166,
    size: 12,
    font,
  })
  form.updateFieldAppearances(font)
  return doc.save()
}

export async function ocrToPdf(
  file: File,
  onProgress?: (msg: string) => void,
): Promise<{ text: string; pdf: Uint8Array }> {
  let imageSource: string | HTMLCanvasElement
  if (file.type.startsWith('image/')) {
    imageSource = URL.createObjectURL(file)
  } else {
    onProgress?.('Rendering PDF page…')
    imageSource = await renderPageToCanvas(file, 0, 2)
  }
  onProgress?.('Running OCR (first run may download language data)…')
  const result = await Tesseract.recognize(imageSource, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text' && m.progress) {
        onProgress?.(`OCR ${Math.round(m.progress * 100)}%`)
      }
    },
  })
  if (typeof imageSource === 'string') URL.revokeObjectURL(imageSource)
  const text = result.data.text.trim()
  const pdf = await htmlStringToPdf(
    `<h1>OCR Result — ${escapeHtml(file.name)}</h1><pre style="white-space:pre-wrap;font-family:Arial,sans-serif;font-size:13px">${escapeHtml(text || '(no text detected)')}</pre>`,
  )
  return { text, pdf }
}

export function summarizeText(text: string, maxSentences = 6): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return 'No text found. Try OCR PDF for scanned documents.'
  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 25)
  if (sentences.length <= maxSentences) return sentences.join(' ') || cleaned.slice(0, 800)
  const words = cleaned.toLowerCase().match(/[a-zA-Z]{4,}/g) || []
  const freq = new Map<string, number>()
  words.forEach((w) => freq.set(w, (freq.get(w) || 0) + 1))
  const scored = sentences.map((s, idx) => {
    const sw = s.toLowerCase().match(/[a-zA-Z]{4,}/g) || []
    const score =
      sw.reduce((a, w) => a + (freq.get(w) || 0), 0) / (sw.length || 1) +
      (idx < 3 ? 2 : 0)
    return { s, score, idx }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored
    .slice(0, maxSentences)
    .sort((a, b) => a.idx - b.idx)
    .map((x) => x.s)
    .join(' ')
}

/** ISO codes supported for Translate PDF (Google Translate client endpoint). */
export const TRANSLATE_LANGUAGES: { code: string; name: string }[] = [
  { code: 'af', name: 'Afrikaans' },
  { code: 'sq', name: 'Albanian' },
  { code: 'am', name: 'Amharic' },
  { code: 'ar', name: 'Arabic' },
  { code: 'hy', name: 'Armenian' },
  { code: 'az', name: 'Azerbaijani' },
  { code: 'eu', name: 'Basque' },
  { code: 'be', name: 'Belarusian' },
  { code: 'bn', name: 'Bengali' },
  { code: 'bs', name: 'Bosnian' },
  { code: 'bg', name: 'Bulgarian' },
  { code: 'ca', name: 'Catalan' },
  { code: 'ceb', name: 'Cebuano' },
  { code: 'zh-CN', name: 'Chinese (Simplified)' },
  { code: 'zh-TW', name: 'Chinese (Traditional)' },
  { code: 'co', name: 'Corsican' },
  { code: 'hr', name: 'Croatian' },
  { code: 'cs', name: 'Czech' },
  { code: 'da', name: 'Danish' },
  { code: 'nl', name: 'Dutch' },
  { code: 'en', name: 'English' },
  { code: 'eo', name: 'Esperanto' },
  { code: 'et', name: 'Estonian' },
  { code: 'fi', name: 'Finnish' },
  { code: 'fr', name: 'French' },
  { code: 'fy', name: 'Frisian' },
  { code: 'gl', name: 'Galician' },
  { code: 'ka', name: 'Georgian' },
  { code: 'de', name: 'German' },
  { code: 'el', name: 'Greek' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'ht', name: 'Haitian Creole' },
  { code: 'ha', name: 'Hausa' },
  { code: 'haw', name: 'Hawaiian' },
  { code: 'he', name: 'Hebrew' },
  { code: 'hi', name: 'Hindi' },
  { code: 'hmn', name: 'Hmong' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'is', name: 'Icelandic' },
  { code: 'ig', name: 'Igbo' },
  { code: 'id', name: 'Indonesian' },
  { code: 'ga', name: 'Irish' },
  { code: 'it', name: 'Italian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'jv', name: 'Javanese' },
  { code: 'kn', name: 'Kannada' },
  { code: 'kk', name: 'Kazakh' },
  { code: 'km', name: 'Khmer' },
  { code: 'ko', name: 'Korean' },
  { code: 'ku', name: 'Kurdish' },
  { code: 'ky', name: 'Kyrgyz' },
  { code: 'lo', name: 'Lao' },
  { code: 'la', name: 'Latin' },
  { code: 'lv', name: 'Latvian' },
  { code: 'lt', name: 'Lithuanian' },
  { code: 'lb', name: 'Luxembourgish' },
  { code: 'mk', name: 'Macedonian' },
  { code: 'mg', name: 'Malagasy' },
  { code: 'ms', name: 'Malay' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'mt', name: 'Maltese' },
  { code: 'mi', name: 'Maori' },
  { code: 'mr', name: 'Marathi' },
  { code: 'mn', name: 'Mongolian' },
  { code: 'my', name: 'Myanmar (Burmese)' },
  { code: 'ne', name: 'Nepali' },
  { code: 'no', name: 'Norwegian' },
  { code: 'ny', name: 'Nyanja' },
  { code: 'or', name: 'Odia' },
  { code: 'ps', name: 'Pashto' },
  { code: 'fa', name: 'Persian' },
  { code: 'pl', name: 'Polish' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'ro', name: 'Romanian' },
  { code: 'ru', name: 'Russian' },
  { code: 'sm', name: 'Samoan' },
  { code: 'gd', name: 'Scots Gaelic' },
  { code: 'sr', name: 'Serbian' },
  { code: 'st', name: 'Sesotho' },
  { code: 'sn', name: 'Shona' },
  { code: 'sd', name: 'Sindhi' },
  { code: 'si', name: 'Sinhala' },
  { code: 'sk', name: 'Slovak' },
  { code: 'sl', name: 'Slovenian' },
  { code: 'so', name: 'Somali' },
  { code: 'es', name: 'Spanish' },
  { code: 'su', name: 'Sundanese' },
  { code: 'sw', name: 'Swahili' },
  { code: 'sv', name: 'Swedish' },
  { code: 'tl', name: 'Tagalog' },
  { code: 'tg', name: 'Tajik' },
  { code: 'ta', name: 'Tamil' },
  { code: 'tt', name: 'Tatar' },
  { code: 'te', name: 'Telugu' },
  { code: 'th', name: 'Thai' },
  { code: 'tr', name: 'Turkish' },
  { code: 'tk', name: 'Turkmen' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'ur', name: 'Urdu' },
  { code: 'ug', name: 'Uyghur' },
  { code: 'uz', name: 'Uzbek' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'cy', name: 'Welsh' },
  { code: 'xh', name: 'Xhosa' },
  { code: 'yi', name: 'Yiddish' },
  { code: 'yo', name: 'Yoruba' },
  { code: 'zu', name: 'Zulu' },
]

const RTL_LANGS = new Set(['ar', 'he', 'fa', 'ur', 'ps', 'yi', 'ug'])

export function isRtlLang(code: string) {
  return RTL_LANGS.has(code.split('-')[0])
}

/** Split text into chunks that fit free translate URL limits */
function chunkText(text: string, maxLen = 900): string[] {
  const cleaned = text.replace(/\r\n/g, '\n').trim()
  if (!cleaned) return []
  if (cleaned.length <= maxLen) return [cleaned]

  const chunks: string[] = []
  const paragraphs = cleaned.split(/\n{2,}/)
  let buf = ''

  const flush = () => {
    if (buf.trim()) chunks.push(buf.trim())
    buf = ''
  }

  for (const para of paragraphs) {
    if (para.length > maxLen) {
      flush()
      // Split long paragraph by sentences / spaces
      let rest = para
      while (rest.length > maxLen) {
        let cut = rest.lastIndexOf(' ', maxLen)
        if (cut < maxLen * 0.5) cut = maxLen
        chunks.push(rest.slice(0, cut).trim())
        rest = rest.slice(cut).trim()
      }
      if (rest) buf = rest
      continue
    }
    if ((buf + '\n\n' + para).length > maxLen) {
      flush()
      buf = para
    } else {
      buf = buf ? buf + '\n\n' + para : para
    }
  }
  flush()
  return chunks
}

async function translateChunkGoogle(
  text: string,
  targetLang: string,
  sourceLang: string,
): Promise<string> {
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' +
    encodeURIComponent(sourceLang) +
    '&tl=' +
    encodeURIComponent(targetLang) +
    '&dt=t&q=' +
    encodeURIComponent(text)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Translate HTTP ${res.status}`)
  const data = (await res.json()) as unknown
  // Response shape: [ [ [translated, original, ...], ... ], ...]
  if (!Array.isArray(data) || !Array.isArray(data[0])) {
    throw new Error('Unexpected translate response')
  }
  return (data[0] as unknown[])
    .map((row) => (Array.isArray(row) ? String(row[0] ?? '') : ''))
    .join('')
}

async function translateChunkMyMemory(
  text: string,
  targetLang: string,
  sourceLang: string,
): Promise<string> {
  const sl = sourceLang === 'auto' ? 'en' : sourceLang
  const url =
    'https://api.mymemory.translated.net/get?q=' +
    encodeURIComponent(text.slice(0, 450)) +
    '&langpair=' +
    encodeURIComponent(`${sl}|${targetLang}`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`)
  const data = (await res.json()) as {
    responseData?: { translatedText?: string }
    responseStatus?: number
  }
  const out = data.responseData?.translatedText
  if (!out || data.responseStatus !== 200) {
    throw new Error('MyMemory translation failed')
  }
  // Filter quota / error messages returned as "translation"
  if (/MYMEMORY WARNING/i.test(out)) throw new Error(out)
  return out
}

/**
 * Translate text to any language code (e.g. es, hi, ja, zh-CN).
 * Uses Google Translate free client endpoint with MyMemory fallback.
 */
export async function translateText(
  text: string,
  targetLang: string,
  sourceLang = 'auto',
  onProgress?: (msg: string) => void,
): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed) {
    throw new Error(
      'No extractable text in this PDF. For scans, run OCR PDF first, then Translate.',
    )
  }

  const tl = targetLang === 'zh' ? 'zh-CN' : targetLang
  const sl = sourceLang || 'auto'
  const chunks = chunkText(trimmed, 850)
  const results: string[] = []
  let engine: 'google' | 'mymemory' | null = null

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(
      `Translating chunk ${i + 1} of ${chunks.length} → ${tl}…`,
    )
    const chunk = chunks[i]
    let translated = ''

    // Prefer Google free endpoint (broad language support)
    if (engine !== 'mymemory') {
      try {
        translated = await translateChunkGoogle(chunk, tl, sl)
        engine = 'google'
      } catch {
        engine = engine === 'google' ? 'google' : null
      }
    }

    if (!translated) {
      try {
        // MyMemory needs smaller pieces
        const sub = chunkText(chunk, 400)
        const parts: string[] = []
        for (const s of sub) {
          parts.push(await translateChunkMyMemory(s, tl, sl === 'auto' ? 'en' : sl))
          await delay(120)
        }
        translated = parts.join(' ')
        engine = 'mymemory'
      } catch (e) {
        // last resort: browser Translator API (Chromium)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w = window as any
        if (w.translation?.createTranslator) {
          try {
            const translator = await w.translation.createTranslator({
              sourceLanguage: sl === 'auto' ? 'en' : sl,
              targetLanguage: tl.split('-')[0],
            })
            translated = await translator.translate(chunk)
          } catch {
            /* fall through */
          }
        }
        if (!translated) {
          throw new Error(
            e instanceof Error
              ? `Translation failed: ${e.message}. Check your network and try again.`
              : 'Translation failed. Check your network and try again.',
          )
        }
      }
    }

    results.push(translated)
    // Be polite to free endpoints
    if (i < chunks.length - 1) await delay(80)
  }

  onProgress?.(`Done via ${engine || 'browser'} (${results.length} chunk(s)).`)
  return results.join('\n\n')
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

/** Build a readable translated PDF (RTL-aware). */
export async function translationToPdf(
  title: string,
  translated: string,
  targetLang: string,
): Promise<Uint8Array> {
  const rtl = isRtlLang(targetLang)
  const langName =
    TRANSLATE_LANGUAGES.find((l) => l.code === targetLang || l.code === targetLang.replace('zh', 'zh-CN'))
      ?.name || targetLang
  const paragraphs = translated
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 12px;font-size:13px;line-height:1.65;font-family:'Noto Sans',Arial,'Segoe UI',sans-serif;">${escapeHtml(p)}</p>`,
    )
    .join('')
  const html = `
    <div dir="${rtl ? 'rtl' : 'ltr'}" style="text-align:${rtl ? 'right' : 'left'}">
      <h1 style="font-size:20px;margin:0 0 8px;font-family:Arial,sans-serif;">${escapeHtml(title)}</h1>
      <p style="color:#666;font-size:12px;margin:0 0 20px;">Translated to ${escapeHtml(langName)} (${escapeHtml(targetLang)}) · dragonPDF</p>
      ${paragraphs}
    </div>
  `
  return htmlStringToPdf(html)
}

export async function pdfToMarkdown(file: File): Promise<string> {
  const text = await extractText(file)
  if (!text.trim()) {
    return `# ${baseName(file.name)}\n\n_No extractable text. Run OCR PDF first._\n`
  }
  const lines = text.split('\n')
  const md = lines
    .map((line) => {
      const t = line.trim()
      if (!t) return ''
      if (t.length < 70 && t === t.toUpperCase() && /[A-Z]/.test(t) && t.length > 3) {
        return `## ${t}`
      }
      return t
    })
    .filter((l, i, arr) => l || (i > 0 && arr[i - 1]))
    .join('\n\n')
  return `# ${baseName(file.name)}\n\n${md}\n`
}

export async function getPageCount(file: File): Promise<number> {
  try {
    const doc = await loadDoc(file)
    return doc.getPageCount()
  } catch {
    const data = await fileToBytes(file)
    const pdf = await pdfjs.getDocument({ data: data.slice() }).promise
    return pdf.numPages
  }
}

export async function renderPreview(
  file: File,
  pageIndex = 0,
  scale = 1.1,
): Promise<string> {
  const canvas = await renderPageToCanvas(file, pageIndex, scale)
  return canvas.toDataURL('image/jpeg', 0.86)
}

export async function renderAllThumbnails(
  file: File,
  maxPages = 40,
  scale = 0.35,
): Promise<string[]> {
  const count = await getPageCount(file)
  const n = Math.min(count, maxPages)
  const thumbs: string[] = []
  for (let i = 0; i < n; i++) {
    const canvas = await renderPageToCanvas(file, i, scale)
    thumbs.push(canvas.toDataURL('image/jpeg', 0.75))
  }
  return thumbs
}

/** Parse "1,3,5-7" into 1-based page numbers within 1..pageCount */
export function parsePageSpec(input: string, pageCount: number): number[] {
  const out = new Set<number>()
  for (const part of input.split(',')) {
    const p = part.trim()
    if (!p) continue
    if (p.includes('-')) {
      const [a, b] = p.split('-').map((x) => parseInt(x.trim(), 10))
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) {
        if (i >= 1 && i <= pageCount) out.add(i)
      }
    } else {
      const n = parseInt(p, 10)
      if (Number.isFinite(n) && n >= 1 && n <= pageCount) out.add(n)
    }
  }
  return [...out].sort((a, b) => a - b)
}

export type { PDFPage }
