/** Screen-space normalized coordinates (0–1), origin top-left of the page */

export type Point = { x: number; y: number }

export type Annotation =
  | {
      id: string
      type: 'text'
      page: number
      x: number
      y: number
      text: string
      fontSize: number
      color: string
      bold?: boolean
      opacity?: number
      maxWidth?: number
      rotate?: number
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
  /** Heuristic: page looks scanned / handwritten (little extractable text) */
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
