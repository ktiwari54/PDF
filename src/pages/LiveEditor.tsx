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
} from 'lucide-react'
import type {
  Annotation,
  EditorTool,
  PageMeta,
  Point,
} from '../types/annotations'
import { uid } from '../types/annotations'
import { exportEditedPdf } from '../lib/liveEditExport'
import { downloadBytes, baseName } from '../lib/pdfOps'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const SCALE = 1.35

export function LiveEditor() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imgInputRef = useRef<HTMLInputElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)

  const [fileName, setFileName] = useState('document.pdf')
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null)
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(0)
  const [numPages, setNumPages] = useState(0)
  const [pageMetas, setPageMetas] = useState<PageMeta[]>([])
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 })
  const [tool, setTool] = useState<EditorTool>('ink')
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [history, setHistory] = useState<Annotation[][]>([])
  const [future, setFuture] = useState<Annotation[][]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [handModeHint, setHandModeHint] = useState(false)
  const [tick, setTick] = useState(0)
  const annotationsRef = useRef<Annotation[]>([])
  annotationsRef.current = annotations

  // Tool options
  const [inkColor, setInkColor] = useState('#1e293b')
  const [inkWidth, setInkWidth] = useState(2.5)
  const [textColor, setTextColor] = useState('#111827')
  const [fontSize, setFontSize] = useState(16)
  const [highlightColor, setHighlightColor] = useState('#fde047')
  const [textDraft, setTextDraft] = useState('')
  const [showTextModal, setShowTextModal] = useState<{
    x: number
    y: number
  } | null>(null)

  const drawing = useRef(false)
  const currentStroke = useRef<Point[]>([])
  const dragStart = useRef<Point | null>(null)
  const tempShape = useRef<Annotation | null>(null)

  const pageAnns = useMemo(
    () => annotations.filter((a) => a.page === page),
    [annotations, page],
  )

  const meta = pageMetas[page]

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
  }

  const redo = () => {
    if (!future.length) return
    const [next, ...rest] = future
    setHistory((h) => [...h, annotationsRef.current])
    setFuture(rest)
    setAnnotations(next)
  }

  async function loadFile(file: File) {
    setBusy(true)
    setStatus('Opening PDF (original structure kept intact)…')
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      setPdfBytes(bytes)
      setFileName(file.name)
      setAnnotations([])
      setHistory([])
      setFuture([])
      setSelectedId(null)
      setPage(0)

      const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise
      setPdfDoc(doc)
      setNumPages(doc.numPages)

      const metas: PageMeta[] = []
      for (let i = 1; i <= doc.numPages; i++) {
        const p = await doc.getPage(i)
        const vp = p.getViewport({ scale: 1 })
        const content = await p.getTextContent()
        const textItems = content.items.filter(
          (it) => 'str' in it && String((it as { str: string }).str).trim(),
        )
        const totalChars = textItems.reduce(
          (n, it) => n + String((it as { str: string }).str).length,
          0,
        )
        // Scanned / handwritten heuristic: few extractable glyphs
        const handwrittenLike = textItems.length < 8 || totalChars < 40
        metas.push({
          width: vp.width,
          height: vp.height,
          handwrittenLike,
          textItemCount: textItems.length,
        })
      }
      setPageMetas(metas)

      const anyHand = metas.some((m) => m.handwrittenLike)
      setHandModeHint(anyHand)
      if (anyHand) {
        setTool('ink')
        setInkWidth(3)
        setInkColor('#1e3a5f')
        setStatus(
          'Handwritten / scanned pages detected — Ink tool ready. Original pages stay untouched.',
        )
      } else {
        setTool('text')
        setStatus(
          'PDF loaded. Live edits are non-destructive overlays — fonts & layout of the original stay intact.',
        )
      }
    } catch (e) {
      console.error(e)
      setStatus(e instanceof Error ? e.message : 'Failed to open PDF')
    } finally {
      setBusy(false)
    }
  }

  // Render PDF page (background only — never modifies source)
  useEffect(() => {
    let cancelled = false
    async function render() {
      if (!pdfDoc || !pdfCanvasRef.current) return
      const p = await pdfDoc.getPage(page + 1)
      const viewport = p.getViewport({ scale: SCALE })
      const canvas = pdfCanvasRef.current
      canvas.width = Math.floor(viewport.width)
      canvas.height = Math.floor(viewport.height)
      setViewSize({ w: canvas.width, h: canvas.height })
      const ctx = canvas.getContext('2d')!
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      await p.render({
        canvasContext: ctx,
        viewport,
        canvas,
      } as Parameters<typeof p.render>[0]).promise
      if (cancelled) return
    }
    void render()
    return () => {
      cancelled = true
    }
  }, [pdfDoc, page])

  // Draw annotation overlay
  useEffect(() => {
    const canvas = overlayRef.current
    if (!canvas || !viewSize.w) return
    canvas.width = viewSize.w
    canvas.height = viewSize.h
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const drawAnn = (ann: Annotation, selected: boolean) => {
      if (ann.type === 'ink') {
        if (ann.points.length < 2) return
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
      } else if (ann.type === 'highlight' || ann.type === 'rect' || ann.type === 'cover') {
        const x = ann.x * canvas.width
        const y = ann.y * canvas.height
        const w = ann.w * canvas.width
        const h = ann.h * canvas.height
        if (ann.type === 'highlight') {
          ctx.fillStyle = ann.color
          ctx.globalAlpha = ann.opacity ?? 0.35
          ctx.fillRect(x, y, w, h)
          ctx.globalAlpha = 1
        } else if (ann.type === 'cover') {
          ctx.fillStyle = ann.color || '#ffffff'
          ctx.fillRect(x, y, w, h)
        } else {
          if (ann.fill) {
            ctx.fillStyle = ann.fill
            ctx.globalAlpha = ann.opacity ?? 0.15
            ctx.fillRect(x, y, w, h)
            ctx.globalAlpha = 1
          }
          ctx.strokeStyle = ann.stroke || '#111'
          ctx.lineWidth = (ann.strokeWidth ?? 1.5) * SCALE * 0.6
          ctx.strokeRect(x, y, w, h)
        }
      } else if (ann.type === 'text') {
        const x = ann.x * canvas.width
        const y = ann.y * canvas.height
        ctx.fillStyle = ann.color
        ctx.font = `${ann.bold ? 'bold ' : ''}${ann.fontSize * SCALE * 0.75}px system-ui, sans-serif`
        ctx.textBaseline = 'top'
        const lines = ann.text.split('\n')
        lines.forEach((line, i) => {
          ctx.fillText(line, x, y + i * ann.fontSize * SCALE * 0.95)
        })
      } else if (ann.type === 'image') {
        // deferred — draw placeholder box; images redraw async
        const x = ann.x * canvas.width
        const y = ann.y * canvas.height
        const w = ann.w * canvas.width
        const h = ann.h * canvas.height
        const img = new Image()
        img.src = ann.dataUrl
        // sync draw if cached
        if (img.complete) {
          ctx.drawImage(img, x, y, w, h)
        } else {
          img.onload = () => {
            // force re-render by state noop — use direct draw
            ctx.drawImage(img, x, y, w, h)
          }
        }
      }
      if (selected) {
        // selection outline
        ctx.strokeStyle = '#f07a28'
        ctx.lineWidth = 2
        ctx.setLineDash([4, 3])
        if (ann.type === 'text') {
          ctx.strokeRect(
            ann.x * canvas.width - 4,
            ann.y * canvas.height - 4,
            120,
            ann.fontSize * SCALE,
          )
        } else if ('w' in ann) {
          ctx.strokeRect(
            ann.x * canvas.width,
            ann.y * canvas.height,
            ann.w * canvas.width,
            ann.h * canvas.height,
          )
        }
        ctx.setLineDash([])
      }
    }

    for (const ann of pageAnns) {
      drawAnn(ann, ann.id === selectedId)
    }
    if (tempShape.current && tempShape.current.page === page) {
      drawAnn(tempShape.current, false)
    }
  }, [pageAnns, viewSize, selectedId, page, annotations, tick])

  function normPoint(e: React.PointerEvent, canvas: HTMLCanvasElement): Point {
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    }
  }

  function hitTest(pt: Point): Annotation | null {
    // top-most first
    for (let i = pageAnns.length - 1; i >= 0; i--) {
      const a = pageAnns[i]
      if (a.type === 'ink') {
        for (const p of a.points) {
          if (Math.hypot(p.x - pt.x, p.y - pt.y) < 0.02) return a
        }
      } else if ('w' in a) {
        if (
          pt.x >= a.x &&
          pt.x <= a.x + a.w &&
          pt.y >= a.y &&
          pt.y <= a.y + a.h
        )
          return a
      } else if (a.type === 'text') {
        if (
          pt.x >= a.x &&
          pt.x <= a.x + 0.35 &&
          pt.y >= a.y &&
          pt.y <= a.y + 0.05
        )
          return a
      }
    }
    return null
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const canvas = overlayRef.current
    if (!canvas || !pdfBytes) return
    canvas.setPointerCapture(e.pointerId)
    const pt = normPoint(e, canvas)

    if (tool === 'select' || tool === 'pan') {
      const hit = hitTest(pt)
      setSelectedId(hit?.id ?? null)
      return
    }

    if (tool === 'erase') {
      const hit = hitTest(pt)
      if (hit) {
        pushHistory(annotations.filter((a) => a.id !== hit.id))
        setSelectedId(null)
      }
      return
    }

    if (tool === 'ink') {
      drawing.current = true
      currentStroke.current = [pt]
      return
    }

    if (tool === 'text') {
      setShowTextModal({ x: pt.x, y: pt.y })
      setTextDraft('')
      return
    }

    if (tool === 'highlight' || tool === 'rect' || tool === 'cover') {
      drawing.current = true
      dragStart.current = pt
      return
    }

    if (tool === 'image') {
      imgInputRef.current?.click()
      // store click position for image placement
      dragStart.current = pt
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const canvas = overlayRef.current
    if (!canvas || !drawing.current) return
    const pt = normPoint(e, canvas)

    if (tool === 'ink') {
      currentStroke.current.push(pt)
      // live preview via temp shape
      tempShape.current = {
        id: 'temp',
        type: 'ink',
        page,
        points: [...currentStroke.current],
        color: inkColor,
        width: inkWidth,
      }
      setTick((t) => t + 1)
      return
    }

    if (
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
          strokeWidth: 1.5,
        }
      }
      setTick((t) => t + 1)
    }
  }

  const onPointerUp = () => {
    if (tool === 'ink' && drawing.current && currentStroke.current.length > 1) {
      const ann: Annotation = {
        id: uid(),
        type: 'ink',
        page,
        points: currentStroke.current,
        color: inkColor,
        width: inkWidth,
      }
      tempShape.current = null
      pushHistory([...annotationsRef.current, ann])
    } else if (
      (tool === 'highlight' || tool === 'rect' || tool === 'cover') &&
      tempShape.current &&
      tempShape.current.id === 'temp'
    ) {
      const final = { ...tempShape.current, id: uid() } as Annotation
      tempShape.current = null
      if ('w' in final && final.w > 0.005 && final.h > 0.005) {
        pushHistory([...annotationsRef.current, final])
      }
    }
    drawing.current = false
    currentStroke.current = []
    dragStart.current = null
    if (tempShape.current?.id === 'temp') {
      tempShape.current = null
      setTick((t) => t + 1)
    }
  }

  function commitText() {
    if (!showTextModal || !textDraft.trim()) {
      setShowTextModal(null)
      return
    }
    const ann: Annotation = {
      id: uid(),
      type: 'text',
      page,
      x: showTextModal.x,
      y: showTextModal.y,
      text: textDraft,
      fontSize,
      color: textColor,
    }
    pushHistory([...annotations, ann])
    setShowTextModal(null)
    setTextDraft('')
  }

  async function onImagePicked(file: File) {
    const pt = dragStart.current || { x: 0.1, y: 0.1 }
    const dataUrl = await readAsDataURL(file)
    const ann: Annotation = {
      id: uid(),
      type: 'image',
      page,
      x: pt.x,
      y: pt.y,
      w: 0.25,
      h: 0.18,
      dataUrl,
    }
    pushHistory([...annotations, ann])
    dragStart.current = null
  }

  async function save() {
    if (!pdfBytes) return
    setBusy(true)
    setStatus('Exporting… original fonts & structure preserved.')
    try {
      const out = await exportEditedPdf(pdfBytes, annotations, pageMetas)
      downloadBytes(out, `${baseName(fileName)}_dragonPDF.pdf`)
      setStatus('Saved. Original page content was not rewritten — only overlays added.')
    } catch (e) {
      console.error(e)
      setStatus(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  function clearPageAnnotations() {
    pushHistory(annotations.filter((a) => a.page !== page))
  }

  const tools: { id: EditorTool; label: string; icon: React.ReactNode }[] = [
    { id: 'select', label: 'Select', icon: <MousePointer2 size={18} /> },
    { id: 'ink', label: 'Ink / Handwrite', icon: <PenLine size={18} /> },
    { id: 'text', label: 'Add text', icon: <Type size={18} /> },
    { id: 'highlight', label: 'Highlight', icon: <Highlighter size={18} /> },
    { id: 'rect', label: 'Box', icon: <Square size={18} /> },
    { id: 'cover', label: 'Whiteout', icon: <Eye size={18} /> },
    { id: 'image', label: 'Image', icon: <ImagePlus size={18} /> },
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
          {fileName && pdfBytes && (
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
            title="Undo"
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={!future.length}
            onClick={redo}
            title="Redo"
          >
            <Redo2 size={16} />
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!pdfBytes || busy || !annotations.length}
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
              onClick={() => setTool(t.id)}
              title={t.label}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}

          <div className="le-props">
            <p className="le-side-label">Options</p>
            {(tool === 'ink' || tool === 'rect') && (
              <>
                <label>
                  Color
                  <input
                    type="color"
                    value={inkColor}
                    onChange={(e) => setInkColor(e.target.value)}
                  />
                </label>
                {tool === 'ink' && (
                  <label>
                    Stroke {inkWidth.toFixed(1)}
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
            {tool === 'text' && (
              <>
                <label>
                  Color
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                  />
                </label>
                <label>
                  Size {fontSize}pt
                  <input
                    type="range"
                    min={8}
                    max={48}
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                  />
                </label>
              </>
            )}
            {tool === 'highlight' && (
              <label>
                Color
                <input
                  type="color"
                  value={highlightColor}
                  onChange={(e) => setHighlightColor(e.target.value)}
                />
              </label>
            )}
            {selectedId && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: '100%', marginTop: 8 }}
                onClick={() => {
                  pushHistory(annotations.filter((a) => a.id !== selectedId))
                  setSelectedId(null)
                }}
              >
                <Trash2 size={14} /> Delete selected
              </button>
            )}
            {pageAnns.length > 0 && (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: '100%', marginTop: 8 }}
                onClick={clearPageAnnotations}
              >
                Clear page edits
              </button>
            )}
          </div>

          <div className="le-preserve-note">
            <Hand size={14} />
            <p>
              <strong>Structure-safe editing</strong>
              <br />
              Original fonts, images, and layout are never rebuilt. Your marks
              are layered on top.
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
              <h2>Open a PDF to edit live</h2>
              <p>
                Digital PDFs keep their fonts. Handwritten / scanned pages get
                Ink mode automatically.
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
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  <ChevronLeft size={16} />
                </button>
                <span>
                  Page {page + 1} / {numPages}
                  {meta?.handwrittenLike && (
                    <span className="le-hand-badge"> Handwritten / scan</span>
                  )}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={page >= numPages - 1}
                  onClick={() => setPage((p) => Math.min(numPages - 1, p + 1))}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {handModeHint && meta?.handwrittenLike && (
                <div className="le-banner">
                  This page looks scanned or handwritten. Use <b>Ink</b> for
                  natural writing, or <b>Whiteout</b> + <b>Text</b> to cover and
                  annotate without altering the original image.
                </div>
              )}

              <div className="le-stage" ref={stageRef}>
                <div
                  className="le-page"
                  style={{ width: viewSize.w || undefined }}
                >
                  <canvas ref={pdfCanvasRef} className="le-pdf-layer" />
                  <canvas
                    ref={overlayRef}
                    className="le-overlay-layer"
                    style={{
                      cursor:
                        tool === 'ink'
                          ? 'crosshair'
                          : tool === 'text'
                            ? 'text'
                            : tool === 'erase'
                              ? 'cell'
                              : 'default',
                    }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerLeave={onPointerUp}
                  />
                </div>
              </div>
            </>
          )}

          {status && <div className="le-status">{status}</div>}
        </main>
      </div>

      {showTextModal && (
        <div className="le-modal-backdrop" onClick={() => setShowTextModal(null)}>
          <div
            className="le-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Add text overlay</h3>
            <p className="muted">
              Placed as a new layer — does not change existing PDF fonts.
            </p>
            <textarea
              autoFocus
              rows={4}
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              placeholder="Type here…"
            />
            <div className="le-modal-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setShowTextModal(null)}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={commitText}>
                Place text
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = reject
    r.readAsDataURL(file)
  })
}
