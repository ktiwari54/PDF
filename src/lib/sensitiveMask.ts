/**
 * Bulk sensitive-data masking for dragonPDF.
 * Detects PII / business identifiers via regex and covers them on the PDF.
 */
import { PDFDocument, rgb } from '@cantoo/pdf-lib'
import * as pdfjs from 'pdfjs-dist'

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
  /** Padding around matches in points */
  pad?: number
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

/**
 * Mask sensitive data in one PDF. Returns redacted bytes + hit log.
 */
export async function maskSensitivePdf(
  data: Uint8Array,
  options: MaskOptions,
): Promise<MaskResult> {
  const matchers = buildMatchers(options)
  if (!matchers.length) {
    throw new Error('Enable at least one masking category (or add last names / custom patterns).')
  }

  const pdf = await pdfjs.getDocument({ data: data.slice() }).promise
  const boxes: Box[] = []
  const hits: MaskHit[] = []
  const pad = options.pad ?? 1.5

  for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex++) {
    const page = await pdf.getPage(pageIndex + 1)
    const viewport = page.getViewport({ scale: 1 })
    const vw = viewport.width
    const vh = viewport.height
    const content = await page.getTextContent()
    const items: {
      str: string
      x: number
      y: number
      w: number
      h: number
    }[] = []

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
      items.push({ str, x, y: yTop, w, h })
    }

    const toNorm = (x: number, y: number, w: number, h: number) => ({
      x: (x - pad) / vw,
      y: (y - pad) / vh,
      w: (w + pad * 2) / vw,
      h: (h + pad * 2) / vh,
    })

    // Match per item
    for (const it of items) {
      for (const { category, re } of matchers) {
        re.lastIndex = 0
        if (re.test(it.str)) {
          re.lastIndex = 0
          const n = toNorm(it.x, it.y, it.w, it.h)
          boxes.push({
            page: pageIndex,
            ...n,
            category,
            text: it.str.trim().slice(0, 80),
          })
          hits.push({
            page: pageIndex + 1,
            category,
            text: it.str.trim().slice(0, 80),
          })
          break
        }
      }
    }

    // Line-joined matching for split emails / multi-span values
    const lines = groupItemsIntoLines(items)
    for (const line of lines) {
      const joined = line.map((i) => i.str).join('')
      const joinedSpaced = line.map((i) => i.str).join(' ')
      for (const text of [joined, joinedSpaced]) {
        for (const { category, re } of matchers) {
          re.lastIndex = 0
          const match = re.exec(text)
          if (!match) continue
          const minX = Math.min(...line.map((i) => i.x))
          const maxX = Math.max(...line.map((i) => i.x + i.w))
          const minY = Math.min(...line.map((i) => i.y))
          const maxY = Math.max(...line.map((i) => i.y + i.h))
          const n = toNorm(minX, minY, maxX - minX, maxY - minY)
          const already = boxes.some(
            (b) =>
              b.page === pageIndex &&
              Math.abs(b.x - n.x) < 0.01 &&
              Math.abs(b.y - n.y) < 0.01,
          )
          if (already) continue
          boxes.push({
            page: pageIndex,
            ...n,
            category,
            text: match[0].slice(0, 80),
          })
          hits.push({
            page: pageIndex + 1,
            category,
            text: match[0].slice(0, 80),
          })
        }
      }
    }
  }

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

export async function pickInputDirectory(): Promise<DirHandle | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  if (!w.showDirectoryPicker) return null
  try {
    return await w.showDirectoryPicker({ mode: 'read' })
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
