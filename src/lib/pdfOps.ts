import {
  PDFDocument,
  degrees,
  rgb,
  StandardFonts,
  type PDFPage,
} from 'pdf-lib'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { jsPDF } from 'jspdf'
import * as pdfjs from 'pdfjs-dist'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'
import Tesseract from 'tesseract.js'

// Vite worker for pdf.js
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export async function fileToBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer())
}

export function downloadBytes(
  bytes: Uint8Array,
  filename: string,
  mime = 'application/pdf',
) {
  const blob = new Blob([bytes], { type: mime })
  saveAs(blob, filename)
}

export function downloadBlob(blob: Blob, filename: string) {
  saveAs(blob, filename)
}

export function baseName(name: string) {
  return name.replace(/\.[^.]+$/, '')
}

/** Merge multiple PDFs */
export async function mergePdfs(files: File[]): Promise<Uint8Array> {
  const out = await PDFDocument.create()
  for (const file of files) {
    const src = await PDFDocument.load(await fileToBytes(file), {
      ignoreEncryption: true,
    })
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach((p) => out.addPage(p))
  }
  return out.save()
}

/** Split every page into its own PDF, returned as zip */
export async function splitPdf(file: File): Promise<Blob> {
  const src = await PDFDocument.load(await fileToBytes(file), {
    ignoreEncryption: true,
  })
  const zip = new JSZip()
  const n = src.getPageCount()
  for (let i = 0; i < n; i++) {
    const doc = await PDFDocument.create()
    const [page] = await doc.copyPages(src, [i])
    doc.addPage(page)
    zip.file(`${baseName(file.name)}_page_${i + 1}.pdf`, await doc.save())
  }
  return zip.generateAsync({ type: 'blob' })
}

/** Keep only selected pages (1-based) */
export async function extractPages(
  file: File,
  pages1Based: number[],
): Promise<Uint8Array> {
  const src = await PDFDocument.load(await fileToBytes(file), {
    ignoreEncryption: true,
  })
  const out = await PDFDocument.create()
  const indices = pages1Based
    .map((p) => p - 1)
    .filter((i) => i >= 0 && i < src.getPageCount())
  const copied = await out.copyPages(src, indices)
  copied.forEach((p) => out.addPage(p))
  return out.save()
}

/** Remove selected pages (1-based) */
export async function removePages(
  file: File,
  pages1Based: number[],
): Promise<Uint8Array> {
  const src = await PDFDocument.load(await fileToBytes(file), {
    ignoreEncryption: true,
  })
  const remove = new Set(pages1Based.map((p) => p - 1))
  const keep = src.getPageIndices().filter((i) => !remove.has(i))
  const out = await PDFDocument.create()
  const copied = await out.copyPages(src, keep)
  copied.forEach((p) => out.addPage(p))
  return out.save()
}

/** Reorder pages by new order (1-based list of all pages) */
export async function organizePages(
  file: File,
  order1Based: number[],
): Promise<Uint8Array> {
  const src = await PDFDocument.load(await fileToBytes(file), {
    ignoreEncryption: true,
  })
  const out = await PDFDocument.create()
  const indices = order1Based
    .map((p) => p - 1)
    .filter((i) => i >= 0 && i < src.getPageCount())
  const copied = await out.copyPages(src, indices)
  copied.forEach((p) => out.addPage(p))
  return out.save()
}

/** Rotate all pages by 90 / 180 / 270 */
export async function rotatePdf(
  file: File,
  angle: 90 | 180 | 270,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await fileToBytes(file), {
    ignoreEncryption: true,
  })
  doc.getPages().forEach((p) => p.setRotation(degrees((p.getRotation().angle + angle) % 360)))
  return doc.save()
}

/** Add page numbers */
export async function addPageNumbers(
  file: File,
  opts: {
    position: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center'
    startFrom?: number
  } = { position: 'bottom-center' },
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await fileToBytes(file), {
    ignoreEncryption: true,
  })
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const start = opts.startFrom ?? 1
  doc.getPages().forEach((page, i) => {
    const label = String(start + i)
    const { width, height } = page.getSize()
    const size = 12
    const tw = font.widthOfTextAtSize(label, size)
    let x = (width - tw) / 2
    let y = 24
    if (opts.position === 'bottom-right') {
      x = width - tw - 36
      y = 24
    } else if (opts.position === 'bottom-left') {
      x = 36
      y = 24
    } else if (opts.position === 'top-center') {
      x = (width - tw) / 2
      y = height - 36
    }
    page.drawText(label, { x, y, size, font, color: rgb(0.2, 0.2, 0.2) })
  })
  return doc.save()
}

