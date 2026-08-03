import { useCallback, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  FolderOpen,
  FileUp,
  ShieldAlert,
  Play,
  Square,
  Download,
  HardDrive,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react'
import {
  MASK_CATEGORY_META,
  defaultMaskOptions,
  maskSensitivePdf,
  mapPool,
  pickInputDirectory,
  pickOutputDirectory,
  listPdfsInDirectory,
  readFileHandle,
  supportsDirectoryPicker,
  buildReportCsv,
  countByCategory,
  writeMaskedFile,
  type MaskOptions,
  type MaskCategory,
  type FileJobResult,
  type DirHandle,
} from '../lib/sensitiveMask'
import { downloadBlob, downloadBytes } from '../lib/pdfOps'
import JSZip from 'jszip'

type QueuedFile = {
  id: string
  name: string
  path: string
  /** Browser File (from multi-select) */
  file?: File
  /** FS handle (from folder) */
  handle?: FileSystemFileHandle
}

const MAX_FILES = 10000

export function BulkMask() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [options, setOptions] = useState<MaskOptions>(defaultMaskOptions)
  /** Folder the user loaded PDFs from */
  const [sourceDir, setSourceDir] = useState<DirHandle | null>(null)
  const [sourceDirName, setSourceDirName] = useState('')
  /** Optional separate destination folder */
  const [outputDir, setOutputDir] = useState<DirHandle | null>(null)
  const [outputDirName, setOutputDirName] = useState('')
  const [concurrency, setConcurrency] = useState(2)
  /**
   * same = write into the source folder
   * custom = user-picked folder (any drive)
   * zip / individual = browser download
   */
  const [saveMode, setSaveMode] = useState<
    'same' | 'custom' | 'zip' | 'individual'
  >(supportsDirectoryPicker() ? 'same' : 'zip')
  /** Put results in a "masked" subfolder (safer) vs next to originals */
  const [useMaskedSubfolder, setUseMaskedSubfolder] = useState(true)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(0)
  const [results, setResults] = useState<FileJobResult[]>([])
  const [log, setLog] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cancelRef = useRef(false)

  const enabledCount = useMemo(
    () => Object.values(options.categories || {}).filter(Boolean).length,
    [options],
  )

  const toggleCategory = (id: MaskCategory) => {
    setOptions((o) => ({
      ...o,
      categories: { ...o.categories, [id]: !o.categories?.[id] },
    }))
  }

  const addFiles = useCallback((list: FileList | File[]) => {
    const arr = Array.from(list).filter((f) => /\.pdf$/i.test(f.name))
    setQueue((prev) => {
      const next = [...prev]
      for (const f of arr) {
        if (next.length >= MAX_FILES) break
        next.push({
          id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
          name: f.name,
          path: f.name,
          file: f,
        })
      }
      return next.slice(0, MAX_FILES)
    })
    // Multi-file pick has no folder handle — can't "save same"
    setSourceDir(null)
    setSourceDirName('')
    setResults([])
    setDone(0)
    setError(null)
    setSaveMode((m) => (m === 'same' ? 'custom' : m))
  }, [])

  async function selectFolder() {
    setError(null)
    const dir = await pickInputDirectory('readwrite')
    if (!dir) {
      setError(
        'Folder picker cancelled or not supported. Use Chrome/Edge, or select multiple PDF files instead.',
      )
      return
    }
    setLog('Scanning folder for PDFs (including subfolders)…')
    const list = await listPdfsInDirectory(dir, MAX_FILES)
    if (!list.length) {
      setError('No PDF files found in that folder.')
      setLog(null)
      return
    }
    setSourceDir(dir)
    setSourceDirName(dir.name)
    setSaveMode('same')
    setQueue(
      list.map((item) => ({
        id: `${item.path}-${Math.random().toString(36).slice(2, 7)}`,
        name: item.name,
        path: item.path,
        handle: item.handle,
      })),
    )
    setLog(
      `Loaded ${list.length} PDF(s) from “${dir.name}”. You can save masked files into this same folder or pick another.`,
    )
    setResults([])
    setDone(0)
  }

  async function selectOutputFolder() {
    const dir = await pickOutputDirectory()
    if (!dir) return
    setOutputDir(dir)
    setOutputDirName(dir.name)
    setSaveMode('custom')
  }

  function resolveSaveDir(): DirHandle | null {
    if (saveMode === 'same') return sourceDir
    if (saveMode === 'custom') return outputDir
    return null
  }

  async function run() {
    if (!queue.length) {
      setError('Add at least one PDF (or a folder of PDFs).')
      return
    }
    const anyOn = Object.values(options.categories || {}).some(Boolean)
    if (!anyOn) {
      setError('Enable at least one data type to mask.')
      return
    }
    if (options.categories?.lastName && !options.lastNames?.trim()) {
      setError('Last name masking is on — paste last names to mask (one per line).')
      return
    }
    if (saveMode === 'same' && !sourceDir) {
      setError(
        '“Same as source folder” needs a folder pick (not individual files). Select a folder, or choose another save location.',
      )
      return
    }
    if (saveMode === 'custom' && !outputDir) {
      setError('Choose a destination folder (any drive your browser can access).')
      return
    }

    cancelRef.current = false
    setRunning(true)
    setDone(0)
    setResults([])
    setError(null)
    setLog(`Processing ${queue.length} file(s)…`)

    const zip = saveMode === 'zip' ? new JSZip() : null
    const saveDir = resolveSaveDir()
    const jobResults: FileJobResult[] = []
    let lastSavedPath = ''

    try {
      await mapPool(
        queue,
        concurrency,
        async (item) => {
          if (cancelRef.current) {
            const r: FileJobResult = {
              name: item.path,
              ok: false,
              hitCount: 0,
              error: 'Cancelled',
            }
            jobResults.push(r)
            return r
          }
          try {
            let data: Uint8Array
            if (item.handle) {
              data = await readFileHandle(item.handle)
            } else if (item.file) {
              data = new Uint8Array(await item.file.arrayBuffer())
            } else {
              throw new Error('No file data')
            }

            const result = await maskSensitivePdf(data, {
              ...options,
              onProgress: (msg) => setLog(`${item.path}: ${msg}`),
            })
            const cats = countByCategory(result.hits)
            const base =
              item.name.replace(/\.pdf$/i, '') + '_masked.pdf'

            if ((saveMode === 'same' || saveMode === 'custom') && saveDir) {
              lastSavedPath = await writeMaskedFile(saveDir, item.path, result.bytes, {
                subfolder: useMaskedSubfolder ? 'masked' : '',
                suffix: '_masked',
              })
            } else if (saveMode === 'zip' && zip) {
              const zipPath = `masked/${item.path.replace(/\.pdf$/i, '')}_masked.pdf`
              zip.file(zipPath, result.bytes)
            } else if (saveMode === 'individual') {
              downloadBytes(result.bytes, base)
            }

            const r: FileJobResult = {
              name: item.path,
              ok: true,
              hitCount: result.hitCount,
              categories: cats,
            }
            jobResults.push(r)
            return r
          } catch (e) {
            const r: FileJobResult = {
              name: item.path,
              ok: false,
              hitCount: 0,
              error: e instanceof Error ? e.message : 'Failed',
            }
            jobResults.push(r)
            return r
          }
        },
        (d, t) => {
          setDone(d)
          setLog(
            lastSavedPath
              ? `Processed ${d} / ${t}… last saved: ${lastSavedPath}`
              : `Processed ${d} / ${t}…`,
          )
          setResults([...jobResults])
        },
        () => cancelRef.current,
      )

      if (saveMode === 'zip' && zip && !cancelRef.current) {
        setLog('Building ZIP archive…')
        const blob = await zip.generateAsync({ type: 'blob' })
        downloadBlob(blob, `dragonPDF_masked_${Date.now()}.zip`)
      }

      // Report CSV → same save destination when folder mode
      const report = buildReportCsv(jobResults)
      const reportName = `mask_report_${Date.now()}.csv`
      if (
        (saveMode === 'same' || saveMode === 'custom') &&
        saveDir &&
        !cancelRef.current
      ) {
        try {
          const reportDir = useMaskedSubfolder
            ? await saveDir.getDirectoryHandle('masked', { create: true })
            : saveDir
          const fh = await reportDir.getFileHandle(reportName, {
            create: true,
          })
          const w = await fh.createWritable()
          await w.write(report)
          await w.close()
        } catch {
          downloadBlob(
            new Blob([report], { type: 'text/csv' }),
            reportName,
          )
        }
      } else if (!cancelRef.current) {
        downloadBlob(new Blob([report], { type: 'text/csv' }), reportName)
      }

      const ok = jobResults.filter((r) => r.ok).length
      const hits = jobResults.reduce((n, r) => n + r.hitCount, 0)
      setResults([...jobResults])
      const where =
        saveMode === 'same'
          ? `saved into source folder “${sourceDirName}”${useMaskedSubfolder ? '/masked' : ''}`
          : saveMode === 'custom'
            ? `saved into “${outputDirName}”${useMaskedSubfolder ? '/masked' : ''}`
            : saveMode === 'zip'
              ? 'ZIP downloaded'
              : 'files downloaded'
      setLog(
        cancelRef.current
          ? `Cancelled after ${done} file(s).`
          : `Finished · ${ok}/${jobResults.length} OK · ${hits} redactions · ${where} · CSV report written`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Batch failed')
    } finally {
      setRunning(false)
    }
  }

  const fsOk = supportsDirectoryPicker()

  return (
    <div className="page bulk-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={16} /> All tools
      </Link>

      <div className="tool-page-header">
        <div className="tool-icon" style={{ background: '#38bdf8' }}>
          <ShieldAlert size={26} color="#fff" />
        </div>
        <div>
          <h1>Bulk PDF Masker</h1>
          <p>
            Redact emails, phones, addresses, amounts, SSN/IDs, VAT, GST, trade
            licenses, and last names — including <strong>scanned / image PDFs</strong>{' '}
            via OCR. One file or up to{' '}
            <strong>{MAX_FILES.toLocaleString()}</strong> from a folder. All
            local.
          </p>
        </div>
      </div>

      <div className="bulk-grid">
        {/* Left: input + options */}
        <section className="workspace bulk-panel">
          <h2 className="bulk-section-title">1. Select PDFs</h2>
          <div className="bulk-pick-row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={running}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp size={16} /> Select PDF files
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={running || !fsOk}
              onClick={() => void selectFolder()}
              title={
                fsOk
                  ? 'Pick a folder (includes subfolders)'
                  : 'Use Chrome or Edge for folder pick'
              }
            >
              <FolderOpen size={16} /> Select folder
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) addFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </div>
          {!fsOk && (
            <p className="muted" style={{ margin: 0 }}>
              Tip: Chrome or Edge can pick entire folders and save to any drive.
              Other browsers: multi-select files + ZIP download.
            </p>
          )}

          <div className="bulk-queue">
            <div className="bulk-queue-head">
              <strong>
                Queue: {queue.length.toLocaleString()} / {MAX_FILES.toLocaleString()}
              </strong>
              {queue.length > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                  disabled={running}
                  onClick={() => {
                    setQueue([])
                    setResults([])
                    setDone(0)
                    setSourceDir(null)
                    setSourceDirName('')
                  }}
                >
                  Clear
                </button>
              )}
            </div>
            {queue.length === 0 ? (
              <p className="muted">No files yet — select PDFs or a folder.</p>
            ) : (
              <ul className="bulk-file-list">
                {queue.slice(0, 50).map((f) => (
                  <li key={f.id}>
                    <span title={f.path}>{f.path}</span>
                  </li>
                ))}
                {queue.length > 50 && (
                  <li className="muted">
                    …and {(queue.length - 50).toLocaleString()} more
                  </li>
                )}
              </ul>
            )}
          </div>

          <h2 className="bulk-section-title">2. What to mask</h2>
          <div className="bulk-cats">
            {MASK_CATEGORY_META.map((c) => (
              <label key={c.id} className="bulk-cat">
                <input
                  type="checkbox"
                  checked={!!options.categories?.[c.id]}
                  onChange={() => toggleCategory(c.id)}
                  disabled={running}
                />
                <span>
                  <strong>{c.label}</strong>
                  <small>{c.description}</small>
                </span>
              </label>
            ))}
          </div>

          {options.categories?.companyName && (
            <label className="bulk-field">
              Extra company names to always mask (optional — one per line)
              <textarea
                rows={3}
                value={options.companyNames || ''}
                disabled={running}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, companyNames: e.target.value }))
                }
                placeholder={
                  'Acme Trading LLC\nGulf Star Enterprises\nSunrise Pvt Ltd'
                }
              />
            </label>
          )}

          {options.categories?.lastName && (
            <label className="bulk-field">
              Last names to mask (one per line or comma-separated)
              <textarea
                rows={4}
                value={options.lastNames || ''}
                disabled={running}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, lastNames: e.target.value }))
                }
                placeholder={'Smith\nPatel\nAl-Mansoori\nGarcía'}
              />
            </label>
          )}

          {options.categories?.custom && (
            <label className="bulk-field">
              Custom regex (one per line)
              <textarea
                rows={3}
                value={options.customPatterns || ''}
                disabled={running}
                onChange={(e) =>
                  setOptions((o) => ({
                    ...o,
                    customPatterns: e.target.value,
                  }))
                }
                placeholder={'INV-\\d{6}\n/secret[a-z]+/gi'}
              />
            </label>
          )}

          <div className="bulk-controls">
            <label>
              Mask style
              <select
                value={options.style || 'asterisk'}
                disabled={running}
                onChange={(e) =>
                  setOptions((o) => ({
                    ...o,
                    style: e.target.value as MaskOptions['style'],
                  }))
                }
              >
                <option value="asterisk">
                  Clean asterisks (****) — professional uniform mask
                </option>
                <option value="blur">Soft blur / mosaic</option>
                <option value="black">Black redaction bars</option>
                <option value="white">Whiteout only</option>
              </select>
            </label>
            <label>
              Parallel jobs
              <select
                value={concurrency}
                disabled={running}
                onChange={(e) => setConcurrency(Number(e.target.value))}
              >
                <option value={1}>1 (safest for OCR)</option>
                <option value={2}>2 (recommended)</option>
                <option value={3}>3</option>
                <option value={4}>4 (fast / heavy)</option>
              </select>
            </label>
          </div>

          <h2 className="bulk-section-title">Scanned / image PDFs (OCR)</h2>
          <div className="bulk-controls">
            <label>
              OCR mode
              <select
                value={options.ocrMode || 'auto'}
                disabled={running}
                onChange={(e) =>
                  setOptions((o) => ({
                    ...o,
                    ocrMode: e.target.value as MaskOptions['ocrMode'],
                  }))
                }
              >
                <option value="auto">
                  Auto — OCR only pages with little text (recommended)
                </option>
                <option value="always">
                  Always OCR every page (slow, best for full scans)
                </option>
                <option value="never">Never OCR (digital text only)</option>
              </select>
            </label>
            <label>
              OCR language
              <select
                value={options.ocrLang || 'eng'}
                disabled={running || options.ocrMode === 'never'}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, ocrLang: e.target.value }))
                }
              >
                <option value="eng">English</option>
                <option value="eng+ara">English + Arabic</option>
                <option value="eng+hin">English + Hindi</option>
                <option value="eng+fra">English + French</option>
                <option value="eng+deu">English + German</option>
                <option value="eng+spa">English + Spanish</option>
                <option value="ara">Arabic</option>
                <option value="hin">Hindi</option>
              </select>
            </label>
          </div>
          <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
            Default mask uses <strong>asterisks</strong> (e.g. phone 555-1234 →
            ***-****). Blur uses a soft mosaic. Scanned PDFs use OCR first; the
            first run may download language data.
          </p>

          <h2 className="bulk-section-title">3. Where to save</h2>
          <div className="bulk-save-options">
            {fsOk && (
              <label className={`bulk-save-card ${saveMode === 'same' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="saveMode"
                  checked={saveMode === 'same'}
                  disabled={running || !sourceDir}
                  onChange={() => setSaveMode('same')}
                />
                <span>
                  <strong>Same as source folder</strong>
                  <small>
                    {sourceDirName
                      ? `Write into “${sourceDirName}” (the folder you loaded)`
                      : 'Select a source folder first (not multi-file pick)'}
                  </small>
                </span>
              </label>
            )}
            {fsOk && (
              <label className={`bulk-save-card ${saveMode === 'custom' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="saveMode"
                  checked={saveMode === 'custom'}
                  disabled={running}
                  onChange={() => setSaveMode('custom')}
                />
                <span>
                  <strong>Choose a different folder</strong>
                  <small>
                    Any local disk, USB, or network drive the browser can access
                  </small>
                </span>
              </label>
            )}
            <label className={`bulk-save-card ${saveMode === 'zip' ? 'active' : ''}`}>
              <input
                type="radio"
                name="saveMode"
                checked={saveMode === 'zip'}
                disabled={running}
                onChange={() => setSaveMode('zip')}
              />
              <span>
                <strong>Download ZIP</strong>
                <small>One archive to your Downloads folder</small>
              </span>
            </label>
            <label className={`bulk-save-card ${saveMode === 'individual' ? 'active' : ''}`}>
              <input
                type="radio"
                name="saveMode"
                checked={saveMode === 'individual'}
                disabled={running}
                onChange={() => setSaveMode('individual')}
              />
              <span>
                <strong>Download each file</strong>
                <small>Only for small batches (browser will prompt many times)</small>
              </span>
            </label>
          </div>

          {saveMode === 'custom' && (
            <div className="bulk-pick-row">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={running || !fsOk}
                onClick={() => void selectOutputFolder()}
              >
                <HardDrive size={16} />{' '}
                {outputDirName
                  ? `Destination: ${outputDirName}`
                  : 'Browse destination folder…'}
              </button>
            </div>
          )}

          {(saveMode === 'same' || saveMode === 'custom') && (
            <label className="bulk-cat" style={{ marginTop: 4 }}>
              <input
                type="checkbox"
                checked={useMaskedSubfolder}
                disabled={running}
                onChange={(e) => setUseMaskedSubfolder(e.target.checked)}
              />
              <span>
                <strong>Save inside a “masked” subfolder</strong>
                <small>
                  {useMaskedSubfolder
                    ? 'Safer — originals stay untouched (e.g. MyFolder/masked/invoice_masked.pdf)'
                    : 'Write next to originals (e.g. MyFolder/invoice_masked.pdf)'}
                </small>
              </span>
            </label>
          )}

          <p className="muted" style={{ margin: 0, fontSize: '0.8rem' }}>
            {saveMode === 'same' && sourceDirName && (
              <>
                Output → <code>{sourceDirName}{useMaskedSubfolder ? '/masked/' : '/'}</code>
                *_masked.pdf · CSV report included
              </>
            )}
            {saveMode === 'custom' && (
              <>
                {outputDirName
                  ? <>Output → <code>{outputDirName}{useMaskedSubfolder ? '/masked/' : '/'}</code></>
                  : 'Pick a destination folder above (Desktop, D:\\, USB, etc.)'}
              </>
            )}
            {(saveMode === 'zip' || saveMode === 'individual') && (
              <>Files go to your browser Downloads.</>
            )}
          </p>

          <div className="actions">
            {!running ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!queue.length}
                onClick={() => void run()}
              >
                <Play size={16} /> Start masking {queue.length || ''}{' '}
                {queue.length === 1 ? 'PDF' : 'PDFs'}
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  cancelRef.current = true
                  setLog('Cancelling after current files…')
                }}
              >
                <Square size={16} /> Cancel
              </button>
            )}
          </div>

          {running && (
            <div className="bulk-progress">
              <div className="bulk-progress-bar">
                <div
                  style={{
                    width: `${queue.length ? (done / queue.length) * 100 : 0}%`,
                  }}
                />
              </div>
              <span>
                <Loader2 size={14} className="spin" /> {done} / {queue.length}
              </span>
            </div>
          )}

          {log && <div className="status success">{log}</div>}
          {error && <div className="status error">{error}</div>}
        </section>

        {/* Right: results */}
        <aside className="workspace bulk-results">
          <h2 className="bulk-section-title">Results</h2>
          {results.length === 0 ? (
            <div className="ppt-empty">
              <ShieldAlert size={36} strokeWidth={1.25} />
              <p>
                Progress and per-file hit counts appear here. Enabled categories:{' '}
                <strong>{enabledCount || '—'}</strong>
              </p>
            </div>
          ) : (
            <>
              <div className="bulk-stats">
                <div>
                  <strong>{results.filter((r) => r.ok).length}</strong>
                  <span>OK</span>
                </div>
                <div>
                  <strong>{results.filter((r) => !r.ok).length}</strong>
                  <span>Errors</span>
                </div>
                <div>
                  <strong>
                    {results.reduce((n, r) => n + r.hitCount, 0)}
                  </strong>
                  <span>Redactions</span>
                </div>
              </div>
              <ul className="bulk-result-list">
                {results.slice(-100).map((r, i) => (
                  <li key={`${r.name}-${i}`} className={r.ok ? 'ok' : 'err'}>
                    {r.ok ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <XCircle size={14} />
                    )}
                    <div>
                      <div className="name" title={r.name}>
                        {r.name}
                      </div>
                      <div className="meta">
                        {r.ok
                          ? `${r.hitCount} hit(s)`
                          : r.error || 'Failed'}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
              {results.length > 100 && (
                <p className="muted">Showing last 100 of {results.length}</p>
              )}
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: '100%', marginTop: 8 }}
                onClick={() =>
                  downloadBlob(
                    new Blob([buildReportCsv(results)], {
                      type: 'text/csv',
                    }),
                    `mask_report_${Date.now()}.csv`,
                  )
                }
              >
                <Download size={14} /> Download report CSV
              </button>
            </>
          )}
        </aside>
      </div>
    </div>
  )
}
