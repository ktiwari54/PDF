/**
 * Bulk sensitive-data masking for dragonPDF.
 * Detects PII / business identifiers via regex and covers them on the PDF.
 */
import { PDFDocument, rgb } from '@cantoo/pdf-lib'
import * as pdfjs from 'pdfjs-dist'
import Tesseract from 'tesseract.js'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export type MaskCategory =
  | 'email'
  | 'phone'
  | 'address'
  | 'amount'
  | 'ssn'
  | 'vat'
  | 'gst'
  | 'tradeLicense'
  | 'lastName'
  | 'custom'

export type MaskOptions = {
  categories: Partial<Record<MaskCategory, boolean>>
  /** Last names to mask (case-insensitive), one per line or comma-separated */
  lastNames?: string
  /** Extra custom regex patterns (one per line, without /flags/) */
  customPatterns?: string
  /** Black bar vs whiteout */
  style?: 'black' | 'white' | 'blur'
  /** Padding around matches (normalized fraction of page when OCR; points-ish for text) */
  pad?: number
  /**
   * OCR scanned / image-only pages (Tesseract).
   * auto = OCR when page has little extractable text
   * always = OCR every page (slower, more accurate on scans)
   * never = text layer only
   */
  ocrMode?: 'auto' | 'always' | 'never'
  /** Tesseract language codes, e.g. eng, eng+ara, eng+hin */
  ocrLang?: string
  /** Max render width for OCR (higher = better accuracy, slower) */
  ocrMaxWidth?: number
  /** Progress callback */
  onProgress?: (msg: string) => void
}

export type MaskHit = {
  page: number
  category: MaskCategory
  text: string
}

export type MaskResult = {
  bytes: Uint8Array
  hits: MaskHit[]
  hitCount: number
}

export type FileJobResult = {
  name: string
  ok: boolean
  hitCount: number
  error?: string
  categories?: Partial<Record<MaskCategory, number>>
}

export const MASK_CATEGORY_META: {
  id: MaskCategory
  label: string
  description: string
  defaultOn: boolean
}[] = [
  {
    id: 'email',
    label: 'Email addresses',
    description: 'name@company.com',
    defaultOn: true,
  },
  {
    id: 'phone',
    label: 'Phone / contact numbers',
    description: 'Mobile, landline, international',
    defaultOn: true,
  },
  {
    id: 'address',
    label: 'Street addresses',
    description: 'Street / road / avenue style lines',
    defaultOn: true,
  },
  {
    id: 'amount',
    label: 'Money amounts (bills)',
    description: 'Currency amounts like $1,200.00 or ₹5,000',
    defaultOn: true,
  },
  {
    id: 'ssn',
    label: 'Security / national ID numbers',
    description: 'SSN-style and similar ID numbers',
    defaultOn: true,
  },
  {
    id: 'vat',
    label: 'VAT numbers',
    description: 'EU and labeled VAT IDs',
    defaultOn: true,
  },
  {
    id: 'gst',
    label: 'GST numbers',
    description: 'India GSTIN and labeled GST',
    defaultOn: true,
  },
  {
    id: 'tradeLicense',
    label: 'Trade license numbers',
    description: 'Trade / commercial license IDs',
    defaultOn: true,
  },
  {
    id: 'lastName',
    label: 'Last names',
    description: 'Names you list below (recommended)',
    defaultOn: true,
  },
  {
    id: 'custom',
    label: 'Custom patterns',
    description: 'Your own regular expressions',
    defaultOn: false,
  },
]

