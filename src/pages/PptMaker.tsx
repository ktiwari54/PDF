import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Presentation,
  Sparkles,
  Download,
  Wand2,
  ArrowLeft,
  LayoutTemplate,
} from 'lucide-react'
import {
  PPT_THEMES,
  outlineFromPrompt,
  enhanceOutlineWithXai,
  buildPptx,
  type DeckOutline,
  type PptThemeId,
} from '../lib/pptMaker'
import { downloadBlob, baseName } from '../lib/pdfOps'

const TONES = [
  { id: 'professional', label: 'Professional' },
  { id: 'pitch', label: 'Pitch / Investor' },
  { id: 'training', label: 'Training' },
  { id: 'report', label: 'Report / Briefing' },
] as const

const COUNTS = [
  { id: 'auto', label: 'Auto' },
  { id: '6', label: '6 slides' },
  { id: '8', label: '8 slides' },
  { id: '10', label: '10 slides' },
  { id: '12', label: '12 slides' },
] as const

const EXAMPLES = [
  'Q3 product launch plan for a fintech mobile app: market, features, GTM, metrics, risks, and ask.',
  'Employee onboarding training: company culture, tools, security policies, first 30 days checklist.',
  'Climate tech investor pitch: problem, solution, traction, business model, team, and funding ask.',
]

