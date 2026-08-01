import { useCallback, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getTool } from '../data/tools'
import { ToolIcon } from '../components/ToolIcon'
import * as ops from '../lib/pdfOps'

function formatSize(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

export function ToolPage() {
  const { toolId } = useParams()
  const tool = getTool(toolId || '')
  const inputRef = useRef<HTMLInputElement>(null)
  const sigCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  const [files, setFiles] = useState<File[]>([])
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{
    type: 'info' | 'error' | 'success'
    msg: string
  } | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [textOut, setTextOut] = useState<string | null>(null)

  // Options
  const [pageRange, setPageRange] = useState('1')
  const [rotateAngle, setRotateAngle] = useState<90 | 180 | 270>(90)
  const [watermark, setWatermark] = useState('CONFIDENTIAL')
  const [cropMargin, setCropMargin] = useState(36)
  const [password, setPassword] = useState('')
  const [editText, setEditText] = useState('Hello from PDF Tools')
  const [pageOrder, setPageOrder] = useState('')
  const [numberPos, setNumberPos] = useState<
    'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center'
  >('bottom-center')
  const [targetLang, setTargetLang] = useState('es')
  const [htmlPaste, setHtmlPaste] = useState('<h1>Hello</h1><p>Paste HTML here</p>')

  const accept = tool?.accept ?? 'application/pdf'

  const onFiles = useCallback(
    (list: FileList | File[]) => {
      const arr = Array.from(list)
      if (!tool) return
      setFiles(tool.multiple ? arr : arr.slice(0, 1))
      setStatus(null)
      setPreview(null)
      setTextOut(null)
    },
    [tool],
  )

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDrag(false)
    if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files)
  }

  const canRun = useMemo(() => {
    if (!tool) return false
    if (tool.id === 'html-to-pdf' && htmlPaste.trim()) return true
    const min = tool.minFiles ?? 1
    return files.length >= min
  }, [tool, files, htmlPaste])

  async function run() {
    if (!tool) return
    setBusy(true)
    setStatus({ type: 'info', msg: 'Processing… this may take a moment.' })
    setPreview(null)
    setTextOut(null)
    try {
      const f = files[0]
      switch (tool.id) {
        case 'merge-pdf': {
          const bytes = await ops.mergePdfs(files)
          ops.downloadBytes(bytes, 'merged.pdf')
          break
        }
        case 'split-pdf': {
          const zip = await ops.splitPdf(f)
          ops.downloadBlob(zip, `${ops.baseName(f.name)}_split.zip`)
          break
        }
        case 'remove-pages': {
          const pages = parsePages(pageRange)
          const bytes = await ops.removePages(f, pages)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_removed.pdf`)
          break
        }
        case 'extract-pages': {
          const pages = parsePages(pageRange)
          const bytes = await ops.extractPages(f, pages)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_extracted.pdf`)
          break
        }
        case 'organize-pdf': {
          const order = pageOrder
            ? parsePages(pageOrder)
            : Array.from(
                { length: await ops.getPageCount(f) },
                (_, i) => i + 1,
              ).reverse()
          const bytes = await ops.organizePages(f, order)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_organized.pdf`)
          break
        }
        case 'scan-to-pdf':
        case 'jpg-to-pdf': {
          const bytes = await ops.imagesToPdf(files)
          ops.downloadBytes(bytes, 'images.pdf')
          break
        }
        case 'compress-pdf': {
          const bytes = await ops.compressPdf(f)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_compressed.pdf`)
          break
        }
        case 'repair-pdf': {
          const bytes = await ops.repairPdf(f)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_repaired.pdf`)
          break
        }
        case 'ocr-pdf': {
          setStatus({ type: 'info', msg: 'Running OCR (first time downloads language data)…' })
          const { text, pdf } = await ops.ocrToPdf(f)
          setTextOut(text)
          ops.downloadBytes(pdf, `${ops.baseName(f.name)}_ocr.pdf`)
          break
        }
        case 'word-to-pdf': {
          const bytes = await ops.wordToPdf(f)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}.pdf`)
          break
        }
        case 'powerpoint-to-pdf': {
          const bytes = await ops.powerpointToPdf(f)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}.pdf`)
          break
        }
        case 'excel-to-pdf': {
          const bytes = await ops.excelToPdf(f)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}.pdf`)
          break
        }
        case 'html-to-pdf': {
          const bytes = f
            ? await ops.htmlFileToPdf(f)
            : await ops.htmlStringToPdf(htmlPaste)
          ops.downloadBytes(bytes, 'document.pdf')
          break
        }
        case 'pdf-to-jpg': {
          const zip = await ops.pdfToJpg(f)
          ops.downloadBlob(zip, `${ops.baseName(f.name)}_jpg.zip`)
          break
        }
        case 'pdf-to-word': {
          const blob = await ops.pdfToWord(f)
          ops.downloadBlob(blob, `${ops.baseName(f.name)}.doc`)
          break
        }
        case 'pdf-to-powerpoint': {
          const blob = await ops.pdfToPowerpoint(f)
          ops.downloadBlob(blob, `${ops.baseName(f.name)}.ppt.html`)
          break
        }
        case 'pdf-to-excel': {
          const blob = await ops.pdfToExcel(f)
          ops.downloadBlob(blob, `${ops.baseName(f.name)}.xlsx`)
          break
        }
        case 'pdf-to-pdfa': {
          const bytes = await ops.toPdfA(f)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_pdfa.pdf`)
          break
        }
        case 'rotate-pdf': {
          // support multiple
          if (files.length === 1) {
            const bytes = await ops.rotatePdf(f, rotateAngle)
            ops.downloadBytes(bytes, `${ops.baseName(f.name)}_rotated.pdf`)
          } else {
            for (const file of files) {
              const bytes = await ops.rotatePdf(file, rotateAngle)
              ops.downloadBytes(bytes, `${ops.baseName(file.name)}_rotated.pdf`)
            }
          }
          break
        }
        case 'page-numbers': {
          const bytes = await ops.addPageNumbers(f, { position: numberPos })
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_numbered.pdf`)
          break
        }
        case 'watermark': {
          const bytes = await ops.addWatermark(f, watermark)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_watermark.pdf`)
          break
        }
        case 'crop-pdf': {
          const bytes = await ops.cropPdf(f, cropMargin)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_cropped.pdf`)
          break
        }
        case 'edit-pdf': {
          const bytes = await ops.editAddText(f, editText)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_edited.pdf`)
          const url = await ops.renderPreview(
            new File([bytes], 'edited.pdf', { type: 'application/pdf' }),
          )
          setPreview(url)
          break
        }
        case 'pdf-forms': {
          const fields = await ops.listFormFields(f)
          if (fields.length) {
            setTextOut(`Existing form fields:\n${fields.join('\n')}`)
          }
          const bytes = await ops.addSampleFormFields(f)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_form.pdf`)
          break
        }
        case 'unlock-pdf': {
          const bytes = await ops.unlockPdf(f, password || undefined)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_unlocked.pdf`)
          break
        }
        case 'protect-pdf': {
          if (!password) throw new Error('Enter a password to protect the PDF.')
          const bytes = await ops.protectPdf(f, password)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_protected.pdf`)
          break
        }
        case 'sign-pdf': {
          const canvas = sigCanvasRef.current
          if (!canvas) throw new Error('Signature pad missing')
          const dataUrl = canvas.toDataURL('image/png')
          const res = await fetch(dataUrl)
          const buf = new Uint8Array(await res.arrayBuffer())
          const bytes = await ops.signPdf(f, buf)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_signed.pdf`)
          break
        }
        case 'redact-pdf': {
          const bytes = await ops.redactDefaultBand(f)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_redacted.pdf`)
          break
        }
        case 'compare-pdf': {
          if (files.length < 2) throw new Error('Upload two PDFs to compare.')
          const a = await ops.renderPreview(files[0], 0)
          const b = await ops.renderPreview(files[1], 0)
          setPreview(a)
          setTextOut('Second document preview below (open both downloads).')
          // also show second via textOut + create side image
          const imgA = await loadImg(a)
          const imgB = await loadImg(b)
          const c = document.createElement('canvas')
          c.width = imgA.width + imgB.width + 20
          c.height = Math.max(imgA.height, imgB.height)
          const ctx = c.getContext('2d')!
          ctx.fillStyle = '#eee'
          ctx.fillRect(0, 0, c.width, c.height)
          ctx.drawImage(imgA, 0, 0)
          ctx.drawImage(imgB, imgA.width + 20, 0)
          setPreview(c.toDataURL('image/jpeg', 0.9))
          break
        }
        case 'ai-summarizer': {
          const text = await ops.extractText(f)
          const summary = ops.summarizeText(text)
          setTextOut(summary)
          const pdf = await ops.htmlStringToPdf(
            `<h1>Summary</h1><p>${summary}</p>`,
          )
          ops.downloadBytes(pdf, `${ops.baseName(f.name)}_summary.pdf`)
          break
        }
        case 'translate-pdf': {
          const text = await ops.extractText(f)
          const translated = await ops.translateText(text, targetLang)
          setTextOut(translated)
          const pdf = await ops.htmlStringToPdf(
            `<h1>Translation (${targetLang})</h1><pre style="white-space:pre-wrap">${translated}</pre>`,
          )
          ops.downloadBytes(pdf, `${ops.baseName(f.name)}_${targetLang}.pdf`)
          break
        }
        case 'pdf-to-markdown': {
          const md = await ops.pdfToMarkdown(f)
          setTextOut(md)
          ops.downloadBlob(
            new Blob([md], { type: 'text/markdown' }),
            `${ops.baseName(f.name)}.md`,
          )
          break
        }
        default:
          throw new Error('Tool not implemented')
      }
      setStatus({ type: 'success', msg: 'Done! Your download should start automatically.' })
    } catch (err) {
      console.error(err)
      setStatus({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Something went wrong.',
      })
    } finally {
      setBusy(false)
    }
  }

  if (!tool) {
    return (
      <div className="page">
        <p>Tool not found.</p>
        <Link to="/">Back home</Link>
      </div>
    )
  }

  return (
    <div className="page">
      <Link to="/" className="back-link">
        ← All PDF tools
      </Link>
      <div className="tool-page-header">
        <ToolIcon name={tool.icon} color={tool.color} size={26} />
        <div>
          <h1>{tool.name}</h1>
          <p>{tool.description}</p>
        </div>
      </div>

      <div className="workspace">
        <div
          className={`dropzone ${drag ? 'active' : ''}`}
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <div style={{ fontSize: '2rem' }}>📄</div>
          <h2>Select PDF files</h2>
          <p>or drop {tool.multiple ? 'files' : 'a file'} here</p>
          <div style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={(e) => {
                e.stopPropagation()
                inputRef.current?.click()
              }}
            >
              Select files
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            multiple={tool.multiple}
            hidden
            onChange={(e) => e.target.files && onFiles(e.target.files)}
          />
        </div>

        {files.length > 0 && (
          <div className="file-list">
            {files.map((file, i) => (
              <div className="file-row" key={`${file.name}-${i}`}>
                <span className="name">{file.name}</span>
                <span className="size">{formatSize(file.size)}</span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                  onClick={() =>
                    setFiles((prev) => prev.filter((_, j) => j !== i))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <Options
          toolId={tool.id}
          pageRange={pageRange}
          setPageRange={setPageRange}
          rotateAngle={rotateAngle}
          setRotateAngle={setRotateAngle}
          watermark={watermark}
          setWatermark={setWatermark}
          cropMargin={cropMargin}
          setCropMargin={setCropMargin}
          password={password}
          setPassword={setPassword}
          editText={editText}
          setEditText={setEditText}
          pageOrder={pageOrder}
          setPageOrder={setPageOrder}
          numberPos={numberPos}
          setNumberPos={setNumberPos}
          targetLang={targetLang}
          setTargetLang={setTargetLang}
          htmlPaste={htmlPaste}
          setHtmlPaste={setHtmlPaste}
          sigCanvasRef={sigCanvasRef}
          drawing={drawing}
        />

        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canRun || busy}
            onClick={run}
          >
            {busy ? 'Working…' : tool.name}
          </button>
          {files.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => {
                setFiles([])
                setStatus(null)
                setPreview(null)
                setTextOut(null)
              }}
            >
              Clear
            </button>
          )}
        </div>

        {status && <div className={`status ${status.type}`}>{status.msg}</div>}
        {textOut && (
          <div className="preview-box">
            <div className="result-text">{textOut}</div>
          </div>
        )}
        {preview && (
          <div className="preview-box">
            <img src={preview} alt="Preview" />
          </div>
        )}
      </div>
    </div>
  )
}

function parsePages(input: string): number[] {
  const out = new Set<number>()
  for (const part of input.split(',')) {
    const p = part.trim()
    if (!p) continue
    if (p.includes('-')) {
      const [a, b] = p.split('-').map((x) => parseInt(x.trim(), 10))
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) out.add(i)
    } else {
      const n = parseInt(p, 10)
      if (Number.isFinite(n)) out.add(n)
    }
  }
  return [...out].sort((a, b) => a - b)
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function Options(props: {
  toolId: string
  pageRange: string
  setPageRange: (v: string) => void
  rotateAngle: 90 | 180 | 270
  setRotateAngle: (v: 90 | 180 | 270) => void
  watermark: string
  setWatermark: (v: string) => void
  cropMargin: number
  setCropMargin: (v: number) => void
  password: string
  setPassword: (v: string) => void
  editText: string
  setEditText: (v: string) => void
  pageOrder: string
  setPageOrder: (v: string) => void
  numberPos: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center'
  setNumberPos: (
    v: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center',
  ) => void
  targetLang: string
  setTargetLang: (v: string) => void
  htmlPaste: string
  setHtmlPaste: (v: string) => void
  sigCanvasRef: React.RefObject<HTMLCanvasElement | null>
  drawing: React.MutableRefObject<boolean>
}) {
  const id = props.toolId
  const show =
    [
      'remove-pages',
      'extract-pages',
      'organize-pdf',
      'rotate-pdf',
      'watermark',
      'crop-pdf',
      'page-numbers',
      'protect-pdf',
      'unlock-pdf',
      'edit-pdf',
      'sign-pdf',
      'translate-pdf',
      'html-to-pdf',
    ].includes(id)

  if (!show) return null

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = props.sigCanvasRef.current
    if (!canvas) return
    props.drawing.current = true
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    const pt = getPt(e, canvas)
    ctx.beginPath()
    ctx.moveTo(pt.x, pt.y)
  }
  const moveDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!props.drawing.current) return
    const canvas = props.sigCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const pt = getPt(e, canvas)
    ctx.lineTo(pt.x, pt.y)
    ctx.stroke()
  }
  const endDraw = () => {
    props.drawing.current = false
  }

  return (
    <div className="options-panel">
      {(id === 'remove-pages' || id === 'extract-pages') && (
        <label>
          Pages (e.g. 1,3,5-7)
          <input
            value={props.pageRange}
            onChange={(e) => props.setPageRange(e.target.value)}
            placeholder="1-2,5"
          />
        </label>
      )}
      {id === 'organize-pdf' && (
        <label>
          New page order (1-based, e.g. 3,1,2). Leave empty to reverse.
          <input
            value={props.pageOrder}
            onChange={(e) => props.setPageOrder(e.target.value)}
            placeholder="3,1,2"
          />
        </label>
      )}
      {id === 'rotate-pdf' && (
        <label>
          Angle
          <select
            value={props.rotateAngle}
            onChange={(e) =>
              props.setRotateAngle(Number(e.target.value) as 90 | 180 | 270)
            }
          >
            <option value={90}>90°</option>
            <option value={180}>180°</option>
            <option value={270}>270°</option>
          </select>
        </label>
      )}
      {id === 'watermark' && (
        <label>
          Watermark text
          <input
            value={props.watermark}
            onChange={(e) => props.setWatermark(e.target.value)}
          />
        </label>
      )}
      {id === 'crop-pdf' && (
        <label>
          Crop margin (points)
          <input
            type="number"
            min={0}
            value={props.cropMargin}
            onChange={(e) => props.setCropMargin(Number(e.target.value))}
          />
        </label>
      )}
      {id === 'page-numbers' && (
        <label>
          Position
          <select
            value={props.numberPos}
            onChange={(e) =>
              props.setNumberPos(
                e.target.value as typeof props.numberPos,
              )
            }
          >
            <option value="bottom-center">Bottom center</option>
            <option value="bottom-right">Bottom right</option>
            <option value="bottom-left">Bottom left</option>
            <option value="top-center">Top center</option>
          </select>
        </label>
      )}
      {(id === 'protect-pdf' || id === 'unlock-pdf') && (
        <label>
          Password
          <input
            type="password"
            value={props.password}
            onChange={(e) => props.setPassword(e.target.value)}
            placeholder={
              id === 'protect-pdf' ? 'Set password' : 'Current password (if any)'
            }
          />
        </label>
      )}
      {id === 'edit-pdf' && (
        <label>
          Text to add (first page)
          <input
            value={props.editText}
            onChange={(e) => props.setEditText(e.target.value)}
          />
        </label>
      )}
      {id === 'translate-pdf' && (
        <label>
          Target language
          <select
            value={props.targetLang}
            onChange={(e) => props.setTargetLang(e.target.value)}
          >
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="hi">Hindi</option>
            <option value="ar">Arabic</option>
            <option value="zh">Chinese</option>
          </select>
        </label>
      )}
      {id === 'html-to-pdf' && (
        <label>
          Or paste HTML
          <textarea
            rows={5}
            value={props.htmlPaste}
            onChange={(e) => props.setHtmlPaste(e.target.value)}
          />
        </label>
      )}
      {id === 'sign-pdf' && (
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: 8 }}>
            Draw your signature
          </div>
          <canvas
            ref={props.sigCanvasRef}
            className="signature-pad"
            width={480}
            height={160}
            onMouseDown={startDraw}
            onMouseMove={moveDraw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={moveDraw}
            onTouchEnd={endDraw}
          />
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                const c = props.sigCanvasRef.current
                if (!c) return
                const ctx = c.getContext('2d')!
                ctx.clearRect(0, 0, c.width, c.height)
              }}
            >
              Clear signature
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function getPt(
  e: React.MouseEvent | React.TouchEvent,
  canvas: HTMLCanvasElement,
) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  if ('touches' in e) {
    const t = e.touches[0]
    return {
      x: (t.clientX - rect.left) * scaleX,
      y: (t.clientY - rect.top) * scaleY,
    }
  }
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  }
}