/** Build regex list for enabled categories */
export function buildMatchers(options: MaskOptions): {
  category: MaskCategory
  re: RegExp
}[] {
  const out: { category: MaskCategory; re: RegExp }[] = []
  const on = options.categories || {}

  const add = (category: MaskCategory, sources: RegExp[]) => {
    if (!on[category]) return
    for (const re of sources) {
      out.push({ category, re: new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g') })
    }
  }

  add('email', [
    /\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b/gi,
  ])

  add('phone', [
    /(?:\+?\d{1,3}[\s\-.]?)?(?:\(?\d{2,4}\)?[\s\-.]?)?\d{3,4}[\s\-.]\d{3,4}\b/g,
    /(?:\+?\d{1,3}[\s\-.]?)?\d{10,12}\b/g,
    /(?:tel|phone|mobile|cell|whatsapp|fax)[:\s]*[+()\d\s\-.]{7,20}/gi,
  ])

  add('address', [
    /\b\d{1,5}\s+[A-Za-z0-9.'\-\s]{2,40}\b(?:Street|St\.?|Road|Rd\.?|Avenue|Ave\.?|Lane|Ln\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Way|Court|Ct\.?|Place|Pl\.?|Terrace|Ter\.?|Highway|Hwy\.?|Suite|Ste\.?|Apartment|Apt\.?)\b[^\n,]{0,40}/gi,
    /\b(?:P\.?\s*O\.?\s*Box|PO Box)\s+\d+\b/gi,
    /\b\d{5}(?:-\d{4})?\b(?=.*(?:USA|United States|ZIP))?/g, // zip-ish — kept mild
  ])

  add('amount', [
    /(?:USD|EUR|GBP|INR|AED|SAR|QAR|OMR|KWD|\$|€|£|₹|¥)\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\b/gi,
    /\b\d{1,3}(?:,\d{3})+(?:\.\d{2})\b/g,
    /\b(?:amount|total|balance|due|paid|invoice\s*value|grand\s*total)[:\s]*[$€£₹]?\s?\d[\d,]*(?:\.\d{2})?/gi,
  ])

  add('ssn', [
    /\b\d{3}-\d{2}-\d{4}\b/g, // US SSN
    /\b\d{3}\s\d{2}\s\d{4}\b/g,
    /\b(?:SSN|Social Security|National ID|Aadhaar|Aadhar|Emirates ID|IQAMA|Civil ID)[:\s#]*[A-Za-z0-9\-\s]{5,20}/gi,
    /\b\d{4}\s\d{4}\s\d{4}\b/g, // Aadhaar-like grouped
  ])

  add('vat', [
    /\b(?:VAT|V\.A\.T\.|Tax ID|TIN)[:\s#]*[A-Z0-9]{8,15}\b/gi,
    /\b(?:AT|BE|BG|CY|CZ|DE|DK|EE|EL|ES|FI|FR|GB|HR|HU|IE|IT|LT|LU|LV|MT|NL|PL|PT|RO|SE|SI|SK)[A-Z0-9]{8,12}\b/g,
  ])

  add('gst', [
    /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/g, // India GSTIN
    /\b(?:GSTIN|GST\s*No\.?|GST\s*Number)[:\s#]*[A-Z0-9]{10,20}\b/gi,
  ])

  add('tradeLicense', [
    /\b(?:Trade\s*License|Commercial\s*License|Business\s*License|TL\s*No\.?|License\s*No\.?)[:\s#]*[A-Z0-9\-\/]{5,25}\b/gi,
    /\b(?:TL|CL)[-/\s]?\d{5,15}\b/gi,
  ])

  if (on.lastName) {
    const names = parseNameList(options.lastNames || '')
    for (const name of names) {
      // Word-boundary match for each last name
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      out.push({
        category: 'lastName',
        re: new RegExp(`\\b${escaped}\\b`, 'gi'),
      })
    }
  }

  if (on.custom && options.customPatterns?.trim()) {
    for (const line of options.customPatterns.split(/\n/)) {
      const raw = line.trim()
      if (!raw || raw.startsWith('#')) continue
      try {
        // Support /pattern/flags or plain pattern
        const m = raw.match(/^\/(.+)\/([gimsuy]*)$/)
        const re = m
          ? new RegExp(m[1], m[2].includes('g') ? m[2] : m[2] + 'g')
          : new RegExp(raw, 'gi')
        out.push({ category: 'custom', re })
      } catch {
        /* skip invalid */
      }
    }
  }

  return out
}

function parseNameList(text: string): string[] {
  return text
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2)
    .slice(0, 5000) // hard cap
}

type Box = {
  page: number
  /** normalized 0–1 top-left origin (viewport space) */
  x: number
  y: number
  w: number
  h: number
  category: MaskCategory
  text: string
}

type TextItem = {
  str: string
  /** normalized 0–1 top-left */
  x: number
  y: number
  w: number
  h: number
}

/**
 * Mask sensitive data in one PDF (digital text + scanned OCR).
 * Returns redacted bytes + hit log.
 */
export async function maskSensitivePdf(
  data: Uint8Array,
  options: MaskOptions,
): Promise<MaskResult> {
  const matchers = buildMatchers(options)
  if (!matchers.length) {
    throw new Error(
      'Enable at least one masking category (or add last names / custom patterns).',
    )
  }

  const ocrMode = options.ocrMode ?? 'auto'
  const ocrLang = options.ocrLang || 'eng'
  const ocrMaxWidth = options.ocrMaxWidth ?? 1400
  const padN = (options.pad ?? 1.5) / 400 // ~normalize pad to fraction
  const onProgress = options.onProgress

  const pdf = await pdfjs.getDocument({ data: data.slice() }).promise
  const boxes: Box[] = []
  const hits: MaskHit[] = []
  let usedOcr = false

  for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
    onProgress?.(
      `Page ${pageIndex + 1}/${pdf.numPages}: reading text…`,
    )
    const page = await pdf.getPage(pageIndex + 1)
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()

    let items: TextItem[] = extractTextItems(content, viewport)

    const textChars = items.reduce((n, it) => n + it.str.trim().length, 0)
    const looksScanned =
      items.length < 8 || textChars < 40

    const shouldOcr =
      ocrMode === 'always' || (ocrMode === 'auto' && looksScanned)

    if (shouldOcr) {
      usedOcr = true
      onProgress?.(
        `Page ${pageIndex + 1}/${pdf.numPages}: OCR (scanned image)… first run may download language data`,
      )
      try {
        const ocrItems = await ocrPageItems(page, ocrMaxWidth, ocrLang, (p) => {
          if (p != null) {
            onProgress?.(
              `Page ${pageIndex + 1}/${pdf.numPages}: OCR ${Math.round(p * 100)}%`,
            )
          }
        })
        // Prefer OCR items when page is scanned; merge if always mode with existing text
        if (looksScanned || ocrMode === 'always') {
          if (ocrMode === 'always' && items.length) {
            items = [...items, ...ocrItems]
          } else {
            items = ocrItems.length ? ocrItems : items
          }
        }
      } catch (e) {
        onProgress?.(
          `Page ${pageIndex + 1}: OCR failed (${e instanceof Error ? e.message : 'error'}) — using text layer only`,
        )
      }
    }

    collectMatches(items, matchers, pageIndex, padN, boxes, hits)
  }

  onProgress?.(
    usedOcr
      ? `Applying ${boxes.length} redaction(s) (included OCR)…`
      : `Applying ${boxes.length} redaction(s)…`,
  )

  // Apply covers with pdf-lib (non-destructive overlay)
  const doc = await PDFDocument.load(data, { ignoreEncryption: true })
  const pages = doc.getPages()
  const style = options.style || 'black'
  const fill =
    style === 'white'
      ? rgb(1, 1, 1)
      : style === 'blur'
        ? rgb(0.85, 0.85, 0.85)
        : rgb(0, 0, 0)

  for (const box of boxes) {
    const page = pages[box.page]
    if (!page) continue
    const { width: W, height: H } = page.getSize()
    const x = box.x * W
    const h = box.h * H
    const y = H - (box.y + box.h) * H
    const w = box.w * W

    page.drawRectangle({
      x: clamp(x, 0, W),
      y: clamp(y, 0, H),
      width: clamp(w, 1, W),
      height: clamp(h, 1, H),
      color: fill,
      borderWidth: 0,
      opacity: style === 'blur' ? 0.92 : 1,
    })
  }

  const bytes = await doc.save({ useObjectStreams: false })
  return {
    bytes: new Uint8Array(bytes),
    hits,
    hitCount: hits.length,
  }
}

function extractTextItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: { items: any[] },
  viewport: { width: number; height: number; transform: number[] },
): TextItem[] {
  const vw = viewport.width
  const vh = viewport.height
  const items: TextItem[] = []

  for (const item of content.items) {
    if (!('str' in item)) continue
    const it = item as {
      str: string
      transform: number[]
      width: number
      height: number
    }
    const str = it.str
    if (!str || !str.trim()) continue
    const m = pdfjs.Util.transform(viewport.transform, it.transform)
    const fontHeight = Math.hypot(m[2], m[3]) || 10
    const fontWidthScale = Math.hypot(m[0], m[1]) || 1
    const w = Math.max((it.width || str.length * 0.5) * fontWidthScale, 2)
    const h = Math.max(fontHeight, 6)
    const x = m[4]
    const yTop = m[5] - h * 0.8
    items.push({
      str,
      x: x / vw,
      y: yTop / vh,
      w: w / vw,
      h: h / vh,
    })
  }
  return items
}

/** Rasterize page + OCR words with bounding boxes (normalized 0–1). */
async function ocrPageItems(
  page: pdfjs.PDFPageProxy,
  maxWidth: number,
  lang: string,
  onProgress?: (p: number | null) => void,
): Promise<TextItem[]> {
  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(2.2, maxWidth / base.width)
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

  const result = await Tesseract.recognize(canvas, lang, {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof m.progress === 'number') {
        onProgress?.(m.progress)
      }
    },
  })

  const cw = canvas.width
  const ch = canvas.height
  const items: TextItem[] = []

  // Tesseract page data includes words/lines at runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pageData = result.data as any
  const words = (pageData.words || []) as {
    text?: string
    confidence?: number
    bbox: { x0: number; y0: number; x1: number; y1: number }
  }[]
  for (const word of words) {
    const text = (word.text || '').trim()
    if (!text || text.length < 1) continue
    if ((word.confidence ?? 0) < 35) continue
    const b = word.bbox
    items.push({
      str: text,
      x: b.x0 / cw,
      y: b.y0 / ch,
      w: Math.max((b.x1 - b.x0) / cw, 0.005),
      h: Math.max((b.y1 - b.y0) / ch, 0.006),
    })
  }

  // Full lines for multi-word emails / IDs split across words
  const lines = (pageData.lines || []) as {
    text?: string
    bbox: { x0: number; y0: number; x1: number; y1: number }
  }[]
  for (const line of lines) {
    const text = (line.text || '').trim()
    if (!text || text.length < 3) continue
    const b = line.bbox
    items.push({
      str: text,
      x: b.x0 / cw,
      y: b.y0 / ch,
      w: Math.max((b.x1 - b.x0) / cw, 0.01),
      h: Math.max((b.y1 - b.y0) / ch, 0.008),
    })
  }

  return items
}

function collectMatches(
  items: TextItem[],
  matchers: { category: MaskCategory; re: RegExp }[],
  pageIndex: number,
  padN: number,
  boxes: Box[],
  hits: MaskHit[],
) {
  const pad = Math.max(padN, 0.002)

  const pushBox = (
    category: MaskCategory,
    text: string,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => {
    const box: Box = {
      page: pageIndex,
      x: Math.max(0, x - pad),
      y: Math.max(0, y - pad),
      w: Math.min(1, w + pad * 2),
      h: Math.min(1, h + pad * 2),
      category,
      text: text.slice(0, 80),
    }
    // de-dupe near-identical boxes
    const dup = boxes.some(
      (b) =>
        b.page === pageIndex &&
        Math.abs(b.x - box.x) < 0.008 &&
        Math.abs(b.y - box.y) < 0.008 &&
        Math.abs(b.w - box.w) < 0.02,
    )
    if (dup) return
    boxes.push(box)
    hits.push({ page: pageIndex + 1, category, text: text.slice(0, 80) })
  }

  // Per-item match
  for (const it of items) {
    for (const { category, re } of matchers) {
      re.lastIndex = 0
      if (re.test(it.str)) {
        re.lastIndex = 0
        pushBox(category, it.str.trim(), it.x, it.y, it.w, it.h)
        break
      }
    }
  }

  // Line groups for split tokens
  const lines = groupItemsIntoLines(
    items.map((it) => ({
      str: it.str,
      x: it.x,
      y: it.y,
      w: it.w,
      h: it.h,
    })),
  )
  for (const line of lines) {
    const joined = line.map((i) => i.str).join('')
    const spaced = line.map((i) => i.str).join(' ')
    for (const text of [joined, spaced]) {
      for (const { category, re } of matchers) {
        re.lastIndex = 0
        const match = re.exec(text)
        if (!match) continue
        const minX = Math.min(...line.map((i) => i.x))
        const maxX = Math.max(...line.map((i) => i.x + i.w))
        const minY = Math.min(...line.map((i) => i.y))
        const maxY = Math.max(...line.map((i) => i.y + i.h))
        pushBox(category, match[0], minX, minY, maxX - minX, maxY - minY)
      }
    }
  }
}

function groupItemsIntoLines(
  items: { str: string; x: number; y: number; w: number; h: number }[],
) {
  if (!items.length) return [] as (typeof items)[]
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x)
  const lines: (typeof items)[] = []
  let cur: typeof items = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const it = sorted[i]
    const prev = cur[cur.length - 1]
    if (Math.abs(it.y - prev.y) <= Math.max(prev.h, it.h) * 0.5) {
      cur.push(it)
    } else {
      lines.push(cur.sort((a, b) => a.x - b.x))
      cur = [it]
    }
  }
  lines.push(cur.sort((a, b) => a.x - b.x))
  return lines
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function countByCategory(
  hits: MaskHit[],
): Partial<Record<MaskCategory, number>> {
  const c: Partial<Record<MaskCategory, number>> = {}
  for (const h of hits) {
    c[h.category] = (c[h.category] || 0) + 1
  }
  return c
}

export function defaultMaskOptions(): MaskOptions {
  const categories: Partial<Record<MaskCategory, boolean>> = {}
  for (const m of MASK_CATEGORY_META) {
    categories[m.id] = m.defaultOn && m.id !== 'custom'
  }
  return {
    categories,
    lastNames: '',
    customPatterns: '',
    style: 'black',
    pad: 1.5,
    ocrMode: 'auto',
    ocrLang: 'eng',
    ocrMaxWidth: 1400,
  }
}

/** Simple concurrency pool for bulk jobs */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
  shouldCancel?: () => boolean,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  let done = 0
  const total = items.length

  async function run() {
    while (true) {
      if (shouldCancel?.()) return
      const i = next++
      if (i >= total) return
      results[i] = await worker(items[i], i)
      done++
      onProgress?.(done, total)
      // Yield to UI
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  const n = Math.max(1, Math.min(concurrency, total || 1))
  await Promise.all(Array.from({ length: n }, () => run()))
  return results
}

// ——— File System Access helpers (Chrome / Edge) ———

export type DirHandle = FileSystemDirectoryHandle

export async function pickInputDirectory(
  mode: 'read' | 'readwrite' = 'readwrite',
): Promise<DirHandle | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  if (!w.showDirectoryPicker) return null
  try {
    // readwrite so we can save masked files back into the same folder
    return await w.showDirectoryPicker({ mode })
  } catch {
    return null
  }
}

export async function pickOutputDirectory(): Promise<DirHandle | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  if (!w.showDirectoryPicker) return null
  try {
    return await w.showDirectoryPicker({ mode: 'readwrite' })
  } catch {
    return null
  }
}

/** Write bytes under dir, optionally creating nested path parts and/or a subfolder */
export async function writeMaskedFile(
  root: DirHandle,
  relativePath: string,
  bytes: Uint8Array,
  opts?: {
    /** e.g. "masked" — created under root; empty = write next to originals */
    subfolder?: string
    /** filename suffix before .pdf */
    suffix?: string
  },
): Promise<string> {
  const subfolder = opts?.subfolder ?? ''
  const suffix = opts?.suffix ?? '_masked'
  const safePath = relativePath.replace(/[<>:"|?*]/g, '_')
  const parts = safePath.split(/[/\\]/).filter(Boolean)
  const fileName = parts.pop() || 'document.pdf'
  const base = fileName.replace(/\.pdf$/i, '') + suffix + '.pdf'

  let dir: DirHandle = root
  if (subfolder) {
    dir = await dir.getDirectoryHandle(subfolder, { create: true })
  }
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: true })
  }
  const fh = await dir.getFileHandle(base, { create: true })
  const writable = await fh.createWritable()
  await writable.write(bytes)
  await writable.close()

  const prefix = subfolder ? `${subfolder}/` : ''
  const rel = parts.length ? `${parts.join('/')}/` : ''
  return `${prefix}${rel}${base}`
}

