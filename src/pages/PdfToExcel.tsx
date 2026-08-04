import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Download,
  FileSpreadsheet,
  Image as ImageIcon,
  FileText,
  Upload,
  Trash2,
  Table2,
} from 'lucide-react'
import {
  filesToExcel,
  baseName,
  downloadBlob,
  renderPreview,
} from '../lib/pdfOps'

const OCR_LANGS = [
  { code: 'eng', name: 'English' },
  { code: 'ara', name: 'Arabic' },
  { code: 'hin', name: 'Hindi' },
  { code: 'fra', name: 'French' },
  { code: 'deu', name: 'German' },
  { code: 'spa', name: 'Spanish' },
  { code: 'chi_sim', name: 'Chinese (Simplified)' },
  { code: 'por', name: 'Portuguese' },
  { code: 'rus', name: 'Russian' },
  { code: 'jpn', name: 'Japanese' },
]

const ACCEPT =
  'application/pdf,image/png,image/jpeg,image/jpg,image/webp,image/gif,image/bmp,image/tiff,.pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff'

function formatSize(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function isPdf(f: File) {
  return (
    f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
  )
}

function isImage(f: File) {
  return (
    f.type.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(f.name)
  )
}

export function PdfToExcel() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocrMode, setOcrMode] = useState<'auto' | 'always' | 'never'>('auto')
  const [ocrLang, setOcrLang] = useState('eng')

  const addFiles = useCallback(async (list: FileList | File[]) => {
    const arr = Array.from(list).filter((f) => isPdf(f) || isImage(f))
    if (!arr.length) {
      setError('Please add PDF or image files (PNG, JPG, WebP…).')
      return
    }
    setError(null)
    setStatus(null)
    setFiles((prev) => {
      const names = new Set(prev.map((p) => `${p.name}-${p.size}`))
      const extra = arr.filter((f) => !names.has(`${f.name}-${f.size}`))
      return [...prev, ...extra]
    })
    for (const f of arr) {
      const key = `${f.name}-${f.size}`
      try {
        if (isImage(f)) {
          const url = URL.createObjectURL(f)
          setPreviews((p) => ({ ...p, [key]: url }))
        } else {
          const url = await renderPreview(f, 0, 1)
          setPreviews((p) => ({ ...p, [key]: url }))
        }
      } catch {
        /* preview optional */
      }
    }
  }, [])

  function removeFile(idx: number) {
    setFiles((prev) => {
      const f = prev[idx]
      if (f) {
        const key = `${f.name}-${f.size}`
        const url = previews[key]
        if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
      }
      return prev.filter((_, i) => i !== idx)
    })
  }

  function clearAll() {
    Object.values(previews).forEach((u) => {
      if (u.startsWith('blob:')) URL.revokeObjectURL(u)
    })
    setFiles([])
    setPreviews({})
    setStatus(null)
    setError(null)
  }

  async function convert() {
    if (!files.length) return
    setBusy(true)
    setError(null)
    setStatus('Starting conversion…')
    try {
      const blob = await filesToExcel(files, {
        ocrMode,
        ocrLang,
        onProgress: setStatus,
      })
      const name =
        files.length === 1
          ? `${baseName(files[0].name)}.xlsx`
          : `dragonPDF_tables_${Date.now()}.xlsx`
      downloadBlob(blob, name)
      setStatus(`Done — downloaded ${name}`)
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Conversion failed')
      setStatus(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <Link to="/" className="back-link">
        <ArrowLeft size={16} /> All tools
      </Link>

      <div className="tool-page-header">
        <div className="tool-icon" style={{ background: '#34d399' }}>
          <FileSpreadsheet size={26} color="#052e16" />
        </div>
        <div>
          <h1>PDF / Image to Excel</h1>
          <p>
            Extract tables and text from PDFs or photos into an{' '}
            <strong>.xlsx</strong> spreadsheet. Digital PDFs use layout
            detection; scans and images use OCR — all in your browser.
          </p>
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
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            if (e.dataTransfer.files?.length) void addFiles(e.dataTransfer.files)
          }}
          onClick={() => inputRef.current?.click()}
        >
          <div style={{ fontSize: '2rem' }}>📊</div>
          <h2>Drop PDF or image files</h2>
          <p>Invoices, tables, statements, screenshots — one or many</p>
          <div style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={(e) => {
                e.stopPropagation()
                inputRef.current?.click()
              }}
            >
              <Upload size={16} /> Select files
            </button>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) void addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {files.length > 0 && (
          <div className="pxe-file-grid">
            {files.map((f, i) => {
              const key = `${f.name}-${f.size}`
              const thumb = previews[key]
              return (
                <div className="pxe-file-card" key={key}>
                  <div className="pxe-thumb">
                    {thumb ? (
                      <img src={thumb} alt="" />
                    ) : isPdf(f) ? (
                      <FileText size={28} />
                    ) : (
                      <ImageIcon size={28} />
                    )}
                  </div>
                  <div className="pxe-meta">
                    <strong title={f.name}>{f.name}</strong>
                    <span className="muted">
                      {isPdf(f) ? 'PDF' : 'Image'} · {formatSize(f.size)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ padding: '0.3rem 0.5rem' }}
                    onClick={() => removeFile(i)}
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div className="pxe-options">
          <label>
            OCR mode
            <select
              value={ocrMode}
              onChange={(e) =>
                setOcrMode(e.target.value as 'auto' | 'always' | 'never')
              }
              disabled={busy}
            >
              <option value="auto">
                Auto (OCR scans / sparse pages)
              </option>
              <option value="always">Always OCR (best for photos)</option>
              <option value="never">Never OCR (text PDFs only)</option>
            </select>
          </label>
          <label>
            OCR language
            <select
              value={ocrLang}
              onChange={(e) => setOcrLang(e.target.value)}
              disabled={busy || ocrMode === 'never'}
            >
              {OCR_LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="bulk-keep-note">
          <strong>
            <Table2 size={14} style={{ verticalAlign: -2 }} /> How it works
          </strong>
          <span>
            Text PDFs: words are clustered into rows and columns by position.
            Images & scans: Tesseract OCR rebuilds a grid from word boxes. Each
            PDF page becomes a sheet; each image is its own sheet.
          </span>
        </div>

        <div className="actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!files.length || busy}
            onClick={() => void convert()}
          >
            <Download size={16} />
            {busy ? 'Converting…' : 'Convert to Excel'}
          </button>
          {files.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={clearAll}
            >
              Clear
            </button>
          )}
        </div>

        {status && <div className="status success">{status}</div>}
        {error && <div className="status error">{error}</div>}
      </div>
    </div>
  )
}