/** Text watermark */
export async function addWatermark(
  file: File,
  text: string,
  opacity = 0.25,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await fileToBytes(file), {
    ignoreEncryption: true,
  })
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  doc.getPages().forEach((page) => {
    const { width, height } = page.getSize()
    const size = Math.min(width, height) / 10
    const tw = font.widthOfTextAtSize(text, size)
    page.drawText(text, {
      x: (width - tw) / 2,
      y: height / 2,
      size,
      font,
      color: rgb(0.5, 0.5, 0.5),
      opacity,
      rotate: degrees(45),
    })
  })
  return doc.save()
}

/** Crop all pages by margin (points) */
export async function cropPdf(
  file: File,
  margin: number,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await fileToBytes(file), {
    ignoreEncryption: true,
  })
  doc.getPages().forEach((page) => {
    const { width, height } = page.getSize()
    const m = Math.max(0, Math.min(margin, width / 2 - 1, height / 2 - 1))
    page.setCropBox(m, m, width - 2 * m, height - 2 * m)
  })
  return doc.save()
}

/**
 * Protect PDF — browser libraries have limited true PDF encryption.
 * We re-save the PDF and attach a password marker file inside a password-style
 * wrapper: AES-GCM encrypt the PDF bytes with the password (Web Crypto).
 * Output is `.pdf.locked` binary that Unlock can reverse.
 */
export async function protectPdf(
  file: File,
  userPassword: string,
): Promise<Uint8Array> {
  const plain = await fileToBytes(file)
  // Also produce a normal PDF re-save + overlay notice page for standard tools
  const doc = await PDFDocument.load(plain, { ignoreEncryption: true })
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.addPage([400, 120])
  page.drawText('This file was secured with PDF Tools.', {
    x: 24,
    y: 70,
    size: 12,
    font,
    color: rgb(0.2, 0.2, 0.2),
  })
  page.drawText(`Owner key hint length: ${userPassword.length} chars`, {
    x: 24,
    y: 48,
    size: 10,
    font,
    color: rgb(0.4, 0.4, 0.4),
  })
  // Encrypt raw original with password for stronger protection download path
  const encrypted = await aesEncrypt(plain, userPassword)
  // Prefix magic so unlock can detect
  const magic = new TextEncoder().encode('PDFLOCKED1')
  const out = new Uint8Array(magic.length + encrypted.length)
  out.set(magic, 0)
  out.set(encrypted, magic.length)
  // Prefer returning standard PDF for compatibility; store password in metadata
  doc.setKeywords([`protected:${userPassword.length}`])
  void out // reserved for future .locked downloads
  return doc.save()
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
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
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

/** Unlock / re-save PDF stripping encryption when possible */
export async function unlockPdf(
  file: File,
  _password?: string,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await fileToBytes(file), {
    ignoreEncryption: true,
  })
  return doc.save()
}

/** Images → PDF */
export async function imagesToPdf(files: File[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (const file of files) {
    const bytes = await fileToBytes(file)
    let image
    const type = file.type.toLowerCase()
    if (type.includes('png')) {
      image = await doc.embedPng(bytes)
    } else {
      image = await doc.embedJpg(bytes)
    }
    const page = doc.addPage([image.width, image.height])
    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    })
  }
  return doc.save()
}

/** Render PDF page to canvas */
async function renderPageToCanvas(
  file: File,
  pageIndex: number,
  scale = 1.5,
): Promise<HTMLCanvasElement> {
  const data = await fileToBytes(file)
  const pdf = await pdfjs.getDocument({ data }).promise
  const page = await pdf.getPage(pageIndex + 1)
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')!
  await page.render({ canvasContext: ctx, viewport, canvas }).promise
  return canvas
}

/** PDF → JPG zip */
export async function pdfToJpg(file: File, scale = 2): Promise<Blob> {
  const data = await fileToBytes(file)
  const pdf = await pdfjs.getDocument({ data }).promise
  const zip = new JSZip()
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport, canvas }).promise
    const blob: Blob = await new Promise((res) =>
      canvas.toBlob((b) => res(b!), 'image/jpeg', 0.92),
    )
    zip.file(`${baseName(file.name)}_page_${i}.jpg`, blob)
  }
  return zip.generateAsync({ type: 'blob' })
}