export async function listPdfsInDirectory(
  dir: DirHandle,
  maxFiles = 10000,
): Promise<{ name: string; handle: FileSystemFileHandle; path: string }[]> {
  const out: { name: string; handle: FileSystemFileHandle; path: string }[] = []

  async function walk(d: DirHandle, prefix: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const [name, handle] of (d as any).entries()) {
      if (out.length >= maxFiles) return
      if (handle.kind === 'file' && /\.pdf$/i.test(name)) {
        out.push({ name, handle, path: prefix ? `${prefix}/${name}` : name })
      } else if (handle.kind === 'directory') {
        await walk(handle, prefix ? `${prefix}/${name}` : name)
      }
    }
  }

  await walk(dir, '')
  return out
}

export async function readFileHandle(
  handle: FileSystemFileHandle,
): Promise<Uint8Array> {
  const file = await handle.getFile()
  return new Uint8Array(await file.arrayBuffer())
}

export async function writePdfToDirectory(
  dir: DirHandle,
  fileName: string,
  bytes: Uint8Array,
  subfolder = 'masked',
): Promise<void> {
  let target = dir
  if (subfolder) {
    target = await dir.getDirectoryHandle(subfolder, { create: true })
  }
  const safe = fileName.replace(/[<>:"/\\|?*]/g, '_').replace(/\.pdf$/i, '') + '_masked.pdf'
  const fh = await target.getFileHandle(safe, { create: true })
  const writable = await fh.createWritable()
  await writable.write(bytes)
  await writable.close()
}

export function supportsDirectoryPicker(): boolean {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return typeof (window as any).showDirectoryPicker === 'function'
}

export function buildReportCsv(results: FileJobResult[]): string {
  const lines = [
    'file,status,hits,error,email,phone,address,amount,ssn,vat,gst,tradeLicense,lastName,custom',
  ]
  for (const r of results) {
    const c = r.categories || {}
    lines.push(
      [
        csvEscape(r.name),
        r.ok ? 'ok' : 'error',
        r.hitCount,
        csvEscape(r.error || ''),
        c.email || 0,
        c.phone || 0,
        c.address || 0,
        c.amount || 0,
        c.ssn || 0,
        c.vat || 0,
        c.gst || 0,
        c.tradeLicense || 0,
        c.lastName || 0,
        c.custom || 0,
      ].join(','),
    )
  }
  return lines.join('\n')
}

function csvEscape(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}
