import { StandardFonts, type PDFDocument, type PDFFont } from '@cantoo/pdf-lib'

/** Strip PDF subset prefix like "ABCDEF+ArialMT" → "ArialMT" */
export function cleanFontName(fontName: string): string {
  return fontName.replace(/^[A-Z]{6}\+/, '').replace(/,/g, ' ').trim()
}

/** CSS font-family that best matches a PDF font name / family */
export function pdfFontToCss(fontName: string, pdfjsFamily?: string): string {
  const raw = cleanFontName(pdfName(fontName, pdfjsFamily))
  const n = raw.toLowerCase()

  if (n.includes('times') || n.includes('georgia') || n.includes('garamond') || n.includes('palatino')) {
    return `"${raw}", "Times New Roman", Times, serif`
  }
  if (n.includes('courier') || n.includes('consolas') || n.includes('mono') || n.includes('menlo')) {
    return `"${raw}", "Courier New", Courier, monospace`
  }
  if (n.includes('comic')) {
    return `"${raw}", "Comic Sans MS", cursive`
  }
  if (n.includes('symbol') || n.includes('wingding') || n.includes('zapf')) {
    return `"${raw}", "Segoe UI Symbol", sans-serif`
  }
  if (
    n.includes('helvetica') ||
    n.includes('arial') ||
    n.includes('calibri') ||
    n.includes('roboto') ||
    n.includes('noto') ||
    n.includes('verdana') ||
    n.includes('tahoma') ||
    n.includes('sans')
  ) {
    return `"${raw}", Arial, Helvetica, sans-serif`
  }
  // Prefer the PDF’s own family name so the OS can resolve it if installed
  return `"${raw}", Arial, Helvetica, sans-serif`
}

function pdfName(fontName: string, pdfjsFamily?: string) {
  if (pdfjsFamily && pdfjsFamily.trim()) return pdfjsFamily
  return fontName
}

export function isBoldFont(fontName: string): boolean {
  const n = fontName.toLowerCase()
  return n.includes('bold') || n.includes('black') || n.includes('heavy') || n.includes('semibold')
}

export function isItalicFont(fontName: string): boolean {
  const n = fontName.toLowerCase()
  return n.includes('italic') || n.includes('oblique')
}

/** Map PDF font → pdf-lib standard font (closest match for export) */
export function pdfFontToStandard(fontName: string): StandardFonts {
  const n = cleanFontName(fontName).toLowerCase()
  const bold = isBoldFont(n)
  const italic = isItalicFont(n)

  if (n.includes('times') || n.includes('serif') || n.includes('georgia') || n.includes('garamond')) {
    if (bold && italic) return StandardFonts.TimesRomanBoldItalic
    if (bold) return StandardFonts.TimesRomanBold
    if (italic) return StandardFonts.TimesRomanItalic
    return StandardFonts.TimesRoman
  }
  if (n.includes('courier') || n.includes('mono')) {
    if (bold && italic) return StandardFonts.CourierBoldOblique
    if (bold) return StandardFonts.CourierBold
    if (italic) return StandardFonts.CourierOblique
    return StandardFonts.Courier
  }
  // Helvetica / Arial / default sans
  if (bold && italic) return StandardFonts.HelveticaBoldOblique
  if (bold) return StandardFonts.HelveticaBold
  if (italic) return StandardFonts.HelveticaOblique
  return StandardFonts.Helvetica
}

const fontCache = new Map<string, PDFFont>()

export async function embedMatchedFont(
  doc: PDFDocument,
  fontName: string,
): Promise<PDFFont> {
  const key = pdfFontToStandard(fontName)
  const cached = fontCache.get(key)
  if (cached) return cached
  const font = await doc.embedFont(key)
  fontCache.set(key, font)
  return font
}

export function clearFontCache() {
  fontCache.clear()
}

/** Display label for UI */
export function fontLabel(fontName: string, pdfjsFamily?: string): string {
  return cleanFontName(pdfjsFamily || fontName) || 'Unknown'
}