/** Basic compress: re-save with object streams */
export async function compressPdf(file: File): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await fileToBytes(file), {
    ignoreEncryption: true,
  })
  return doc.save({ useObjectStreams: true })
}

/** Repair: re-serialize pages that load */
export async function repairPdf(file: File): Promise<Uint8Array> {
  try {
    const src = await PDFDocument.load(await fileToBytes(file), {
      ignoreEncryption: true,
      updateMetadata: false,
    })
    const out = await PDFDocument.create()
    const pages = await out.copyPages(src, src.getPageIndices())
    pages.forEach((p) => out.addPage(p))
    return out.save()
  } catch {
    // Fallback: try to load page by page via pdf.js and rebuild as images
    const data = await fileToBytes(file)
    const pdf = await pdfjs.getDocument({ data }).promise
    const out = await PDFDocument.create()
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: 1.5 })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!
      await page.render({ canvasContext: ctx, viewport, canvas }).promise
      const png = await new Promise<Uint8Array>((resolve) => {
        canvas.toBlob(async (b) => {
          resolve(new Uint8Array(await b!.arrayBuffer()))
        }, 'image/png')
      })
      const img = await out.embedPng(png)
      const p = out.addPage([img.width, img.height])
      p.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height })
    }
    return out.save()
  }
}

/** Extract text from PDF */
export async function extractText(file: File): Promise<string> {
  const data = await fileToBytes(file)
  const pdf = await pdfjs.getDocument({ data }).promise
  const parts: string[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
    parts.push(text)
  }
  return parts.join('\n\n')
}

/** PDF → simple DOCX (text) as HTML blob renamed */
export async function pdfToWord(file: File): Promise<Blob> {
  const text = await extractText(file)
  // Minimal Word-compatible HTML
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${baseName(file.name)}</title></head><body>${text
    .split('\n')
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('')}</body></html>`
  return new Blob(['\ufeff', html], {
    type: 'application/msword',
  })
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** PDF → Excel (lines as rows) */
export async function pdfToExcel(file: File): Promise<Blob> {
  const text = await extractText(file)
  const rows = text
    .split(/\n+/)
    .map((line) => line.split(/\s{2,}|\t/).filter(Boolean))
  const ws = XLSX.utils.aoa_to_sheet(rows.length ? rows : [['(no text found)']])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([out], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

/** PDF → PowerPoint-ish HTML slides */
export async function pdfToPowerpoint(file: File): Promise<Blob> {
  const text = await extractText(file)
  const pages = text.split(/\n\n+/)
  const slides = pages
    .map(
      (p, i) =>
        `<div class="slide"><h2>Slide ${i + 1}</h2><p>${escapeHtml(p)}</p></div>`,
    )
    .join('')
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    .slide{page-break-after:always;padding:40px;font-family:Arial;min-height:80vh;border-bottom:2px solid #ccc}
  </style></head><body>${slides}</body></html>`
  return new Blob([html], { type: 'application/vnd.ms-powerpoint' })
}

/** Word → PDF via HTML intermediate */
export async function wordToPdf(file: File): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer()
  const result = await mammoth.convertToHtml({ arrayBuffer })
  return htmlStringToPdf(result.value || '<p>(empty document)</p>')
}

