import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as pdfjs from 'pdfjs-dist'
import {
  Highlighter,
  Type,
  PenLine,
  Square,
  Eraser,
  MousePointer2,
  ImagePlus,
  Download,
  Undo2,
  Redo2,
  ChevronLeft,
  ChevronRight,
  Upload,
  Hand,
  Eye,
  Trash2,
  Type as TypeIcon,
} from 'lucide-react'
import type {
  Annotation,
  EditorTool,
  PageMeta,
  PdfTextSpan,
  Point,
} from '../types/annotations'
import { uid } from '../types/annotations'
import { exportEditedPdf } from '../lib/liveEditExport'
import { downloadBytes, baseName } from '../lib/pdfOps'
import {
  fontLabel,
  isBoldFont,
  isItalicFont,
  pdfFontToCss,
} from '../lib/fontMatch'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const SCALE = 1.4

export function LiveEditor() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const editInputRef = useRef<HTMLTextAreaElement>(null)

  const [fileName, setFileName] = useState('document.pdf')
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(0)
  const [numPages, setNumPages] = useState(0)
  const [pageMetas, setPageMetas] = useState<PageMeta[]>([])
  const [spansByPage, setSpansByPage] = useState<Record<number, PdfTextSpan[]>>(
    {},
  )
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 })
  const [tool, setTool] = useState<EditorTool>('select')
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [history, setHistory] = useState<Annotation[][]>([])
  const [future, setFuture] = useState<Annotation[][]>([])
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [handModeHint, setHandModeHint] = useState(false)
  const [tick, setTick] = useState(0)

  const annotationsRef = useRef<Annotation[]>([])
  annotationsRef.current = annotations

  // Active live text edit
  const [activeSpanId, setActiveSpanId] = useState<string | null>(null)
  const [liveText, setLiveText] = useState('')
  const [liveColor, setLiveColor] = useState('#111827')
  const [liveFontSize, setLiveFontSize] = useState(12)
  const [adoptFont, setAdoptFont] = useState(true)

  const [inkColor, setInkColor] = useState('#1e293b')
  const [inkWidth, setInkWidth] = useState(2.5)
  const [highlightColor, setHighlightColor] = useState('#fde047')
  const [newTextDraft, setNewTextDraft] = useState('')
  const [showNewText, setShowNewText] = useState<{
    x: number
    y: number
    fontName: string
    fontSize: number
    fontFamilyCss: string
  } | null>(null)

  /** Selected annotation (images are fully interactive) */
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null)

  const drawing = useRef(false)
  const currentStroke = useRef<Point[]>([])
  const dragStart = useRef<Point | null>(null)
  const tempShape = useRef<Annotation | null>(null)
  /** Where the next picked image will be placed (normalized) */
  const pendingImageAt = useRef<Point | null>(null)
  /** Live drag / resize of an image annotation */
  const imageInteract = useRef<
    | {
        mode: 'move' | 'resize'
        id: string
        startClientX: number
        startClientY: number
        origX: number
        origY: number
        origW: number
        origH: number
        corner?: 'nw' | 'ne' | 'sw' | 'se'
        pageW: number
        pageH: number
        /** snapshot before drag for undo */
        before: Annotation[]
      }
    | null
  >(null)

  const pageSpans = spansByPage[page] || []
  const pageAnns = useMemo(
    () => annotations.filter((a) => a.page === page),
    [annotations, page],
  )
  const meta = pageMetas[page]

  const activeSpan = pageSpans.find((s) => s.id === activeSpanId) || null

  // Map of spanId → text replacement annotation
  const spanEdits = useMemo(() => {
    const map = new Map<string, Extract<Annotation, { type: 'text' }>>()
    for (const a of annotations) {
      if (a.type === 'text' && a.replacesSpanId) {
        map.set(a.replacesSpanId, a)
      }
    }
    return map
  }, [annotations])

  const pushHistory = useCallback((next: Annotation[]) => {
    setHistory((h) => [...h.slice(-40), annotationsRef.current])
    setFuture([])
    setAnnotations(next)
  }, [])

  const undo = () => {
    if (!history.length) return
    const prev = history[history.length - 1]
    setFuture((f) => [annotationsRef.current, ...f])
    setHistory((h) => h.slice(0, -1))
    setAnnotations(prev)
    setActiveSpanId(null)
  }

  const redo = () => {
    if (!future.length) return
    const [next, ...rest] = future
    setHistory((h) => [...h, annotationsRef.current])
    setFuture(rest)
    setAnnotations(next)
  }

  async function extractSpans(
    doc: pdfjs.PDFDocumentProxy,
    pageIndex: number,
  ): Promise<PdfTextSpan[]> {
    const p = await doc.getPage(pageIndex + 1)
    const viewport = p.getViewport({ scale: SCALE })
    const content = await p.getTextContent()
    const styles = content.styles as Record<
      string,
      { fontFamily?: string; ascent?: number; descent?: number }
    >
    const spans: PdfTextSpan[] = []
    let idx = 0

    for (const item of content.items) {
      if (!('str' in item)) continue
      const str = String(item.str)
      if (!str.trim()) continue

      const it = item as {
        str: string
        transform: number[]
        width: number
        height: number
        fontName: string
      }

      // Apply viewport transform to text matrix
      const m = pdfjs.Util.transform(viewport.transform, it.transform)
      const fontHeight = Math.hypot(m[2], m[3])
      const fontWidthScale = Math.hypot(m[0], m[1])
      const angle = Math.atan2(m[1], m[0]) * (180 / Math.PI)

      // m[4], m[5] = baseline left in viewport coords
      const basex = m[4]
      const basey = m[5]
      // width of text in viewport units
      const wPx = (it.width || str.length * 0.5) * fontWidthScale
      const hPx = Math.max(fontHeight, 6)
      // top-left of glyph box (approx)
      const left = basex
      const top = basey - hPx * 0.8

      const fontName = it.fontName || 'Helvetica'
      const family = styles[fontName]?.fontFamily
      const fontSizePx = hPx
      const fontSizePt = fontSizePx / SCALE

      spans.push({
        id: `p${pageIndex}_t${idx++}`,
        page: pageIndex,
        text: str,
        x: left / viewport.width,
        y: top / viewport.height,
        w: Math.max(wPx / viewport.width, 0.01),
        h: Math.max(hPx / viewport.height, 0.008),
        fontSizePx,
        fontSizePt: Math.max(6, fontSizePt),
        fontName,
        fontFamilyCss: pdfFontToCss(fontName, family),
        bold: isBoldFont(fontName),
        italic: isItalicFont(fontName),
        angle,
      })
    }

    // Merge adjacent runs on same line for easier editing
    return mergeLineSpans(spans, viewport.width, viewport.height)
  }

  async function loadFile(file: File) {
    setBusy(true)
    setStatus('Opening PDF and reading fonts…')
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      setPdfBytes(bytes)
      setFileName(file.name)
      setAnnotations([])
      setHistory([])
      setFuture([])
      setActiveSpanId(null)
      setSelectedAnnId(null)
      setPage(0)
      setSpansByPage({})

      const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise
      setPdfDoc(doc)
      setNumPages(doc.numPages)

      const metas: PageMeta[] = []
      const allSpans: Record<number, PdfTextSpan[]> = {}

      for (let i = 0; i < doc.numPages; i++) {
        const spans = await extractSpans(doc, i)
        allSpans[i] = spans
        const chars = spans.reduce((n, s) => n + s.text.length, 0)
        const handwrittenLike = spans.length < 6 || chars < 30
        const p = await doc.getPage(i + 1)
        const vp = p.getViewport({ scale: 1 })
        metas.push({
          width: vp.width,
          height: vp.height,
          handwrittenLike,
          textItemCount: spans.length,
        })
      }
      setSpansByPage(allSpans)
      setPageMetas(metas)

      const anyHand = metas.some((m) => m.handwrittenLike)
      setHandModeHint(anyHand)
      if (anyHand && metas[0]?.handwrittenLike) {
        setTool('ink')
        setStatus(
          'Scanned/handwritten page detected — Ink mode on. Text pages use click-to-edit with font matching.',
        )
      } else {
        setTool('select')
        const sample = allSpans[0]?.[0]
        setStatus(
          sample
            ? `Live text ready. Click any word to edit. Font adopted: ${fontLabel(sample.fontName)} (${Math.round(sample.fontSizePt)}pt)`
            : 'PDF loaded. Click text to edit in place — original fonts are matched as closely as possible.',
        )
      }
    } catch (e) {
      console.error(e)
      setStatus(e instanceof Error ? e.message : 'Failed to open PDF')
    } finally {
      setBusy(false)
    }
  }

  // Render PDF page background
  useEffect(() => {
    let cancelled = false
    async function render() {
      if (!pdfDoc || !pdfCanvasRef.current) return
      const p = await pdfDoc.getPage(page + 1)
      const viewport = p.getViewport({ scale: SCALE })
      const canvas = pdfCanvasRef.current
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      if (!cancelled) setViewSize({ w: canvas.width, h: canvas.height })
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await p.render({
        canvasContext: ctx,
        viewport,
        canvas,
      } as Parameters<typeof p.render>[0]).promise
    }
    void render()
    return () => {
      cancelled = true
    }
  }, [pdfDoc, page])

  // Canvas overlays (ink, shapes, covers for edited spans)
  useEffect(() => {
    const canvas = overlayRef.current
    if (!canvas || !viewSize.w) return
    canvas.width = viewSize.w
    canvas.height = viewSize.h
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // White cover under edited spans (hides original glyphs while showing HTML text)
    for (const span of pageSpans) {
      const edit = spanEdits.get(span.id)
      if (!edit && activeSpanId !== span.id) continue
      ctx.fillStyle = '#ffffff'
      const pad = 1
      ctx.fillRect(
        span.x * canvas.width - pad,
        span.y * canvas.height - pad,
        span.w * canvas.width + pad * 2,
        span.h * canvas.height + pad * 2,
      )
    }

    const drawAnn = (ann: Annotation) => {
      if (ann.type === 'ink' && ann.points.length > 1) {
        ctx.strokeStyle = ann.color
        ctx.lineWidth = ann.width * SCALE * 0.75
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ann.points.forEach((pt, i) => {
          const x = pt.x * canvas.width
          const y = pt.y * canvas.height
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        })
        ctx.stroke()
      } else if (ann.type === 'highlight') {
        ctx.fillStyle = ann.color
        ctx.globalAlpha = ann.opacity ?? 0.35
        ctx.fillRect(
          ann.x * canvas.width,
          ann.y * canvas.height,
          ann.w * canvas.width,
          ann.h * canvas.height,
        )
        ctx.globalAlpha = 1
      } else if (ann.type === 'rect') {
        if (ann.fill) {
          ctx.fillStyle = ann.fill
          ctx.globalAlpha = 0.15
          ctx.fillRect(
            ann.x * canvas.width,
            ann.y * canvas.height,
            ann.w * canvas.width,
            ann.h * canvas.height,
          )
          ctx.globalAlpha = 1
        }
        ctx.strokeStyle = ann.stroke || '#111'
        ctx.lineWidth = 1.5
        ctx.strokeRect(
          ann.x * canvas.width,
          ann.y * canvas.height,
          ann.w * canvas.width,
          ann.h * canvas.height,
        )
      } else if (ann.type === 'cover') {
        ctx.fillStyle = ann.color || '#fff'
        ctx.fillRect(
          ann.x * canvas.width,
          ann.y * canvas.height,
          ann.w * canvas.width,
          ann.h * canvas.height,
        )
      } else if (ann.type === 'image') {
        // Images render in the interactive HTML layer (draggable / resizable)
      } else if (ann.type === 'text' && !ann.replacesSpanId) {
        // free-placed text (not span replace) — draw on canvas
        ctx.fillStyle = ann.color
        ctx.font = `${ann.italic ? 'italic ' : ''}${ann.bold ? 'bold ' : ''}${ann.fontSize * SCALE * 0.75}px ${ann.fontFamilyCss || 'Arial'}`
        ctx.textBaseline = 'top'
        ctx.fillText(ann.text, ann.x * canvas.width, ann.y * canvas.height)
      }
    }

    for (const ann of pageAnns) {
      if (ann.type === 'text' && ann.replacesSpanId) continue // HTML layer
      drawAnn(ann)
    }
    if (tempShape.current?.page === page) drawAnn(tempShape.current)
  }, [
    pageAnns,
    viewSize,
    page,
    pageSpans,
    spanEdits,
    activeSpanId,
    tick,
  ])

  // Focus textarea when starting edit
  useEffect(() => {
    if (activeSpanId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [activeSpanId])

  // Keyboard: Delete selected image, Escape clear selection
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedAnnId &&
        annotationsRef.current.some(
          (a) => a.id === selectedAnnId && a.type === 'image',
        )
      ) {
        e.preventDefault()
        pushHistory(
          annotationsRef.current.filter((a) => a.id !== selectedAnnId),
        )
        setSelectedAnnId(null)
      }
      if (e.key === 'Escape') {
        setSelectedAnnId(null)
        if (activeSpanId) cancelActiveEdit()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedAnnId, activeSpanId, pushHistory])

  function beginEditSpan(span: PdfTextSpan) {
    if (tool === 'erase') {
      // remove edit for this span
      pushHistory(
        annotationsRef.current.filter(
          (a) => !(a.type === 'text' && a.replacesSpanId === span.id),
        ),
      )
      return
    }
    if (tool !== 'select' && tool !== 'text') return

    const existing = spanEdits.get(span.id)
    setActiveSpanId(span.id)
    setLiveText(existing?.text ?? span.text)
    setLiveColor(existing?.color ?? '#111827')
    setLiveFontSize(existing?.fontSize ?? span.fontSizePt)
    setAdoptFont(true)
    setTool('select')
    setStatus(
      `Editing with font: ${fontLabel(span.fontName)} · ${Math.round(span.fontSizePt)}pt`,
    )
  }

  function commitActiveEdit() {
    if (!activeSpan) {
      setActiveSpanId(null)
      return
    }
    const text = liveText
    // If unchanged from original and no prior edit, skip
    const existing = spanEdits.get(activeSpan.id)
    if (text === activeSpan.text && !existing) {
      setActiveSpanId(null)
      return
    }

    const fontName = adoptFont
      ? activeSpan.fontName
      : 'Helvetica'
    const fontFamilyCss = adoptFont
      ? activeSpan.fontFamilyCss
      : 'Arial, Helvetica, sans-serif'

    const ann: Annotation = {
      id: existing?.id || uid(),
      type: 'text',
      page: activeSpan.page,
      x: activeSpan.x,
      y: activeSpan.y,
      w: Math.max(activeSpan.w, 0.02),
      h: Math.max(activeSpan.h, 0.012),
      text,
      fontSize: liveFontSize,
      color: liveColor,
      bold: activeSpan.bold,
      italic: activeSpan.italic,
      fontName,
      fontFamilyCss,
      replacesSpanId: activeSpan.id,
      coverOriginal: true,
      maxWidth: activeSpan.w,
    }

    const without = annotationsRef.current.filter(
      (a) => !(a.type === 'text' && a.replacesSpanId === activeSpan.id),
    )
    // Empty text = just whiteout original
    if (!text.trim()) {
      pushHistory([
        ...without,
        {
          id: uid(),
          type: 'cover',
          page: activeSpan.page,
          x: activeSpan.x,
          y: activeSpan.y,
          w: activeSpan.w,
          h: activeSpan.h,
          color: '#ffffff',
        },
      ])
    } else {
      pushHistory([...without, ann])
    }
    setActiveSpanId(null)
    setStatus(`Saved edit · font ${fontLabel(fontName)}`)
  }

  function cancelActiveEdit() {
    setActiveSpanId(null)
  }

  function normPoint(e: React.PointerEvent, canvas: HTMLCanvasElement): Point {
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    // Don't steal events from text / image widgets
    if ((e.target as HTMLElement).closest?.('.le-text-span')) return
    if ((e.target as HTMLElement).closest?.('.le-image-widget')) return
    const canvas = overlayRef.current
    if (!canvas || !pdfBytes) return
    if (activeSpanId) commitActiveEdit()

    canvas.setPointerCapture(e.pointerId)
    const pt = normPoint(e, canvas)

    if (tool === 'select') {
      setSelectedAnnId(null)
      return
    }

    if (tool === 'text') {
      // New text near click — adopt nearest span font
      const nearest = findNearestSpan(pageSpans, pt)
      setShowNewText({
        x: pt.x,
        y: pt.y,
        fontName: nearest?.fontName || 'Helvetica',
        fontSize: nearest?.fontSizePt || 12,
        fontFamilyCss: nearest?.fontFamilyCss || 'Arial, sans-serif',
      })
      setNewTextDraft('')
      setLiveFontSize(nearest?.fontSizePt || 12)
      setLiveColor('#111827')
      return
    }

    if (tool === 'ink') {
      drawing.current = true
      currentStroke.current = [pt]
      return
    }

    if (tool === 'highlight' || tool === 'rect' || tool === 'cover') {
      drawing.current = true
      dragStart.current = pt
      return
    }

    if (tool === 'image') {
      // Click anywhere → pick image and place at this point
      pendingImageAt.current = {
        x: Math.max(0, Math.min(1, pt.x)),
        y: Math.max(0, Math.min(1, pt.y)),
      }
      setSelectedAnnId(null)
      setStatus('Choose an image to place here…')
      if (imgInputRef.current) {
        imgInputRef.current.value = ''
        imgInputRef.current.click()
      }
      return
    }

    if (tool === 'erase') {
      // erase annotation hit
      for (let i = pageAnns.length - 1; i >= 0; i--) {
        const a = pageAnns[i]
        if (a.type === 'ink') {
          if (a.points.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) < 0.025)) {
            pushHistory(annotationsRef.current.filter((x) => x.id !== a.id))
            return
          }
        } else if ('w' in a && a.w != null && a.h != null) {
          if (
            pt.x >= a.x &&
            pt.x <= a.x + (a.w || 0) &&
            pt.y >= a.y &&
            pt.y <= a.y + (a.h || 0)
          ) {
            pushHistory(annotationsRef.current.filter((x) => x.id !== a.id))
            setSelectedAnnId(null)
            return
          }
        }
      }
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const canvas = overlayRef.current
    if (!canvas || !drawing.current) return
    const pt = normPoint(e, canvas)
    if (tool === 'ink') {
      currentStroke.current.push(pt)
      tempShape.current = {
        id: 'temp',
        type: 'ink',
        page,
        points: [...currentStroke.current],
        color: inkColor,
        width: inkWidth,
      }
      setTick((t) => t + 1)
    } else if (
      (tool === 'highlight' || tool === 'rect' || tool === 'cover') &&
      dragStart.current
    ) {
      const s = dragStart.current
      const x = Math.min(s.x, pt.x)
      const y = Math.min(s.y, pt.y)
      const w = Math.abs(pt.x - s.x)
      const h = Math.abs(pt.y - s.y)
      if (tool === 'highlight') {
        tempShape.current = {
          id: 'temp',
          type: 'highlight',
          page,
          x,
          y,
          w,
          h,
          color: highlightColor,
          opacity: 0.35,
        }
      } else if (tool === 'cover') {
        tempShape.current = {
          id: 'temp',
          type: 'cover',
          page,
          x,
          y,
          w,
          h,
          color: '#ffffff',
        }
      } else {
        tempShape.current = {
          id: 'temp',
          type: 'rect',
          page,
          x,
          y,
          w,
          h,
          stroke: inkColor,
        }
      }
      setTick((t) => t + 1)
    }
  }

  const onPointerUp = () => {
    if (tool === 'ink' && drawing.current && currentStroke.current.length > 1) {
      pushHistory([
        ...annotationsRef.current,
        {
          id: uid(),
          type: 'ink',
          page,
          points: currentStroke.current,
          color: inkColor,
          width: inkWidth,
        },
      ])
    } else if (
      tempShape.current &&
      tempShape.current.id === 'temp' &&
      (tool === 'highlight' || tool === 'rect' || tool === 'cover')
    ) {
      const final = { ...tempShape.current, id: uid() } as Annotation
      if (
        'w' in final &&
        typeof final.w === 'number' &&
        typeof final.h === 'number' &&
        final.w > 0.004 &&
        final.h > 0.004
      ) {
        pushHistory([...annotationsRef.current, final])
      }
    }
    drawing.current = false
    currentStroke.current = []
    dragStart.current = null
    tempShape.current = null
    setTick((t) => t + 1)
  }

  function commitNewText() {
    if (!showNewText || !newTextDraft.trim()) {
      setShowNewText(null)
      return
    }
    pushHistory([
      ...annotationsRef.current,
      {
        id: uid(),
        type: 'text',
        page,
        x: showNewText.x,
        y: showNewText.y,
        text: newTextDraft,
        fontSize: liveFontSize,
        color: liveColor,
        fontName: showNewText.fontName,
        fontFamilyCss: showNewText.fontFamilyCss,
        coverOriginal: false,
      },
    ])
    setShowNewText(null)
    setNewTextDraft('')
  }

  async function onImagePicked(file: File) {
    const pt = pendingImageAt.current || dragStart.current || { x: 0.35, y: 0.3 }
    pendingImageAt.current = null
    dragStart.current = null

    try {
      setStatus('Placing image…')
      const dataUrl = await readAsDataURL(file)
      const natural = await loadImageNaturalSize(dataUrl)
      const pageW = viewSize.w || 1
      const pageH = viewSize.h || 1

      // Default width ~28% of page; height preserves image aspect in screen space
      let w = 0.28
      let h = w * (natural.h / Math.max(1, natural.w)) * (pageW / pageH)
      if (h > 0.45) {
        h = 0.45
        w = h * (natural.w / Math.max(1, natural.h)) * (pageH / pageW)
      }
      w = Math.max(0.06, Math.min(0.9, w))
      h = Math.max(0.04, Math.min(0.9, h))

      // Center on click when possible
      let x = pt.x - w / 2
      let y = pt.y - h / 2
      x = Math.max(0, Math.min(1 - w, x))
      y = Math.max(0, Math.min(1 - h, y))

      const id = uid()
      pushHistory([
        ...annotationsRef.current,
        {
          id,
          type: 'image',
          page,
          x,
          y,
          w,
          h,
          dataUrl,
        },
      ])
      setSelectedAnnId(id)
      setTool('select')
      setStatus(
        'Image placed — drag to move, use corner handles to resize. Click Image tool + page to add another.',
      )
    } catch (err) {
      console.error(err)
      setStatus(err instanceof Error ? err.message : 'Could not load image')
    }
  }

  function beginImageMove(
    e: React.PointerEvent,
    ann: Extract<Annotation, { type: 'image' }>,
  ) {
    e.preventDefault()
    e.stopPropagation()
    if (tool === 'erase') {
      pushHistory(annotationsRef.current.filter((x) => x.id !== ann.id))
      setSelectedAnnId(null)
      return
    }
    if (activeSpanId) commitActiveEdit()
    setSelectedAnnId(ann.id)
    if (tool === 'image') setTool('select')

    const pageEl = (e.currentTarget as HTMLElement).closest(
      '.le-page',
    ) as HTMLElement | null
    const rect = pageEl?.getBoundingClientRect()
    imageInteract.current = {
      mode: 'move',
      id: ann.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: ann.x,
      origY: ann.y,
      origW: ann.w,
      origH: ann.h,
      pageW: rect?.width || viewSize.w || 1,
      pageH: rect?.height || viewSize.h || 1,
      before: annotationsRef.current,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  function beginImageResize(
    e: React.PointerEvent,
    ann: Extract<Annotation, { type: 'image' }>,
    corner: 'nw' | 'ne' | 'sw' | 'se',
  ) {
    e.preventDefault()
    e.stopPropagation()
    if (activeSpanId) commitActiveEdit()
    setSelectedAnnId(ann.id)
    const pageEl = (e.currentTarget as HTMLElement).closest(
      '.le-page',
    ) as HTMLElement | null
    const rect = pageEl?.getBoundingClientRect()
    imageInteract.current = {
      mode: 'resize',
      id: ann.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: ann.x,
      origY: ann.y,
      origW: ann.w,
      origH: ann.h,
      corner,
      pageW: rect?.width || viewSize.w || 1,
      pageH: rect?.height || viewSize.h || 1,
      before: annotationsRef.current,
    }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  function onImagePointerMove(e: React.PointerEvent) {
    const ix = imageInteract.current
    if (!ix) return
    const dx = (e.clientX - ix.startClientX) / ix.pageW
    const dy = (e.clientY - ix.startClientY) / ix.pageH

    setAnnotations((prev) =>
      prev.map((a) => {
        if (a.id !== ix.id || a.type !== 'image') return a
        if (ix.mode === 'move') {
          let x = ix.origX + dx
          let y = ix.origY + dy
          x = Math.max(0, Math.min(1 - a.w, x))
          y = Math.max(0, Math.min(1 - a.h, y))
          return { ...a, x, y }
        }
        // resize from corner, keep min size, clamp to page
        let { origX: x, origY: y, origW: w, origH: h } = ix
        const minW = 0.04
        const minH = 0.03
        if (ix.corner === 'se') {
          w = Math.max(minW, ix.origW + dx)
          h = Math.max(minH, ix.origH + dy)
        } else if (ix.corner === 'sw') {
          w = Math.max(minW, ix.origW - dx)
          h = Math.max(minH, ix.origH + dy)
          x = ix.origX + ix.origW - w
        } else if (ix.corner === 'ne') {
          w = Math.max(minW, ix.origW + dx)
          h = Math.max(minH, ix.origH - dy)
          y = ix.origY + ix.origH - h
        } else {
          // nw
          w = Math.max(minW, ix.origW - dx)
          h = Math.max(minH, ix.origH - dy)
          x = ix.origX + ix.origW - w
          y = ix.origY + ix.origH - h
        }
        // clamp into page
        if (x < 0) {
          w += x
          x = 0
        }
        if (y < 0) {
          h += y
          y = 0
        }
        if (x + w > 1) w = 1 - x
        if (y + h > 1) h = 1 - y
        w = Math.max(minW, w)
        h = Math.max(minH, h)
        return { ...a, x, y, w, h }
      }),
    )
  }

  function onImagePointerUp() {
    const ix = imageInteract.current
    if (!ix) return
    imageInteract.current = null
    // Commit one undo step: before → current
    setHistory((h) => [...h.slice(-40), ix.before])
    setFuture([])
    setStatus('Image positioned')
  }

  function deleteSelectedImage() {
    if (!selectedAnnId) return
    pushHistory(annotationsRef.current.filter((a) => a.id !== selectedAnnId))
    setSelectedAnnId(null)
  }

  async function save() {
    if (!pdfBytes) return
    if (activeSpanId) commitActiveEdit()
    setBusy(true)
    setStatus('Exporting with matched fonts… original structure preserved.')
    try {
      // Allow state flush
      await new Promise((r) => setTimeout(r, 30))
      const out = await exportEditedPdf(
        pdfBytes,
        annotationsRef.current,
        pageMetas,
      )
      downloadBytes(out, `${baseName(fileName)}_dragonPDF.pdf`)
      setStatus(
        'Saved. Original page fonts/layout kept; edits use closest matching typeface.',
      )
    } catch (e) {
      console.error(e)
      setStatus(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  const tools: { id: EditorTool; label: string; icon: React.ReactNode }[] = [
    { id: 'select', label: 'Edit text', icon: <MousePointer2 size={18} /> },
    { id: 'text', label: 'Add text', icon: <Type size={18} /> },
    { id: 'ink', label: 'Ink / Handwrite', icon: <PenLine size={18} /> },
    { id: 'highlight', label: 'Highlight', icon: <Highlighter size={18} /> },
    { id: 'rect', label: 'Box', icon: <Square size={18} /> },
    { id: 'cover', label: 'Whiteout', icon: <Eye size={18} /> },
    { id: 'image', label: 'Add image', icon: <ImagePlus size={18} /> },
    { id: 'erase', label: 'Erase edit', icon: <Eraser size={18} /> },
  ]

  return (
    <div className="live-editor">
      <header className="le-top">
        <div className="le-top-left">
          <Link to="/" className="le-brand">
            <span className="logo-mark">🐉</span>
            <span className="logo-text">
              dragon<em>PDF</em>
            </span>
          </Link>
          <span className="le-divider" />
          <span className="le-title">Live Editor</span>
          {pdfBytes && (
            <span className="le-file" title={fileName}>
              {fileName}
            </span>
          )}
        </div>
        <div className="le-top-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={16} /> Open PDF
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!history.length}
            onClick={undo}
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!future.length}
            onClick={redo}
          >
            <Redo2 size={16} />
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!pdfBytes || busy}
            onClick={() => void save()}
          >
            <Download size={16} /> Save PDF
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void loadFile(f)
          }}
        />
        <input
          ref={imgInputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void onImagePicked(f)
          }}
        />
      </header>

      <div className="le-body">
        <aside className="le-sidebar">
          <p className="le-side-label">Tools</p>
          {tools.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`le-tool ${tool === t.id ? 'active' : ''}`}
              onClick={() => {
                if (activeSpanId) commitActiveEdit()
                setTool(t.id)
              }}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}

          <div className="le-props">
            <p className="le-side-label">Text / font</p>
            {activeSpan ? (
              <>
                <div className="le-font-chip">
                  <TypeIcon size={14} />
                  <div>
                    <strong>{fontLabel(activeSpan.fontName)}</strong>
                    <small>
                      {Math.round(activeSpan.fontSizePt)}pt
                      {activeSpan.bold ? ' · Bold' : ''}
                      {activeSpan.italic ? ' · Italic' : ''}
                    </small>
                  </div>
                </div>
                <label className="le-check">
                  <input
                    type="checkbox"
                    checked={adoptFont}
                    onChange={(e) => setAdoptFont(e.target.checked)}
                  />
                  Adopt PDF font
                </label>
                <label>
                  Color
                  <input
                    type="color"
                    value={liveColor}
                    onChange={(e) => setLiveColor(e.target.value)}
                  />
                </label>
                <label>
                  Size {liveFontSize.toFixed(1)}pt
                  <input
                    type="range"
                    min={6}
                    max={48}
                    step={0.5}
                    value={liveFontSize}
                    onChange={(e) => setLiveFontSize(Number(e.target.value))}
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={commitActiveEdit}
                >
                  Apply text
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ width: '100%' }}
                  onClick={cancelActiveEdit}
                >
                  Cancel
                </button>
              </>
            ) : (
              <p className="muted" style={{ margin: 0, fontSize: '0.78rem' }}>
                Click any text on the page to edit it live. The original typeface
                is detected and applied.
              </p>
            )}

            {(tool === 'ink' || tool === 'rect') && (
              <>
                <label>
                  Stroke color
                  <input
                    type="color"
                    value={inkColor}
                    onChange={(e) => setInkColor(e.target.value)}
                  />
                </label>
                {tool === 'ink' && (
                  <label>
                    Width {inkWidth.toFixed(1)}
                    <input
                      type="range"
                      min={0.8}
                      max={12}
                      step={0.2}
                      value={inkWidth}
                      onChange={(e) => setInkWidth(Number(e.target.value))}
                    />
                  </label>
                )}
              </>
            )}
            {tool === 'highlight' && (
              <label>
                Highlight
                <input
                  type="color"
                  value={highlightColor}
                  onChange={(e) => setHighlightColor(e.target.value)}
                />
              </label>
            )}
            {(tool === 'image' ||
              (selectedAnnId &&
                annotations.some(
                  (a) => a.id === selectedAnnId && a.type === 'image',
                ))) && (
              <div className="le-image-props">
                <p className="le-side-label">Image</p>
                {tool === 'image' && (
                  <p className="muted" style={{ margin: 0, fontSize: '0.78rem' }}>
                    Click anywhere on the page to place an image. Then drag to
                    move or resize with corner handles.
                  </p>
                )}
                {selectedAnnId &&
                  annotations.some(
                    (a) => a.id === selectedAnnId && a.type === 'image',
                  ) && (
                    <>
                      <p className="muted" style={{ margin: 0, fontSize: '0.78rem' }}>
                        Drag the image to reposition. Corners resize.
                      </p>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ width: '100%' }}
                        onClick={deleteSelectedImage}
                      >
                        <Trash2 size={14} /> Remove image
                      </button>
                    </>
                  )}
              </div>
            )}
            {annotations.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: '100%', marginTop: 8 }}
                onClick={() => {
                  pushHistory(
                    annotationsRef.current.filter((a) => a.page !== page),
                  )
                  setActiveSpanId(null)
                }}
              >
                <Trash2 size={14} /> Clear page edits
              </button>
            )}
          </div>

          <div className="le-preserve-note">
            <Hand size={14} />
            <p>
              <strong>Font-aware live edit</strong>
              <br />
              Click text to type in place. We detect the PDF font and match size
              & style. Original structure stays intact.
            </p>
          </div>
        </aside>

        <main className="le-stage-wrap">
          {!pdfBytes ? (
            <div
              className="le-empty dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const f = e.dataTransfer.files?.[0]
                if (f) void loadFile(f)
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <div style={{ fontSize: '2.5rem' }}>🐉</div>
              <h2>Open a PDF for live text editing</h2>
              <p>
                Click any word to edit with its original font. Handwritten scans
                use Ink mode.
              </p>
              <button type="button" className="btn btn-primary">
                Choose PDF
              </button>
            </div>
          ) : (
            <>
              <div className="le-pager">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={page <= 0}
                  onClick={() => {
                    if (activeSpanId) commitActiveEdit()
                    setPage((p) => Math.max(0, p - 1))
                  }}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  Page {page + 1} / {numPages}
                  {meta?.handwrittenLike && (
                    <span className="le-hand-badge"> Handwritten / scan</span>
                  )}
                  {!meta?.handwrittenLike && pageSpans.length > 0 && (
                    <span className="le-text-badge">
                      {' '}
                      {pageSpans.length} text runs
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={page >= numPages - 1}
                  onClick={() => {
                    if (activeSpanId) commitActiveEdit()
                    setPage((p) => Math.min(numPages - 1, p + 1))
                  }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {handModeHint && meta?.handwrittenLike && (
                <div className="le-banner">
                  Little selectable text on this page. Use <b>Ink</b> for
                  handwriting, or <b>Add text</b> for labels.
                </div>
              )}
              {!meta?.handwrittenLike && tool !== 'image' && (
                <div className="le-banner le-banner-soft">
                  <b>Edit text:</b> click a word or line. Typing updates live
                  using the detected font (
                  {pageSpans[0]
                    ? fontLabel(pageSpans[0].fontName)
                    : 'from PDF'}
                  ).
                </div>
              )}
              {tool === 'image' && (
                <div className="le-banner">
                  <b>Add image:</b> click anywhere on the page → pick a file. Then
                  drag to move or use the blue corner handles to resize.
                </div>
              )}

              <div className="le-stage">
                <div
                  className="le-page"
                  style={{
                    width: viewSize.w || undefined,
                    height: viewSize.h || undefined,
                  }}
                  onPointerMove={onImagePointerMove}
                  onPointerUp={onImagePointerUp}
                  onPointerLeave={(e) => {
                    // only end if we left the page while dragging
                    if (imageInteract.current && e.buttons === 0) {
                      onImagePointerUp()
                    }
                  }}
                >
                  <canvas ref={pdfCanvasRef} className="le-pdf-layer" />
                  <canvas
                    ref={overlayRef}
                    className="le-overlay-layer"
                    style={{
                      pointerEvents:
                        tool === 'select' || tool === 'text'
                          ? 'none'
                          : 'auto',
                      cursor:
                        tool === 'image'
                          ? 'copy'
                          : tool === 'ink' ||
                              tool === 'highlight' ||
                              tool === 'rect' ||
                              tool === 'cover'
                            ? 'crosshair'
                            : tool === 'erase'
                              ? 'cell'
                              : 'default',
                    }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerLeave={onPointerUp}
                  />

                  {/* Interactive images — click place, drag, resize */}
                  {viewSize.w > 0 && (
                    <div className="le-image-layer">
                      {pageAnns
                        .filter(
                          (a): a is Extract<Annotation, { type: 'image' }> =>
                            a.type === 'image',
                        )
                        .map((img) => {
                          const selected = selectedAnnId === img.id
                          return (
                            <div
                              key={img.id}
                              className={`le-image-widget ${selected ? 'selected' : ''}`}
                              style={{
                                left: `${img.x * 100}%`,
                                top: `${img.y * 100}%`,
                                width: `${img.w * 100}%`,
                                height: `${img.h * 100}%`,
                                opacity: img.opacity ?? 1,
                              }}
                              onPointerDown={(e) => beginImageMove(e, img)}
                              title="Drag to move · corners resize"
                            >
                              <img
                                src={img.dataUrl}
                                alt=""
                                draggable={false}
                                className="le-image-widget-img"
                              />
                              {selected && (
                                <>
                                  {(
                                    ['nw', 'ne', 'sw', 'se'] as const
                                  ).map((corner) => (
                                    <span
                                      key={corner}
                                      className={`le-image-handle le-image-handle-${corner}`}
                                      onPointerDown={(e) =>
                                        beginImageResize(e, img, corner)
                                      }
                                    />
                                  ))}
                                </>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  )}

                  {/* Interactive text layer — font-matched live editing */}
                  {(tool === 'select' ||
                    tool === 'text' ||
                    tool === 'erase' ||
                    activeSpanId) &&
                    viewSize.w > 0 && (
                      <div className="le-text-layer">
                        {pageSpans.map((span) => {
                          const edit = spanEdits.get(span.id)
                          const isActive = activeSpanId === span.id
                          const displayText = isActive
                            ? liveText
                            : edit?.text ?? span.text
                          const color = isActive
                            ? liveColor
                            : edit?.color ?? '#111827'
                          const sizePx = isActive
                            ? liveFontSize * SCALE
                            : (edit?.fontSize ?? span.fontSizePt) * SCALE
                          const family =
                            isActive && !adoptFont
                              ? 'Arial, Helvetica, sans-serif'
                              : edit?.fontFamilyCss || span.fontFamilyCss

                          if (isActive) {
                            return (
                              <textarea
                                key={span.id}
                                ref={editInputRef}
                                className="le-text-span le-text-editing"
                                value={liveText}
                                onChange={(e) => setLiveText(e.target.value)}
                                onBlur={() => commitActiveEdit()}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') {
                                    e.preventDefault()
                                    cancelActiveEdit()
                                  }
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    commitActiveEdit()
                                  }
                                }}
                                style={{
                                  left: `${span.x * 100}%`,
                                  top: `${span.y * 100}%`,
                                  minWidth: `${Math.max(span.w * 100, 4)}%`,
                                  minHeight: `${Math.max(span.h * 100, 1.5)}%`,
                                  fontSize: sizePx,
                                  fontFamily: family,
                                  fontWeight: span.bold ? 700 : 400,
                                  fontStyle: span.italic ? 'italic' : 'normal',
                                  color,
                                  lineHeight: 1.15,
                                }}
                              />
                            )
                          }

                          // Hide original look for edited spans by showing replacement
                          const showReplacement = !!edit
                          return (
                            <div
                              key={span.id}
                              className={`le-text-span ${showReplacement ? 'le-text-replaced' : ''}`}
                              title={`${fontLabel(span.fontName)} · ${Math.round(span.fontSizePt)}pt — click to edit`}
                              onClick={(e) => {
                                e.stopPropagation()
                                beginEditSpan(span)
                              }}
                              style={{
                                left: `${span.x * 100}%`,
                                top: `${span.y * 100}%`,
                                width: `${Math.max(span.w * 100, 1)}%`,
                                height: `${Math.max(span.h * 100, 1)}%`,
                                fontSize: sizePx,
                                fontFamily: family,
                                fontWeight: span.bold ? 700 : 400,
                                fontStyle: span.italic ? 'italic' : 'normal',
                                color: showReplacement ? color : 'transparent',
                                lineHeight: 1.1,
                              }}
                            >
                              {showReplacement ? displayText : span.text}
                            </div>
                          )
                        })}
                      </div>
                    )}
                </div>
              </div>
            </>
          )}
          {status && <div className="le-status">{status}</div>}
        </main>
      </div>

      {showNewText && (
        <div
          className="le-modal-backdrop"
          onClick={() => setShowNewText(null)}
        >
          <div className="le-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Add text</h3>
            <p className="muted">
              Font adopted from nearby text:{' '}
              <strong>{fontLabel(showNewText.fontName)}</strong> (
              {Math.round(showNewText.fontSize)}pt)
            </p>
            <textarea
              autoFocus
              rows={3}
              value={newTextDraft}
              onChange={(e) => setNewTextDraft(e.target.value)}
              style={{
                fontFamily: showNewText.fontFamilyCss,
                fontSize: Math.max(14, showNewText.fontSize),
              }}
              placeholder="Type here…"
            />
            <label>
              Size {liveFontSize}pt
              <input
                type="range"
                min={6}
                max={48}
                value={liveFontSize}
                onChange={(e) => setLiveFontSize(Number(e.target.value))}
              />
            </label>
            <label>
              Color
              <input
                type="color"
                value={liveColor}
                onChange={(e) => setLiveColor(e.target.value)}
              />
            </label>
            <div className="le-modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowNewText(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={commitNewText}
              >
                Place text
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function mergeLineSpans(
  spans: PdfTextSpan[],
  _vw: number,
  _vh: number,
): PdfTextSpan[] {
  if (spans.length <= 1) return spans
  // Sort reading order
  const sorted = [...spans].sort((a, b) => a.y - b.y || a.x - b.x)
  const merged: PdfTextSpan[] = []
  let cur = { ...sorted[0] }

  for (let i = 1; i < sorted.length; i++) {
    const s = sorted[i]
    const sameLine = Math.abs(s.y - cur.y) < cur.h * 0.45
    const gap = s.x - (cur.x + cur.w)
    const sameFont =
      s.fontName === cur.fontName &&
      Math.abs(s.fontSizePt - cur.fontSizePt) < 0.6
    if (sameLine && sameFont && gap < cur.w * 0.8 && gap > -0.01) {
      const space = gap > cur.h * 0.15 ? ' ' : ''
      const right = Math.max(cur.x + cur.w, s.x + s.w)
      const bottom = Math.max(cur.y + cur.h, s.y + s.h)
      cur = {
        ...cur,
        text: cur.text + space + s.text,
        w: right - cur.x,
        h: bottom - cur.y,
      }
    } else {
      merged.push(cur)
      cur = { ...s }
    }
  }
  merged.push(cur)
  return merged
}

function findNearestSpan(spans: PdfTextSpan[], pt: Point): PdfTextSpan | null {
  if (!spans.length) return null
  let best = spans[0]
  let bestD = Infinity
  for (const s of spans) {
    const cx = s.x + s.w / 2
    const cy = s.y + s.h / 2
    const d = Math.hypot(cx - pt.x, cy - pt.y)
    if (d < bestD) {
      bestD = d
      best = s
    }
  }
  return best
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

function loadImageNaturalSize(
  dataUrl: string,
): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () =>
      resolve({
        w: img.naturalWidth || 800,
        h: img.naturalHeight || 600,
      })
    img.onerror = () => reject(new Error('Invalid image file'))
    img.src = dataUrl
  })
}
