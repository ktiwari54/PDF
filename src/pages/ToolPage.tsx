import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  const [pageCount, setPageCount] = useState(0)
  const [thumbs, setThumbs] = useState<string[]>([])
  const [selectedPages, setSelectedPages] = useState<number[]>([])
  const [pageOrder, setPageOrder] = useState<number[]>([])

  const [pageRange, setPageRange] = useState('')
  const [rotateAngle, setRotateAngle] = useState<90 | 180 | 270>(90)
  const [watermark, setWatermark] = useState('CONFIDENTIAL')
  const [wmOpacity, setWmOpacity] = useState(0.5)
  const [wmPosition, setWmPosition] = useState<
    'center' | 'tile' | 'top' | 'bottom' | 'diagonal'
  >('diagonal')
  const [wmAngle, setWmAngle] = useState(45)
  const [wmImage, setWmImage] = useState<File | null>(null)
  const [rmWmKeyword, setRmWmKeyword] = useState('')
  const [rmWmMode, setRmWmMode] = useState<'text' | 'center-band' | 'both'>(
    'both',
  )
  const [cropMargin, setCropMargin] = useState(36)
  const [password, setPassword] = useState('')
  const [editText, setEditText] = useState('Annotated with PDF Tools')
  const [numberPos, setNumberPos] = useState<
    'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center'
  >('bottom-center')
  const [targetLang, setTargetLang] = useState('es')
  const [sourceLang, setSourceLang] = useState('auto')
  const [htmlPaste, setHtmlPaste] = useState(
    '<h1>Hello</h1><p>Paste HTML content here to convert to PDF.</p>',
  )
  const [compressQuality, setCompressQuality] = useState<
    'low' | 'medium' | 'high'
  >('medium')
  const [splitMode, setSplitMode] = useState<'all' | 'range'>('all')

  const accept = tool?.accept ?? 'application/pdf'
  const needsThumbs = [
    'remove-pages',
    'extract-pages',
    'organize-pdf',
    'rotate-pdf',
    'split-pdf',
  ].includes(tool?.id || '')

  const onFiles = useCallback(
    async (list: FileList | File[]) => {
      if (!tool) return
      const arr = Array.from(list)
      const next = tool.multiple ? arr : arr.slice(0, 1)
      setFiles(next)
      setStatus(null)
      setPreview(null)
      setTextOut(null)
      setThumbs([])
      setSelectedPages([])
      setPageOrder([])
      setPageCount(0)

      const first = next[0]
      if (
        first &&
        (first.type === 'application/pdf' ||
          first.name.toLowerCase().endsWith('.pdf'))
      ) {
        try {
          const count = await ops.getPageCount(first)
          setPageCount(count)
          setPageOrder(Array.from({ length: count }, (_, i) => i + 1))
          if (needsThumbs) {
            setStatus({ type: 'info', msg: 'Generating page previews…' })
            const t = await ops.renderAllThumbnails(first)
            setThumbs(t)
            setStatus(null)
          } else {
            const url = await ops.renderPreview(first, 0)
            setPreview(url)
          }
        } catch {
          /* ignore preview errors */
        }
      }
    },
    [tool, needsThumbs],
  )

  useEffect(() => {
    setFiles([])
    setThumbs([])
    setSelectedPages([])
    setStatus(null)
    setPreview(null)
    setTextOut(null)
  }, [toolId])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDrag(false)
    if (e.dataTransfer.files?.length) void onFiles(e.dataTransfer.files)
  }

  const canRun = useMemo(() => {
    if (!tool) return false
    if (tool.id === 'html-to-pdf' && htmlPaste.trim()) return true
    const min = tool.minFiles ?? 1
    return files.length >= min
  }, [tool, files, htmlPaste])

  function togglePage(p: number) {
    setSelectedPages((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p].sort((a, b) => a - b),
    )
  }

  function moveOrder(index: number, dir: -1 | 1) {
    setPageOrder((prev) => {
      const next = [...prev]
      const j = index + dir
      if (j < 0 || j >= next.length) return prev
      ;[next[index], next[j]] = [next[j], next[index]]
      return next
    })
  }

  function pagesForAction(): number[] {
    if (selectedPages.length) return selectedPages
    if (pageRange.trim() && pageCount) {
      return ops.parsePageSpec(pageRange, pageCount)
    }
    return []
  }

  async function run() {
    if (!tool) return
    setBusy(true)
    setStatus({ type: 'info', msg: 'Processing… please wait.' })
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
          const zip = await ops.splitPdf(
            f,
            splitMode,
            splitMode === 'range' ? pageRange || selectedPages.join(',') : undefined,
          )
          ops.downloadBlob(zip, `${ops.baseName(f.name)}_split.zip`)
          break
        }
        case 'remove-pages': {
          const pages = pagesForAction()
          const bytes = await ops.removePages(f, pages)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_removed.pdf`)
          break
        }
        case 'extract-pages': {
          const pages = pagesForAction()
          const bytes = await ops.extractPages(f, pages)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_extracted.pdf`)
          break
        }
        case 'organize-pdf': {
          const bytes = await ops.organizePages(f, pageOrder)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_organized.pdf`)
          break
        }
        case 'scan-to-pdf':
        case 'jpg-to-pdf': {
          const bytes = await ops.imagesToPdf(files, { pageSize: 'a4', margin: 24 })
          ops.downloadBytes(bytes, 'images.pdf')
          break
        }
        case 'compress-pdf': {
          const before = f.size
          const bytes = await ops.compressPdf(f, compressQuality)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_compressed.pdf`)
          setStatus({
            type: 'success',
            msg: `Done! ${formatSize(before)} → ${formatSize(bytes.length)}`,
          })
          setBusy(false)
          return
        }
        case 'repair-pdf': {
          const bytes = await ops.repairPdf(f)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_repaired.pdf`)
          break
        }
        case 'ocr-pdf': {
          const { text, pdf } = await ops.ocrToPdf(f, (msg) =>
            setStatus({ type: 'info', msg }),
          )
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
          ops.downloadBlob(blob, `${ops.baseName(f.name)}_slides.html`)
          break
        }
        case 'pdf-to-excel': {
          const blob = await ops.filesToExcel(files, {
            ocrMode: 'auto',
            onProgress: (msg) => setStatus({ type: 'info', msg }),
          })
          const name =
            files.length === 1
              ? `${ops.baseName(f.name)}.xlsx`
              : `dragonPDF_tables_${Date.now()}.xlsx`
          ops.downloadBlob(blob, name)
          break
        }
        case 'pdf-to-pdfa': {
          const bytes = await ops.toPdfA(f)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_pdfa.pdf`)
          break
        }
        case 'rotate-pdf': {
          const pages = pagesForAction()
          for (const file of files) {
            const bytes = await ops.rotatePdf(
              file,
              rotateAngle,
              pages.length ? pages : undefined,
            )
            ops.downloadBytes(bytes, `${ops.baseName(file.name)}_rotated.pdf`)
          }
          break
        }
        case 'page-numbers': {
          const bytes = await ops.addPageNumbers(f, {
            position: numberPos,
            format: '{n} / {total}',
          })
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_numbered.pdf`)
          break
        }
        case 'watermark': {
          if (!watermark.trim() && !wmImage) {
            throw new Error('Enter watermark text or choose an image.')
          }
          let imageBytes: Uint8Array | undefined
          let imageType: 'png' | 'jpg' | undefined
          if (wmImage) {
            imageBytes = new Uint8Array(await wmImage.arrayBuffer())
            imageType = wmImage.type.includes('png') ? 'png' : 'jpg'
          }
          const bytes = await ops.addWatermark(f, {
            text: watermark.trim() || 'WATERMARK',
            opacity: wmOpacity,
            position: wmPosition === 'center' ? 'diagonal' : wmPosition,
            angle: wmAngle,
            imageBytes,
            imageType,
          })
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_watermark.pdf`)
          // Live preview so user can confirm it worked
          try {
            const url = await ops.renderPreview(
              new File([bytes], 'wm.pdf', { type: 'application/pdf' }),
              0,
              1.2,
            )
            setPreview(url)
          } catch {
            /* preview optional */
          }
          setStatus({
            type: 'success',
            msg: 'Watermark applied — download started. Preview shows page 1 below.',
          })
          setBusy(false)
          return
        }
        case 'remove-watermark': {
          const { bytes, method } = await ops.removeWatermark(f, {
            keyword: rmWmKeyword,
            mode: rmWmMode,
          })
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_no_watermark.pdf`)
          setStatus({
            type: 'success',
            msg: `Done — ${method}. Download started.`,
          })
          setBusy(false)
          return
        }
        case 'crop-pdf': {
          const bytes = await ops.cropPdf(f, cropMargin)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_cropped.pdf`)
          break
        }
        case 'edit-pdf': {
          const bytes = await ops.editAddText(f, editText)
          ops.downloadBytes(bytes, `${ops.baseName(f.name)}_edited.pdf`)
          setPreview(
            await ops.renderPreview(
              new File([bytes], 'x.pdf', { type: 'application/pdf' }),
            ),
          )
          break
        }
        case 'pdf-forms': {
          const fields = await ops.listFormFields(f)
          setTextOut(
            fields.length
              ? `Existing form fields:\n${fields.join('\n')}`
              : 'No form fields found. Adding sample Name / Email / Agree fields…',
          )
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
          const bytes = await ops.protectPdf(f, password)
          const isLocked =
            bytes[0] === 'P'.charCodeAt(0) &&
            bytes[1] === 'D'.charCodeAt(0) &&
            bytes[2] === 'F'.charCodeAt(0) &&
            bytes[3] === 'T'.charCodeAt(0)
          ops.downloadBytes(
            bytes,
            isLocked
              ? `${ops.baseName(f.name)}.locked.pdf`
              : `${ops.baseName(f.name)}_protected.pdf`,
            isLocked ? 'application/octet-stream' : 'application/pdf',
          )
          break
        }
        case 'sign-pdf': {
          const canvas = sigCanvasRef.current
          if (!canvas) throw new Error('Signature pad missing')
          // ensure non-empty signature
          const ctx = canvas.getContext('2d')!
          const sample = ctx.getImageData(0, 0, canvas.width, canvas.height).data
          let painted = false
          for (let i = 3; i < sample.length; i += 4) {
            if (sample[i] > 0) {
              painted = true
              break
            }
          }
          if (!painted) throw new Error('Draw your signature first.')
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
          const a = await ops.renderPreview(files[0], 0, 1.2)
          const b = await ops.renderPreview(files[1], 0, 1.2)
          const imgA = await loadImg(a)
          const imgB = await loadImg(b)
          const c = document.createElement('canvas')
          c.width = imgA.width + imgB.width + 24
          c.height = Math.max(imgA.height, imgB.height) + 40
          const ctx = c.getContext('2d')!
          ctx.fillStyle = '#f3f4f6'
          ctx.fillRect(0, 0, c.width, c.height)
          ctx.fillStyle = '#111'
          ctx.font = 'bold 16px sans-serif'
          ctx.fillText(files[0].name, 8, 24)
          ctx.fillText(files[1].name, imgA.width + 32, 24)
          ctx.drawImage(imgA, 0, 36)
          ctx.drawImage(imgB, imgA.width + 24, 36)
          setPreview(c.toDataURL('image/jpeg', 0.9))
          setTextOut(
            `Compared page 1 of each file.\nA: ${files[0].name} (${formatSize(files[0].size)})\nB: ${files[1].name} (${formatSize(files[1].size)})`,
          )
          break
        }
        case 'ai-summarizer': {
          const text = await ops.extractText(f)
          const summary = ops.summarizeText(text)
          setTextOut(summary)
          const pdf = await ops.htmlStringToPdf(
            `<h1>Summary — ${ops.baseName(f.name)}</h1><p style="font-size:14px;line-height:1.6">${summary}</p>`,
          )
          ops.downloadBytes(pdf, `${ops.baseName(f.name)}_summary.pdf`)
          break
        }
        case 'translate-pdf': {
          setStatus({ type: 'info', msg: 'Extracting text from PDF…' })
          const text = await ops.extractText(f)
          if (!text.trim()) {
            throw new Error(
              'No extractable text. For scanned PDFs, run OCR PDF first, then Translate.',
            )
          }
          const translated = await ops.translateText(
            text,
            targetLang,
            sourceLang,
            (msg) => setStatus({ type: 'info', msg }),
          )
          setTextOut(translated)
          setStatus({ type: 'info', msg: 'Building translated PDF…' })
          const pdf = await ops.translationToPdf(
            `Translation — ${ops.baseName(f.name)}`,
            translated,
            targetLang,
          )
          const safeCode = targetLang.replace(/[^a-zA-Z0-9-]/g, '_')
          ops.downloadBytes(pdf, `${ops.baseName(f.name)}_${safeCode}.pdf`)
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
      setStatus({
        type: 'success',
        msg: 'Done! Your download should start automatically.',
      })
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
          <h2>
            {tool.accept.includes('image')
              ? 'Select image files'
              : 'Select PDF files'}
          </h2>
          <p>or drop {tool.multiple ? 'files' : 'a file'} here — processed in your browser</p>
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
            onChange={(e) => e.target.files && void onFiles(e.target.files)}
          />
        </div>

        {files.length > 0 && (
          <div className="file-list">
            {files.map((file, i) => (
              <div className="file-row" key={`${file.name}-${i}`}>
                <span className="name">{file.name}</span>
                <span className="size">
                  {formatSize(file.size)}
                  {i === 0 && pageCount > 0 ? ` · ${pageCount} pages` : ''}
                </span>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {thumbs.length > 0 && tool.id !== 'organize-pdf' && (
          <div className="thumb-grid">
            <div className="thumb-grid-head">
              <strong>Pages</strong>
              <span className="muted">Click to select · {selectedPages.length} selected</span>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                onClick={() =>
                  setSelectedPages(
                    selectedPages.length === pageCount
                      ? []
                      : Array.from({ length: pageCount }, (_, i) => i + 1),
                  )
                }
              >
                {selectedPages.length === pageCount ? 'Clear all' : 'Select all'}
              </button>
            </div>
            <div className="thumbs">
              {thumbs.map((src, i) => {
                const p = i + 1
                const on = selectedPages.includes(p)
                return (
                  <button
                    type="button"
                    key={p}
                    className={`thumb ${on ? 'selected' : ''}`}
                    onClick={() => togglePage(p)}
                  >
                    <img src={src} alt={`Page ${p}`} />
                    <span>{p}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {thumbs.length > 0 && tool.id === 'organize-pdf' && (
          <div className="thumb-grid">
            <div className="thumb-grid-head">
              <strong>Reorder pages</strong>
              <span className="muted">Use arrows to move pages</span>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                onClick={() =>
                  setPageOrder((o) => [...o].reverse())
                }
              >
                Reverse all
              </button>
            </div>
            <div className="thumbs">
              {pageOrder.map((pageNum, index) => (
                <div key={`${pageNum}-${index}`} className="thumb organize">
                  <img src={thumbs[pageNum - 1]} alt={`Page ${pageNum}`} />
                  <span>
                    #{index + 1} (was {pageNum})
                  </span>
                  <div className="thumb-actions">
                    <button type="button" onClick={() => moveOrder(index, -1)}>
                      ↑
                    </button>
                    <button type="button" onClick={() => moveOrder(index, 1)}>
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>
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
          wmOpacity={wmOpacity}
          setWmOpacity={setWmOpacity}
          wmPosition={wmPosition}
          setWmPosition={setWmPosition}
          wmAngle={wmAngle}
          setWmAngle={setWmAngle}
          wmImage={wmImage}
          setWmImage={setWmImage}
          rmWmKeyword={rmWmKeyword}
          setRmWmKeyword={setRmWmKeyword}
          rmWmMode={rmWmMode}
          setRmWmMode={setRmWmMode}
          cropMargin={cropMargin}
          setCropMargin={setCropMargin}
          password={password}
          setPassword={setPassword}
          editText={editText}
          setEditText={setEditText}
          numberPos={numberPos}
          setNumberPos={setNumberPos}
          targetLang={targetLang}
          setTargetLang={setTargetLang}
          sourceLang={sourceLang}
          setSourceLang={setSourceLang}
          htmlPaste={htmlPaste}
          setHtmlPaste={setHtmlPaste}
          compressQuality={compressQuality}
          setCompressQuality={setCompressQuality}
          splitMode={splitMode}
          setSplitMode={setSplitMode}
          sigCanvasRef={sigCanvasRef}
          drawing={drawing}
        />

        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canRun || busy}
            onClick={() => void run()}
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
                setThumbs([])
                setSelectedPages([])
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
        {preview && !thumbs.length && (
          <div className="preview-box">
            <img src={preview} alt="Preview" />
          </div>
        )}
        {preview && tool.id === 'compare-pdf' && (
          <div className="preview-box">
            <img src={preview} alt="Comparison" />
          </div>
        )}
      </div>
    </div>
  )
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
  wmOpacity: number
  setWmOpacity: (v: number) => void
  wmPosition: 'center' | 'tile' | 'top' | 'bottom' | 'diagonal'
  setWmPosition: (v: 'center' | 'tile' | 'top' | 'bottom' | 'diagonal') => void
  wmAngle: number
  setWmAngle: (v: number) => void
  wmImage: File | null
  setWmImage: (v: File | null) => void
  rmWmKeyword: string
  setRmWmKeyword: (v: string) => void
  rmWmMode: 'text' | 'center-band' | 'both'
  setRmWmMode: (v: 'text' | 'center-band' | 'both') => void
  cropMargin: number
  setCropMargin: (v: number) => void
  password: string
  setPassword: (v: string) => void
  editText: string
  setEditText: (v: string) => void
  numberPos: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center'
  setNumberPos: (
    v: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center',
  ) => void
  targetLang: string
  setTargetLang: (v: string) => void
  sourceLang: string
  setSourceLang: (v: string) => void
  htmlPaste: string
  setHtmlPaste: (v: string) => void
  compressQuality: 'low' | 'medium' | 'high'
  setCompressQuality: (v: 'low' | 'medium' | 'high') => void
  splitMode: 'all' | 'range'
  setSplitMode: (v: 'all' | 'range') => void
  sigCanvasRef: React.RefObject<HTMLCanvasElement | null>
  drawing: React.MutableRefObject<boolean>
}) {
  const id = props.toolId
  const show = [
    'remove-pages',
    'extract-pages',
    'split-pdf',
    'rotate-pdf',
    'watermark',
    'remove-watermark',
    'crop-pdf',
    'page-numbers',
    'protect-pdf',
    'unlock-pdf',
    'edit-pdf',
    'sign-pdf',
    'translate-pdf',
    'html-to-pdf',
    'compress-pdf',
  ].includes(id)

  if (!show) return null

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = props.sigCanvasRef.current
    if (!canvas) return
    props.drawing.current = true
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = '#111'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
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
          Pages (optional if you click thumbnails) — e.g. 1,3,5-7
          <input
            value={props.pageRange}
            onChange={(e) => props.setPageRange(e.target.value)}
            placeholder="1-2,5"
          />
        </label>
      )}
      {id === 'split-pdf' && (
        <>
          <label>
            Split mode
            <select
              value={props.splitMode}
              onChange={(e) =>
                props.setSplitMode(e.target.value as 'all' | 'range')
              }
            >
              <option value="all">Every page as separate PDF</option>
              <option value="range">Custom ranges (use ; between parts)</option>
            </select>
          </label>
          {props.splitMode === 'range' && (
            <label>
              Ranges — e.g. 1-3;4-6;7
              <input
                value={props.pageRange}
                onChange={(e) => props.setPageRange(e.target.value)}
                placeholder="1-2;3-5"
              />
            </label>
          )}
        </>
      )}
      {id === 'compress-pdf' && (
        <label>
          Compression quality
          <select
            value={props.compressQuality}
            onChange={(e) =>
              props.setCompressQuality(
                e.target.value as 'low' | 'medium' | 'high',
              )
            }
          >
            <option value="low">Low (smallest file)</option>
            <option value="medium">Medium (balanced)</option>
            <option value="high">High (best quality)</option>
          </select>
        </label>
      )}
      {id === 'rotate-pdf' && (
        <label>
          Angle (applies to selected pages, or all if none selected)
          <select
            value={props.rotateAngle}
            onChange={(e) =>
              props.setRotateAngle(Number(e.target.value) as 90 | 180 | 270)
            }
          >
            <option value={90}>90° clockwise</option>
            <option value={180}>180°</option>
            <option value={270}>270° clockwise</option>
          </select>
        </label>
      )}
      {id === 'watermark' && (
        <>
          <label>
            Watermark text
            <input
              value={props.watermark}
              onChange={(e) => props.setWatermark(e.target.value)}
              placeholder="CONFIDENTIAL"
            />
          </label>
          <label>
            Or image watermark (PNG / JPG)
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              onChange={(e) =>
                props.setWmImage(e.target.files?.[0] ?? null)
              }
            />
          </label>
          {props.wmImage && (
            <p className="muted" style={{ margin: 0 }}>
              Image: {props.wmImage.name}
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginLeft: 8, padding: '0.2rem 0.5rem' }}
                onClick={() => props.setWmImage(null)}
              >
                Clear image
              </button>
            </p>
          )}
          <label>
            Position
            <select
              value={props.wmPosition}
              onChange={(e) =>
                props.setWmPosition(
                  e.target.value as
                    | 'center'
                    | 'tile'
                    | 'top'
                    | 'bottom'
                    | 'diagonal',
                )
              }
            >
              <option value="diagonal">Center diagonal</option>
              <option value="center">Center</option>
              <option value="tile">Tile across page</option>
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
            </select>
          </label>
          <label>
            Opacity {Math.round(props.wmOpacity * 100)}%
            <input
              type="range"
              min={0.15}
              max={0.9}
              step={0.05}
              value={props.wmOpacity}
              onChange={(e) => props.setWmOpacity(Number(e.target.value))}
            />
          </label>
          <label>
            Angle {props.wmAngle}°
            <input
              type="range"
              min={-90}
              max={90}
              step={5}
              value={props.wmAngle}
              onChange={(e) => props.setWmAngle(Number(e.target.value))}
            />
          </label>
          <p className="muted" style={{ margin: 0 }}>
            Tip: use opacity ~50% and angle 45° for a classic stamp. Download +
            page preview appear after you run the tool.
          </p>
        </>
      )}
      {id === 'remove-watermark' && (
        <>
          <label>
            Watermark text to remove (optional)
            <input
              value={props.rmWmKeyword}
              onChange={(e) => props.setRmWmKeyword(e.target.value)}
              placeholder="e.g. CONFIDENTIAL, DRAFT, SAMPLE"
            />
          </label>
          <label>
            Removal mode
            <select
              value={props.rmWmMode}
              onChange={(e) =>
                props.setRmWmMode(
                  e.target.value as 'text' | 'center-band' | 'both',
                )
              }
            >
              <option value="both">
                Auto (match text, else center band)
              </option>
              <option value="text">Text match only</option>
              <option value="center-band">
                Center band cover (image / faint marks)
              </option>
            </select>
          </label>
          <p className="muted" style={{ margin: 0 }}>
            Text watermarks are covered by matching words. For image watermarks
            use Center band, or whiteout in Live Editor.
          </p>
        </>
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
              props.setNumberPos(e.target.value as typeof props.numberPos)
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
              id === 'protect-pdf'
                ? 'Set password'
                : 'Password (if encrypted)'
            }
          />
        </label>
      )}
      {id === 'edit-pdf' && (
        <label>
          Text to add on first page
          <input
            value={props.editText}
            onChange={(e) => props.setEditText(e.target.value)}
          />
        </label>
      )}
      {id === 'translate-pdf' && (
        <>
          <label>
            Source language
            <select
              value={props.sourceLang}
              onChange={(e) => props.setSourceLang(e.target.value)}
            >
              <option value="auto">Auto-detect</option>
              {ops.TRANSLATE_LANGUAGES.map((l) => (
                <option key={`src-${l.code}`} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Target language (all supported)
            <select
              value={props.targetLang}
              onChange={(e) => props.setTargetLang(e.target.value)}
            >
              {ops.TRANSLATE_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
          </label>
          <p className="muted" style={{ margin: 0 }}>
            Works online. Scanned PDFs need OCR first. Long documents are
            translated in chunks.
          </p>
        </>
      )}
      {id === 'html-to-pdf' && (
        <label>
          Or paste HTML (no file required)
          <textarea
            rows={6}
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
                c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
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