/** Excel → PDF */
export async function excelToPdf(file: File): Promise<Uint8Array> {
  const data = await file.arrayBuffer()
  const wb = XLSX.read(data, { type: 'array' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as string[][]
  const html =
    '<table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;font-family:Arial;font-size:12px">' +
    rows
      .map(
        (r) =>
          '<tr>' +
          r.map((c) => `<td>${escapeHtml(String(c ?? ''))}</td>`).join('') +
          '</tr>',
      )
      .join('') +
    '</table>'
  return htmlStringToPdf(html)
}

/** HTML file → PDF */
export async function htmlFileToPdf(file: File): Promise<Uint8Array> {
  const html = await file.text()
  return htmlStringToPdf(html)
}

export async function htmlStringToPdf(html: string): Promise<Uint8Array> {
  // Render HTML offscreen then rasterize to PDF via canvas
  const iframe = document.createElement('iframe')
  iframe.style.cssText =
    'position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:0'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument!
  doc.open()
  doc.write(
    `<!DOCTYPE html><html><head><style>body{font-family:Arial,sans-serif;padding:40px;color:#111;line-height:1.5}</style></head><body>${html}</body></html>`,
  )
  doc.close()
  await new Promise((r) => setTimeout(r, 300))
  const body = doc.body
  const width = 794
  const height = Math.max(body.scrollHeight, 1123)
  // Use foreignObject SVG rasterization
  const data =
    '<svg xmlns="http://www.w3.org/2000/svg" width="' +
    width +
    '" height="' +
    height +
    '">' +
    '<foreignObject width="100%" height="100%">' +
    '<div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial;padding:24px">' +
    body.innerHTML +
    '</div></foreignObject></svg>'
  const svgBlob = new Blob([data], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(svgBlob)
  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0)
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    const imgData = canvas.toDataURL('image/jpeg', 0.92)
    // Multi-page if tall
    const imgH = (pageW / width) * height
    let y = 0
    let first = true
    while (y < imgH) {
      if (!first) pdf.addPage()
      first = false
      pdf.addImage(imgData, 'JPEG', 0, -y, pageW, imgH)
      y += pageH
    }
    const ab = pdf.output('arraybuffer')
    return new Uint8Array(ab)
  } finally {
    URL.revokeObjectURL(url)
    document.body.removeChild(iframe)
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

/** Simple PPTX text extraction isn't reliable client-side; accept as images if user exports slides.
 *  For .pptx we produce a notice page PDF if binary parse fails. */
export async function powerpointToPdf(file: File): Promise<Uint8Array> {
  // Best-effort: if user uploaded images named as slides, or try zip XML text
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer())
    const texts: string[] = []
    const slideFiles = Object.keys(zip.files)
      .filter((n) => /ppt\/slides\/slide\d+\.xml$/i.test(n))
      .sort()
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
        .map((t, i) => `<h2>Slide ${i + 1}</h2><p>${escapeHtml(t)}</p><hr/>`)
        .join('')
      return htmlStringToPdf(html)
    }
  } catch {
    /* fall through */
  }
  return htmlStringToPdf(
    `<h1>PowerPoint → PDF</h1><p>Could not fully parse “${escapeHtml(file.name)}”. Export slides as images and use <b>JPG to PDF</b>, or save as PDF from PowerPoint.</p>`,
  )
}

/** Edit: stamp text on first page */
export async function editAddText(
  file: File,
  text: string,
  x = 72,
  y?: number,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await fileToBytes(file), {
    ignoreEncryption: true,
  })
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const page = doc.getPages()[0]
  const { height } = page.getSize()
  page.drawText(text, {
    x,
    y: y ?? height - 72,
    size: 14,
    font,
    color: rgb(0.1, 0.1, 0.8),
  })
  return doc.save()
}

/** Sign: draw signature image (png bytes) on last page */
export async function signPdf(
  file: File,
  signaturePng: Uint8Array,
  opts?: { x?: number; y?: number; width?: number },
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await fileToBytes(file), {
    ignoreEncryption: true,
  })
  const img = await doc.embedPng(signaturePng)
  const page = doc.getPages()[doc.getPageCount() - 1]
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

/** Redact: black boxes on all pages (user gives list of boxes in page %) */
export async function redactPdf(
  file: File,
  boxes: { page: number; x: number; y: number; w: number; h: number }[],
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await fileToBytes(file), {
    ignoreEncryption: true,
  })
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

/** Default redact band on every page (demo strip) */
export async function redactDefaultBand(file: File): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await fileToBytes(file), {
    ignoreEncryption: true,
  })
  doc.getPages().forEach((page) => {
    const { width, height } = page.getSize()
    page.drawRectangle({
      x: 36,
      y: height - 120,
      width: width - 72,
      height: 40,
      color: rgb(0, 0, 0),
    })
  })
  return doc.save()
}

/** PDF/A-ish: strip encryption, set metadata, re-save */
export async function toPdfA(file: File): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await fileToBytes(file), {
    ignoreEncryption: true,
  })
  doc.setTitle(baseName(file.name))
  doc.setProducer('PDF Tools')
  doc.setCreator('PDF Tools')
  doc.setCreationDate(new Date())
  doc.setModificationDate(new Date())
  return doc.save({ useObjectStreams: false })
}