export function PptMaker() {
  const [prompt, setPrompt] = useState('')
  const [author, setAuthor] = useState('dragonPDF')
  const [tone, setTone] = useState<(typeof TONES)[number]['id']>('professional')
  const [slideCount, setSlideCount] = useState<string>('auto')
  const [themeId, setThemeId] = useState<PptThemeId>('dragon')
  const [outline, setOutline] = useState<DeckOutline | null>(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [useAi, setUseAi] = useState(false)
  const [apiKey, setApiKey] = useState(() => {
    try {
      return localStorage.getItem('dragonpdf_xai_key') || ''
    } catch {
      return ''
    }
  })

  const theme = useMemo(
    () => PPT_THEMES.find((t) => t.id === themeId) || PPT_THEMES[0],
    [themeId],
  )

  async function generate() {
    setError(null)
    setStatus(null)
    setBusy(true)
    try {
      let deck = outlineFromPrompt(prompt, {
        author,
        tone,
        slideCount:
          slideCount === 'auto' ? 'auto' : Number(slideCount) || 'auto',
      })
      setOutline(deck)
      setStatus(
        `Outline ready · ${deck.slides.length} slides. ${useAi && apiKey ? 'Enhancing…' : 'Building PPTX…'}`,
      )

      if (useAi && apiKey.trim()) {
        try {
          localStorage.setItem('dragonpdf_xai_key', apiKey.trim())
        } catch {
          /* ignore */
        }
        deck = await enhanceOutlineWithXai(deck, prompt, apiKey, setStatus)
        setOutline(deck)
      }

      setStatus('Creating PowerPoint file…')
      const blob = await buildPptx(deck, themeId)
      const name = `${baseName(deck.title.replace(/[^\w\s-]/g, '').slice(0, 40) || 'presentation')}_dragonPDF.pptx`
      downloadBlob(blob, name)
      setStatus(
        `Done — ${deck.slides.length} slides downloaded as ${name}`,
      )
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Failed to create presentation')
    } finally {
      setBusy(false)
    }
  }

  async function downloadOnly() {
    if (!outline) return
    setBusy(true)
    setError(null)
    try {
      const blob = await buildPptx(outline, themeId)
      downloadBlob(
        blob,
        `${baseName(outline.title.replace(/[^\w\s-]/g, '').slice(0, 40) || 'presentation')}_dragonPDF.pptx`,
      )
      setStatus('PPTX downloaded again.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page ppt-page">
      <Link to="/" className="back-link">
        <ArrowLeft size={16} /> All tools
      </Link>

      <div className="tool-page-header">
        <div className="tool-icon" style={{ background: '#f07a28' }}>
          <Presentation size={26} color="#fff" />
        </div>
        <div>
          <h1>AI PPT Maker</h1>
          <p>
            Describe your deck in a prompt — dragonPDF builds a professional
            PowerPoint (.pptx) with title, agenda, content, and closing slides.
          </p>
        </div>
      </div>

      <div className="ppt-grid">
        <section className="workspace ppt-panel">
          <label className="ppt-label">
            Your prompt
            <textarea
              className="ppt-prompt"
              rows={8}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Example: Create a pitch deck for a B2B SaaS analytics product targeting mid-market retailers. Cover problem, solution, market size, product demo highlights, pricing, traction, go-to-market, team, and the funding ask."
            />
          </label>

          <div className="ppt-examples">
            <span className="muted">Try an example:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.slice(0, 24)}
                type="button"
                className="ppt-chip"
                onClick={() => setPrompt(ex)}
              >
                {ex.slice(0, 48)}…
              </button>
            ))}
          </div>

          <div className="ppt-controls">
            <label>
              Tone
              <select
                value={tone}
                onChange={(e) =>
                  setTone(e.target.value as (typeof TONES)[number]['id'])
                }
              >
                {TONES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Slides
              <select
                value={slideCount}
                onChange={(e) => setSlideCount(e.target.value)}
              >
                {COUNTS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Presenter / brand
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Your name or company"
              />
            </label>
          </div>

          <div className="ppt-themes">
            <div className="ppt-label-row">
              <LayoutTemplate size={16} />
              <span>Theme</span>
            </div>
            <div className="ppt-theme-list">
              {PPT_THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`ppt-theme ${themeId === t.id ? 'active' : ''}`}
                  onClick={() => setThemeId(t.id)}
                  style={{
                    background: `#${t.bg}`,
                    borderColor:
                      themeId === t.id ? `#${t.accent}` : 'transparent',
                  }}
                >
                  <span
                    className="ppt-theme-swatch"
                    style={{ background: `#${t.accent}` }}
                  />
                  {t.name}
                </button>
              ))}
            </div>
          </div>

          <div className="ppt-ai-box">
            <label className="le-check">
              <input
                type="checkbox"
                checked={useAi}
                onChange={(e) => setUseAi(e.target.checked)}
              />
              <span>
                <Wand2 size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                Optional AI polish (xAI / SpaceXAI API key)
              </span>
            </label>
            {useAi && (
              <label>
                API key (stored only in this browser)
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="xai-…"
                  autoComplete="off"
                />
              </label>
            )}
            <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.78rem' }}>
              Works fully offline without a key. With a key from{' '}
              <a
                href="https://console.x.ai"
                target="_blank"
                rel="noreferrer"
                style={{ color: 'var(--accent-gold)' }}
              >
                console.x.ai
              </a>
              , content is refined by the model.
            </p>
          </div>

          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !prompt.trim()}
              onClick={() => void generate()}
            >
              <Sparkles size={16} />
              {busy ? 'Creating…' : 'Generate PowerPoint'}
            </button>
            {outline && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busy}
                onClick={() => void downloadOnly()}
              >
                <Download size={16} /> Download again
              </button>
            )}
          </div>

          {status && <div className="status success">{status}</div>}
          {error && <div className="status error">{error}</div>}
        </section>

        <aside className="workspace ppt-preview-panel">
          <h2 className="ppt-preview-title">
            Outline preview
            {outline ? ` · ${outline.slides.length} slides` : ''}
          </h2>
          {!outline ? (
            <div className="ppt-empty">
              <Presentation size={40} strokeWidth={1.25} />
              <p>
                Your slide outline appears here after you generate. Themes:
                currently <strong>{theme.name}</strong>.
              </p>
            </div>
          ) : (
            <div className="ppt-outline">
              <div className="ppt-deck-meta">
                <strong>{outline.title}</strong>
                <span>{outline.subtitle}</span>
                <span className="muted">{outline.author}</span>
              </div>
              <ol className="ppt-slide-list">
                {outline.slides.map((s, i) => (
                  <li key={`${s.title}-${i}`}>
                    <span className="ppt-slide-num">{i + 1}</span>
                    <div>
                      <div className="ppt-slide-kind">{s.kind}</div>
                      <div className="ppt-slide-name">{s.title}</div>
                      {s.bullets && s.bullets.length > 0 && (
                        <ul>
                          {s.bullets.slice(0, 4).map((b) => (
                            <li key={b.slice(0, 40)}>{b}</li>
                          ))}
                          {s.bullets.length > 4 && (
                            <li className="muted">
                              +{s.bullets.length - 4} more…
                            </li>
                          )}
                        </ul>
                      )}
                      {s.quote && (
                        <p className="ppt-quote">“{s.quote}”</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
