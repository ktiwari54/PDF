/**
 * Bulk sensitive-data masking for dragonPDF.
 * Detects PII / business identifiers via regex and covers them on the PDF.
 */
import { PDFDocument, rgb, StandardFonts } from '@cantoo/pdf-lib'
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
  | 'companyName'
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
  /** Company / business names to force-mask (one per line or comma-separated) */
  companyNames?: string
  /** Extra custom regex patterns (one per line, without /flags/) */
  customPatterns?: string
  /**
   * How to hide sensitive data:
   * - asterisk: replace with **** (keeps rough length; refined look)
   * - blur: soft pixel mosaic over the region
   * - black / white: solid redaction bars
   */
  style?: 'asterisk' | 'blur' | 'black' | 'white'
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
    defaultOn: false,
  },
  {
    id: 'phone',
    label: 'Phone / contact numbers',
    description: 'Mobile, landline, international',
    defaultOn: false,
  },
  {
    id: 'lastName',
    label: 'Person names (auto)',
    description: 'Resume heading names, Full Name fields, optional name list',
    defaultOn: false,
  },
  {
    id: 'companyName',
    label: 'Company / business names',
    description: 'Auto-detect company names on invoices, letterheads, resumes',
    defaultOn: false,
  },
  {
    id: 'address',
    label: 'Addresses',
    description: 'Street, building, PO Box, labeled Address / Bill To lines',
    defaultOn: false,
  },
  {
    id: 'amount',
    label: 'Money amounts (bills)',
    description: 'Currency amounts like $1,200.00 or ₹5,000',
    defaultOn: false,
  },
  {
    id: 'ssn',
    label: 'Security & registration numbers',
    description: 'SSN, EIN, CIN, CR No, company registration, PAN, etc.',
    defaultOn: false,
  },
  {
    id: 'vat',
    label: 'VAT / Tax ID numbers',
    description: 'VAT, TIN, tax registration IDs',
    defaultOn: false,
  },
  {
    id: 'gst',
    label: 'GST numbers',
    description: 'GSTIN and labeled GST numbers',
    defaultOn: false,
  },
  {
    id: 'tradeLicense',
    label: 'Trade / commercial licenses',
    description: 'Trade license, commercial license, shop establishment',
    defaultOn: false,
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

  // —— Person names (labeled; resume heading handled by auto-detect) ——
  add('lastName', [
    /(?:Full\s*Name|Candidate\s*Name|Employee\s*Name|Applicant\s*Name|Contact\s*Name|Person\s*Name|Name\s*of\s*(?:the\s*)?(?:Candidate|Employee|Person)|Name)[:\s#]+[A-Z][a-zA-Z.'\-]{1,30}(?:\s+[A-Z][a-zA-Z.'\-]{1,30}){0,4}/g,
    /(?:Mr\.?|Mrs\.?|Ms\.?|Miss|Dr\.?|Prof\.?)\s+[A-Z][a-zA-Z.'\-]{1,30}(?:\s+[A-Z][a-zA-Z.'\-]{1,30}){0,3}/g,
  ])

  // —— Company / business names ——
  add('companyName', [
    // Labeled fields
    /(?:Company\s*Name|Business\s*Name|Employer|Organisation|Organization|Current\s*Company|Previous\s*Company|Company|Business|Firm|Vendor|Supplier|Customer\s*Name|Client\s*Name|Bill\s*To|Sold\s*To|Ship\s*To|Buyer|Seller|Merchant|Trader|M\/S|M\/s|Messrs\.?|Trading\s*As|T\/A|Worked\s*at|Worked\s*for)[:\s#]+[A-Za-z0-9&.,'"()\-\s]{2,90}/gi,
    // Legal entity suffixes
    /\b[A-Z][A-Za-z0-9&.,'"()\-\s]{0,55}?\b(?:LLC|L\.L\.C\.|Ltd\.?|Limited|Inc\.?|Incorporated|Corp\.?|Corporation|PLC|Pvt\.?\s*Ltd\.?|Private\s+Limited|LLP|GmbH|S\.?A\.?R\.?L\.?|S\.?A\.?|B\.?V\.?|N\.?V\.?|Co\.|Company|FZE|FZCO|FZ\-?LLC|WLL|O\.?P\.?C\.?|Sole\s+Proprietorship|SPC|JSC)\b/gi,
    // Industry-style names
    /\b[A-Z][A-Za-z0-9&.'\-]{1,30}(?:\s+[A-Z][A-Za-z0-9&.'\-]{1,20}){0,5}\s+(?:Trading|Enterprises|Industries|Solutions|Services|Technologies|Technology|Holdings|Group|International|Global|Logistics|Construction|Contracting|Consultancy|Consultants|Partners|Associates|Systems|Software|Digital|Media|Foods|Textiles|Motors|Engineering|Healthcare|Pharma|Bank|Insurance)\b/gi,
    // Employer on resume lines: "at Google" / "— Amazon"
    /(?:\bat\b|\bwith\b|\bfor\b|@)\s+[A-Z][A-Za-z0-9&.'\-]{1,40}(?:\s+[A-Z][A-Za-z0-9&.'\-]{1,30}){0,3}/g,
  ])

  // Optional explicit company name list
  if (on.companyName) {
    const companies = parseNameList(options.companyNames || '')
    for (const name of companies) {
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const flexible = escaped.replace(/\s+/g, '\\s+')
      out.push({
        category: 'companyName',
        re: new RegExp(`\\b${flexible}\\b`, 'gi'),
      })
    }
  }

  // —— Addresses (digital + OCR-friendly) ——
  add('address', [
    // Labeled address lines
    /(?:Address|Registered\s*Office|Regd\.?\s*Office|Billing\s*Address|Shipping\s*Address|Office\s*Address|Postal\s*Address|Mailing\s*Address|Location|Premise|Premises|Head\s*Office|Branch\s*Office)[:\s#]+[^\n]{4,120}/gi,
    // Street-style
    /\b\d{1,6}[A-Za-z]?\s+[A-Za-z0-9.'\-\s]{2,50}\b(?:Street|St\.?|Road|Rd\.?|Avenue|Ave\.?|Lane|Ln\.?|Boulevard|Blvd\.?|Drive|Dr\.?|Way|Court|Ct\.?|Place|Pl\.?|Terrace|Ter\.?|Highway|Hwy\.?|Circle|Cir\.?|Parkway|Pkwy\.?|Square|Sq\.?)\b[^\n]{0,50}/gi,
    // Building / flat / villa (common on invoices, GCC, India)
    /\b(?:Flat|Apartment|Apt\.?|Suite|Ste\.?|Unit|Villa|Building|Bldg\.?|Tower|Floor|Block|Plot|House\s*No\.?|H\.?\s*No\.?|Door\s*No\.?|Shop\s*No\.?)[\s#:.\-]*[A-Za-z0-9\-\/]{1,12}[^\n]{0,60}/gi,
    // PO Box
    /\b(?:P\.?\s*O\.?\s*Box|PO\s*Box|Post\s*Box|P\.O\.B\.?)[\s#:]*\d{1,8}\b[^\n]{0,40}/gi,
    // City, ST ZIP
    /\b[A-Z][a-zA-Z.\- ]{2,30},\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/g,
    // ZIP / PIN labeled
    /\b(?:ZIP|Pin\s*Code|Pincode|Postal\s*Code)[:\s#]*\d{4,10}\b/gi,
    // UAE / GCC style free zones & areas often on bills
    /\b(?:Dubai|Abu\s*Dhabi|Sharjah|Ajman|Ras\s*Al\s*Khaimah|Fujairah|Umm\s*Al\s*Quwain|Doha|Riyadh|Jeddah|Muscat|Kuwait|Manama)[^\n]{0,40}/gi,
  ])

  add('amount', [
    /(?:USD|EUR|GBP|INR|AED|SAR|QAR|OMR|KWD|\$|€|£|₹|¥)\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\b/gi,
    /\b\d{1,3}(?:,\d{3})+(?:\.\d{2})\b/g,
    /\b(?:amount|total|balance|due|paid|invoice\s*value|grand\s*total)[:\s]*[$€£₹]?\s?\d[\d,]*(?:\.\d{2})?/gi,
  ])

  // Person + company security / registration numbers
  add('ssn', [
    /\b\d{3}-\d{2}-\d{4}\b/g, // US SSN
    /\b\d{3}\s\d{2}\s\d{4}\b/g,
    /\b(?:SSN|Social Security|National ID|Aadhaar|Aadhar|Emirates ID|IQAMA|Civil ID|Passport\s*No\.?|National\s*Insurance)[:\s#]*[A-Za-z0-9\-\s]{5,22}/gi,
    /\b\d{4}\s\d{4}\s\d{4}\b/g, // Aadhaar-like
    // Company registration / security IDs
    /\b(?:CIN|Corporate\s*Identity\s*(?:No\.?|Number)|Company\s*(?:Reg(?:istration)?\.?\s*)?(?:No\.?|Number)|CR\s*(?:No\.?|Number)|Commercial\s*Registration|Registration\s*(?:No\.?|Number)|Reg\.?\s*No\.?|EIN|Employer\s*ID|D\-?U\-?N\-?S|DUNS|UEN|BRN|Business\s*Reg(?:istration)?\.?\s*(?:No\.?|Number)|Company\s*Number|Co\.?\s*Reg\.?\s*No\.?|PAN|TAN|DIN|MSME|Udyam|IEC|Import\s*Export\s*Code)[:\s#]*[A-Z0-9\-\/]{5,25}/gi,
    // India CIN: L12345MH2020PLC123456
    /\b[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}\b/g,
    // US EIN 12-3456789
    /\b\d{2}-\d{7}\b/g,
    // PAN (India person/company)
    /\b[A-Z]{5}\d{4}[A-Z]\b/g,
  ])

  add('vat', [
    /\b(?:VAT|V\.A\.T\.|VAT\s*(?:No\.?|Number|Reg\.?|Registration)|Tax\s*ID|TIN|TRN|Tax\s*Reg(?:istration)?\.?\s*(?:No\.?|Number))[:\s#]*[A-Z0-9]{6,18}\b/gi,
    /\b(?:AT|BE|BG|CY|CZ|DE|DK|EE|EL|ES|FI|FR|GB|HR|HU|IE|IT|LT|LU|LV|MT|NL|PL|PT|RO|SE|SI|SK|AE|SA)[A-Z0-9]{8,14}\b/g,
  ])

  add('gst', [
    /\b\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b/g, // India GSTIN
    /\b(?:GSTIN|GSTIN\s*No\.?|GST\s*No\.?|GST\s*Number|GST\s*Reg(?:istration)?\.?\s*(?:No\.?|Number)|Goods\s*and\s*Services\s*Tax)[:\s#]*[A-Z0-9]{10,20}\b/gi,
    /\bGST[:\s#]+[A-Z0-9]{10,20}\b/gi,
  ])

  add('tradeLicense', [
    /\b(?:Trade\s*License|Trade\s*Licence|Commercial\s*License|Business\s*License|Shop\s*(?:&|and)?\s*Establishment|S&E|TL\s*No\.?|License\s*No\.?|Licence\s*No\.?|Trade\s*Lic\.?\s*No\.?|Municipal\s*License|Professional\s*License)[:\s#]*[A-Z0-9\-\/]{4,30}\b/gi,
    /\b(?:TL|CL|DED|DMCC|JAFZA|RAKEZ|SHAMS)[-/\s]?[A-Z0-9]{5,20}\b/gi,
    /\bTrade\s*License\s*(?:No\.?|Number|#)?\s*[:\-]?\s*[A-Z0-9\-\/]{5,25}/gi,
  ])

  if (on.lastName) {
    const names = parseNameList(options.lastNames || '')
    for (const name of names) {
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
  /** relative font size (normalized height) */
  fontH?: number
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

    collectMatches(items, matchers, pageIndex, padN, boxes, hits, options)
  }

  onProgress?.(
    usedOcr
      ? `Applying ${boxes.length} redaction(s) (included OCR)…`
      : `Applying ${boxes.length} redaction(s)…`,
  )

  // Merge overlapping boxes so we don't stack messy asterisks
  const merged = mergeBoxes(boxes)

  // Apply refined masks with pdf-lib (overlay; original structure kept)
  const doc = await PDFDocument.load(data, { ignoreEncryption: true })
  const pages = doc.getPages()
  const style = options.style || 'asterisk'
  // Courier = even star spacing (clean, professional)
  const mono = await doc.embedFont(StandardFonts.Courier)

  for (const box of merged) {
    const page = pages[box.page]
    if (!page) continue
    const { width: W, height: H } = page.getSize()
    // Small outer pad so edges don't show original glyphs
    const padX = 1.2
    const padY = 0.8
    const x = clamp(box.x * W - padX, 0, W)
    const h = clamp(box.h * H + padY * 2, 4, H)
    const w = clamp(box.w * W + padX * 2, 8, W)
    const y = clamp(H - (box.y + box.h) * H - padY, 0, H)

    if (style === 'asterisk') {
      applyCleanAsteriskMask(page, mono, x, y, w, h)
    } else if (style === 'blur') {
      applyBlurMosaic(page, x, y, w, h)
    } else {
      const fill = style === 'white' ? rgb(1, 1, 1) : rgb(0, 0, 0)
      page.drawRectangle({
        x,
        y,
        width: w,
        height: h,
        color: fill,
        borderWidth: 0,
      })
    }
  }

  const bytes = await doc.save({ useObjectStreams: false })
  return {
    bytes: new Uint8Array(bytes),
    hits,
    hitCount: hits.length,
  }
}

/** Merge overlapping / nearly-adjacent boxes on the same page into clean regions */
function mergeBoxes(boxes: Box[]): Box[] {
  if (!boxes.length) return []
  const byPage = new Map<number, Box[]>()
  for (const b of boxes) {
    const list = byPage.get(b.page) || []
    list.push({ ...b })
    byPage.set(b.page, list)
  }
  const out: Box[] = []
  for (const [, list] of byPage) {
    // Sort reading order
    list.sort((a, b) => a.y - b.y || a.x - b.x)
    const merged: Box[] = []
    for (const b of list) {
      let hit = false
      for (const m of merged) {
        if (boxesOverlapOrNear(m, b)) {
          const x2 = Math.max(m.x + m.w, b.x + b.w)
          const y2 = Math.max(m.y + m.h, b.y + b.h)
          m.x = Math.min(m.x, b.x)
          m.y = Math.min(m.y, b.y)
          m.w = x2 - m.x
          m.h = y2 - m.y
          m.text = (m.text + ' ' + b.text).slice(0, 80)
          hit = true
          break
        }
      }
      if (!hit) merged.push({ ...b })
    }
    // Second pass to collapse chains
    let changed = true
    while (changed) {
      changed = false
      for (let i = 0; i < merged.length; i++) {
        for (let j = i + 1; j < merged.length; j++) {
          if (boxesOverlapOrNear(merged[i], merged[j])) {
            const a = merged[i]
            const b = merged[j]
            const x2 = Math.max(a.x + a.w, b.x + b.w)
            const y2 = Math.max(a.y + a.h, b.y + b.h)
            a.x = Math.min(a.x, b.x)
            a.y = Math.min(a.y, b.y)
            a.w = x2 - a.x
            a.h = y2 - a.y
            merged.splice(j, 1)
            changed = true
            break
          }
        }
        if (changed) break
      }
    }
    out.push(...merged)
  }
  return out
}

function boxesOverlapOrNear(a: Box, b: Box): boolean {
  if (a.page !== b.page) return false
  // Expand slightly so neighbors on the same line merge
  const padX = 0.012
  const padY = 0.008
  const ax1 = a.x - padX
  const ay1 = a.y - padY
  const ax2 = a.x + a.w + padX
  const ay2 = a.y + a.h + padY
  const bx1 = b.x
  const by1 = b.y
  const bx2 = b.x + b.w
  const by2 = b.y + b.h
  return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1
}

/**
 * Clean professional asterisk mask:
 * - Solid white cover (hides original text completely)
 * - Optional soft light-gray field background
 * - Uniform monospaced ****** fitted to box (no random patterns)
 */
function applyCleanAsteriskMask(
  page: import('@cantoo/pdf-lib').PDFPage,
  mono: import('@cantoo/pdf-lib').PDFFont,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  // 1) Opaque white wipe — no ghosting of original numbers
  page.drawRectangle({
    x: x - 0.4,
    y: y - 0.4,
    width: w + 0.8,
    height: h + 0.8,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  })

  // 2) Subtle professional field background (light slate)
  const inset = 0.4
  page.drawRectangle({
    x: x + inset,
    y: y + inset,
    width: Math.max(1, w - inset * 2),
    height: Math.max(1, h - inset * 2),
    color: rgb(0.96, 0.97, 0.98),
    borderWidth: 0.4,
    borderColor: rgb(0.88, 0.9, 0.92),
  })

  // 3) Font size: neat, readable, never oversized
  const size = Math.max(7, Math.min(h * 0.62, 11))
  const starW = mono.widthOfTextAtSize('*', size)
  if (starW <= 0) return

  // Horizontal padding inside field
  const innerPad = Math.min(4, w * 0.08)
  const usable = Math.max(starW * 3, w - innerPad * 2)

  // Even number of stars that fit cleanly (prefer 4–24)
  let count = Math.floor(usable / starW)
  count = Math.max(4, Math.min(count, 24))
  // Snap to even for visual balance
  if (count % 2 === 1) count -= 1
  if (count < 4) count = 4

  const stars = '*'.repeat(count)
  const textW = mono.widthOfTextAtSize(stars, size)

  // Vertically center baseline in the box
  const baseline = y + (h - size) / 2 + size * 0.12
  // Horizontally center the star run
  const textX = x + (w - textW) / 2

  page.drawText(stars, {
    x: Math.max(x + 1, textX),
    y: Math.max(y + 1, baseline),
    size,
    font: mono,
    color: rgb(0.35, 0.38, 0.42), // professional slate gray
  })
}

/** @deprecated kept for any external use — uniform stars preferred for clean output */
export function toAsteriskString(raw: string): string {
  if (!raw || !raw.trim()) return '****'
  const n = Math.max(4, Math.min(raw.replace(/\s/g, '').length, 16))
  return '*'.repeat(n)
}

/** Soft mosaic blur: small gray tiles of varying shade */
function applyBlurMosaic(
  page: import('@cantoo/pdf-lib').PDFPage,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  // Base soft cover
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color: rgb(0.82, 0.82, 0.84),
    borderWidth: 0,
  })

  const tile = Math.max(2.5, Math.min(w, h) / 6)
  const cols = Math.max(1, Math.ceil(w / tile))
  const rows = Math.max(1, Math.ceil(h / tile))

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Deterministic pseudo-random shade from position
      const n = ((r * 17 + c * 31 + Math.floor(x) + Math.floor(y)) % 40) / 100
      const g = 0.55 + n
      const tw = Math.min(tile, x + w - (x + c * tile))
      const th = Math.min(tile, y + h - (y + r * tile))
      if (tw <= 0.5 || th <= 0.5) continue
      page.drawRectangle({
        x: x + c * tile,
        y: y + r * tile,
        width: tw,
        height: th,
        color: rgb(g, g, g + 0.02),
        borderWidth: 0,
        opacity: 0.85,
      })
    }
  }

  // Light frost overlay
  page.drawRectangle({
    x,
    y,
    width: w,
    height: h,
    color: rgb(0.9, 0.9, 0.92),
    borderWidth: 0,
    opacity: 0.25,
  })
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
      fontH: h / vh,
    })
  }
  return items
}

const RESUME_SECTION_WORDS = new Set(
  [
    'experience',
    'education',
    'skills',
    'projects',
    'summary',
    'objective',
    'profile',
    'contact',
    'references',
    'certifications',
    'achievements',
    'interests',
    'languages',
    'work',
    'history',
    'employment',
    'resume',
    'curriculum',
    'vitae',
    'cv',
    'portfolio',
    'about',
    'me',
    'personal',
    'details',
    'declaration',
    'hobbies',
    'awards',
    'publications',
    'professional',
    'technical',
    'soft',
    'phone',
    'email',
    'address',
    'linkedin',
    'github',
  ].map((s) => s.toLowerCase()),
)

/**
 * Detect person name as resume heading: large text near top, 2–4 name-like words.
 */
function detectResumePersonNames(items: TextItem[]): TextItem[] {
  if (!items.length) return []

  // Group into lines
  const lines = groupItemsIntoLines(
    items.map((it) => ({
      str: it.str,
      x: it.x,
      y: it.y,
      w: it.w,
      h: it.h,
      fontH: it.fontH ?? it.h,
    })),
  )

  type LineInfo = {
    text: string
    x: number
    y: number
    w: number
    h: number
    fontH: number
    items: typeof lines[0]
  }

  const lineInfos: LineInfo[] = lines.map((line) => {
    const text = line
      .map((i) => i.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    const fontH = Math.max(...line.map((i) => (i as TextItem).fontH ?? i.h))
    return {
      text,
      x: Math.min(...line.map((i) => i.x)),
      y: Math.min(...line.map((i) => i.y)),
      w: Math.max(...line.map((i) => i.x + i.w)) - Math.min(...line.map((i) => i.x)),
      h: Math.max(...line.map((i) => i.h)),
      fontH,
      items: line,
    }
  })

  if (!lineInfos.length) return []

  const avgFont =
    lineInfos.reduce((s, l) => s + l.fontH, 0) / lineInfos.length
  const maxFont = Math.max(...lineInfos.map((l) => l.fontH))

  const found: TextItem[] = []

  for (const line of lineInfos) {
    // Must be in top ~22% of page (resume header zone)
    if (line.y > 0.22) continue
    // Prefer larger-than-average or max-ish font
    const large =
      line.fontH >= avgFont * 1.25 || line.fontH >= maxFont * 0.85
    if (!large && line.y > 0.08) continue

    if (!looksLikePersonName(line.text)) continue

    found.push({
      str: line.text,
      x: line.x,
      y: line.y,
      w: Math.max(line.w, 0.08),
      h: Math.max(line.h, line.fontH, 0.015),
      fontH: line.fontH,
    })
  }

  // Keep at most 2 strongest (largest font, highest on page)
  found.sort((a, b) => (b.fontH ?? 0) - (a.fontH ?? 0) || a.y - b.y)
  return found.slice(0, 2)
}

function looksLikePersonName(text: string): boolean {
  const t = text.trim()
  if (t.length < 4 || t.length > 60) return false
  if (/\d/.test(t)) return false
  if (/@|www\.|http/i.test(t)) return false
  if (/[,;:|/\\]/.test(t) && t.split(/[,;]/).length > 2) return false

  const words = t.split(/\s+/).filter(Boolean)
  if (words.length < 2 || words.length > 5) return false

  // Reject section headers
  if (words.every((w) => RESUME_SECTION_WORDS.has(w.toLowerCase()))) return false
  if (RESUME_SECTION_WORDS.has(t.toLowerCase())) return false

  // Each word should look like a name token
  let nameLike = 0
  for (const w of words) {
    const clean = w.replace(/[.'’\-]/g, '')
    if (clean.length < 2) return false
    if (RESUME_SECTION_WORDS.has(clean.toLowerCase())) return false
    // Title case or ALL CAPS name
    if (/^[A-Z][a-z]+$/.test(clean) || /^[A-Z]{2,}$/.test(clean)) {
      nameLike++
    } else if (/^[A-Z][a-z]+[A-Z][a-z]+$/.test(clean)) {
      // McDonald style
      nameLike++
    } else {
      return false
    }
  }
  return nameLike >= 2
}

/**
 * Detect company letterhead: large-ish line in top area with company-like wording
 * (when not already a person name).
 */
function detectLetterheadCompany(items: TextItem[]): TextItem[] {
  if (!items.length) return []
  const lines = groupItemsIntoLines(
    items.map((it) => ({
      str: it.str,
      x: it.x,
      y: it.y,
      w: it.w,
      h: it.h,
      fontH: it.fontH ?? it.h,
    })),
  )

  const companyHint =
    /\b(LLC|Ltd|Limited|Inc|Corp|PLC|Pvt|Trading|Enterprises|Industries|Solutions|Services|Technologies|Holdings|Group|International|FZE|FZCO|Logistics|Construction|Bank|Insurance|Hospital|University|College|School)\b/i

  const avgFont =
    items.reduce((s, i) => s + (i.fontH ?? i.h), 0) / items.length
  const out: TextItem[] = []

  for (const line of lines) {
    const text = line
      .map((i) => i.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    const y = Math.min(...line.map((i) => i.y))
    const fontH = Math.max(...line.map((i) => (i as TextItem).fontH ?? i.h))
    if (y > 0.28) continue
    if (fontH < avgFont * 1.1 && y > 0.12) continue
    if (text.length < 4 || text.length > 80) continue
    if (looksLikePersonName(text)) continue
    if (!companyHint.test(text) && !/^[A-Z][A-Za-z0-9&.,'\-\s]{3,50}$/.test(text)) {
      continue
    }
    // ALL CAPS multi-word company header
    const isAllCapsHeader =
      text === text.toUpperCase() &&
      text.split(/\s+/).length >= 2 &&
      text.split(/\s+/).length <= 8 &&
      !/\d{5,}/.test(text)

    if (!companyHint.test(text) && !isAllCapsHeader) continue

    out.push({
      str: text,
      x: Math.min(...line.map((i) => i.x)),
      y,
      w:
        Math.max(...line.map((i) => i.x + i.w)) -
        Math.min(...line.map((i) => i.x)),
      h: Math.max(...line.map((i) => i.h)),
      fontH,
    })
  }
  return out.slice(0, 3)
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
    const fh = Math.max((b.y1 - b.y0) / ch, 0.006)
    items.push({
      str: text,
      x: b.x0 / cw,
      y: b.y0 / ch,
      w: Math.max((b.x1 - b.x0) / cw, 0.005),
      h: fh,
      fontH: fh,
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
    const fh = Math.max((b.y1 - b.y0) / ch, 0.008)
    items.push({
      str: text,
      x: b.x0 / cw,
      y: b.y0 / ch,
      w: Math.max((b.x1 - b.x0) / cw, 0.01),
      h: fh,
      fontH: fh,
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
  options?: MaskOptions,
) {
  const pad = Math.max(padN, 0.002)
  const on = options?.categories || {}

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

  // Auto-detect resume / document person name (large heading near top)
  if (on.lastName !== false && on.lastName) {
    for (const n of detectResumePersonNames(items)) {
      pushBox('lastName', n.str, n.x, n.y, n.w, n.h)
    }
  }

  // Auto-detect prominent company letterhead (top of page, company-like)
  if (on.companyName) {
    for (const n of detectLetterheadCompany(items)) {
      pushBox('companyName', n.str, n.x, n.y, n.w, n.h)
    }
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

  const matchOnSpan = (
    span: { str: string; x: number; y: number; w: number; h: number }[],
  ) => {
    const joined = span.map((i) => i.str).join('')
    const spaced = span.map((i) => i.str).join(' ')
    for (const text of [joined, spaced]) {
      for (const { category, re } of matchers) {
        re.lastIndex = 0
        const match = re.exec(text)
        if (!match) continue
        // Prefer covering the matched segment when possible — cover full span bbox
        const minX = Math.min(...span.map((i) => i.x))
        const maxX = Math.max(...span.map((i) => i.x + i.w))
        const minY = Math.min(...span.map((i) => i.y))
        const maxY = Math.max(...span.map((i) => i.y + i.h))
        pushBox(category, match[0], minX, minY, maxX - minX, maxY - minY)
      }
    }
  }

  for (const line of lines) {
    matchOnSpan(line)
  }

  // Multi-line blocks (company + address often wrap 2–4 lines on invoices)
  for (let i = 0; i < lines.length; i++) {
    for (let len = 2; len <= 4 && i + len <= lines.length; len++) {
      const block = lines.slice(i, i + len).flat()
      matchOnSpan(block)
    }
  }

  // If a line is only a label (Address: / Company:), mask the next 1–3 lines as well
  const labelOnly =
    /^(?:Company\s*Name|Business\s*Name|Company|Address|Billing\s*Address|Shipping\s*Address|Bill\s*To|Ship\s*To|Sold\s*To|Registered\s*Office|Location)\s*[:#]?\s*$/i
  for (let i = 0; i < lines.length - 1; i++) {
    const lineText = lines[i].map((t) => t.str).join(' ').trim()
    if (!labelOnly.test(lineText)) continue
    const isCompany = /company|business|bill\s*to|sold\s*to|ship\s*to/i.test(
      lineText,
    )
    const cat: MaskCategory = isCompany ? 'companyName' : 'address'
    // Only if that category is enabled
    if (!matchers.some((m) => m.category === cat)) continue
    const follow = lines.slice(i + 1, i + 4).flat()
    if (!follow.length) continue
    const minX = Math.min(...follow.map((t) => t.x))
    const maxX = Math.max(...follow.map((t) => t.x + t.w))
    const minY = Math.min(...follow.map((t) => t.y))
    const maxY = Math.max(...follow.map((t) => t.y + t.h))
    const text = follow.map((t) => t.str).join(' ').trim()
    if (text.length < 3) continue
    pushBox(cat, text, minX, minY, maxX - minX, maxY - minY)
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
    // All categories off by default — user chooses what to mask
    categories,
    lastNames: '',
    companyNames: '',
    customPatterns: '',
    style: 'asterisk',
    pad: 2,
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
    'file,status,hits,error,email,phone,companyName,address,amount,ssn,vat,gst,tradeLicense,lastName,custom',
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
        c.companyName || 0,
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