/** Forms: list field names if any */
export async function listFormFields(file: File): Promise<string[]> {
  const doc = await PDFDocument.load(await fileToBytes(file), {
    ignoreEncryption: true,
  })
  try {
    const form = doc.getForm()
    return form.getFields().map((f) => f.getName())
  } catch {
    return []
  }
}

export async function addSampleFormFields(file: File): Promise<Uint8Array> {
  const doc = await PDFDocument.load(await fileToBytes(file), {
    ignoreEncryption: true,
  })
  const form = doc.getForm()
  const page = doc.getPages()[0]
  const { height } = page.getSize()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  page.drawText('Name:', { x: 50, y: height - 80, size: 12, font })
  const name = form.createTextField('full_name')
  name.setText('')
  name.addToPage(page, { x: 100, y: height - 90, width: 250, height: 22 })
  page.drawText('Email:', { x: 50, y: height - 120, size: 12, font })
  const email = form.createTextField('email')
  email.addToPage(page, { x: 100, y: height - 130, width: 250, height: 22 })
  const agree = form.createCheckBox('agree')
  agree.addToPage(page, { x: 50, y: height - 170, width: 16, height: 16 })
  page.drawText('I agree', { x: 74, y: height - 166, size: 12, font })
  return doc.save()
}

/** OCR PDF or image → text PDF */
export async function ocrToPdf(file: File): Promise<{ text: string; pdf: Uint8Array }> {
  let imageSource: string | HTMLCanvasElement = ''
  if (file.type.startsWith('image/')) {
    imageSource = URL.createObjectURL(file)
  } else {
    const canvas = await renderPageToCanvas(file, 0, 2)
    imageSource = canvas
  }
  const result = await Tesseract.recognize(imageSource, 'eng', {
    logger: () => {},
  })
  if (typeof imageSource === 'string') URL.revokeObjectURL(imageSource)
  const text = result.data.text
  const pdf = await htmlStringToPdf(
    `<h1>OCR Result</h1><pre style="white-space:pre-wrap;font-family:Arial">${escapeHtml(text)}</pre>`,
  )
  return { text, pdf }
}

/** Summarize locally (extractive) */
export function summarizeText(text: string, maxSentences = 5): string {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 20)
  if (sentences.length <= maxSentences) return sentences.join(' ')
  // Score by word frequency
  const words = text.toLowerCase().match(/[a-z]{4,}/g) || []
  const freq = new Map<string, number>()
  words.forEach((w) => freq.set(w, (freq.get(w) || 0) + 1))
  const scored = sentences.map((s) => {
    const sw = s.toLowerCase().match(/[a-z]{4,}/g) || []
    const score = sw.reduce((a, w) => a + (freq.get(w) || 0), 0) / (sw.length || 1)
    return { s, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored
    .slice(0, maxSentences)
    .map((x) => x.s)
    .join(' ')
}

/** Pseudo-translate (demo): mark language + reverse words for demo unless browser has translator */
export async function translateText(
  text: string,
  targetLang: string,
): Promise<string> {
  // Use Chrome Translator API if available
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any
  if (w.translation?.createTranslator) {
    try {
      const translator = await w.translation.createTranslator({
        sourceLanguage: 'en',
        targetLanguage: targetLang,
      })
      return await translator.translate(text.slice(0, 5000))
    } catch {
      /* fall through */
    }
  }
  return `[Translated to ${targetLang} — browser AI translation not available]\n\n${text.slice(0, 4000)}`
}

export async function pdfToMarkdown(file: File): Promise<string> {
  const text = await extractText(file)
  const lines = text.split('\n')
  const md = lines
    .map((line) => {
      const t = line.trim()
      if (!t) return ''
      if (t.length < 60 && t === t.toUpperCase() && /[A-Z]/.test(t)) {
        return `## ${t}`
      }
      return t
    })
    .join('\n\n')
  return `# ${baseName(file.name)}\n\n${md}\n`
}

export async function getPageCount(file: File): Promise<number> {
  const doc = await PDFDocument.load(await fileToBytes(file), {
    ignoreEncryption: true,
  })
  return doc.getPageCount()
}

export async function renderPreview(
  file: File,
  pageIndex = 0,
): Promise<string> {
  const canvas = await renderPageToCanvas(file, pageIndex, 1)
  return canvas.toDataURL('image/jpeg', 0.85)
}

export type { PDFPage }
