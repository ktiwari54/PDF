/** Screen-space normalized coordinates (0–1), origin top-left of the page */

export type Point = { x: number; y: number }

/** A selectable text run extracted from the PDF (live layer) */
export type PdfTextSpan = {
  id: string
  page: number
  text: string
  /** normalized top-left box */
  x: number
  y: number
  w: number
  h: number
  /** font size in CSS/screen px at current scale */
  fontSizePx: number
  /** font size in PDF points */
  fontSizePt: number
  fontName: string
  fontFamilyCss: string
  bold: boolean
  italic: boolean
  /** rotation degrees clockwise */
  angle: number
}

export type Annotation =
  | {
      id: string
      type: 'text'
      page: number
      x: number
      y: number
      /** optional cover box for in-place replacement */
      w?: number
      h?: number
      text: string
      fontSize: number
      color: string
      bold?: boolean
      italic?: boolean
      fontName?: string
      fontFamilyCss?: string
      /** replaces original span */
      replacesSpanId?: string
      opacity?: number
      maxWidth?: number
      rotate?: number
      /** cover original glyphs before drawing new text */
      coverOriginal?: boolean
    }
  | {
      id: string
      type: 'ink'
      page: number
      points: Point[]
      color: string
      width: number
      opacity?: number
    }
  | {
      id: string
      type: 'highlight'
      page: number
      x: number
      y: number
      w: number
      h: number
      color: string
      opacity?: number
    }
  | {
      id: string
      type: 'rect'
      page: number
      x: number
      y: number
      w: number
      h: number
      stroke?: string
      fill?: string
      strokeWidth?: number
      opacity?: number
    }
  | {
      id: string
      type: 'image'
      page: number
      x: number
      y: number
      w: number
      h: number
      dataUrl: string
      opacity?: number
    }
  | {
      id: string
      type: 'cover'
      page: number
      x: number
      y: number
      w: number
      h: number
      color?: string
    }

export type PageMeta = {
  width: number
  height: number
  handwrittenLike: boolean
  textItemCount: number
}

export type EditorTool =
  | 'pan'
  | 'select'
  | 'text'
  | 'ink'
  | 'highlight'
  | 'rect'
  | 'cover'
  | 'image'
  | 'erase'

export function uid() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}
