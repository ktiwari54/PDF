import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Presentation,
  Sparkles,
  Download,
  ArrowLeft,
  LayoutTemplate,
  Image as ImageIcon,
  Flame,
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
  { id: 'pitch', label: 'Investor / Pitch' },
  { id: 'professional', label: 'Board / Strategy' },
  { id: 'report', label: 'Exec Report' },
  { id: 'training', label: 'Leadership Training' },
] as const

const COUNTS = [
  { id: 'auto', label: 'Auto (10–14)' },
  { id: '10', label: '10 slides' },
  { id: '12', label: '12 slides' },
  { id: '14', label: '14 slides' },
] as const

const EXAMPLES = [
  'Series A pitch for an AI-powered invoice automation SaaS: problem, solution, market, product, GTM, traction, unit economics, team, and $8M raise.',
  'Board update on Middle East expansion: performance, risks, capital plan, competitive moves, and decisions required this quarter.',
  'Enterprise digital transformation roadmap for a logistics group: current state, workstreams, ROI, governance, and 90-day plan.',
]

export function PptMaker() {
  const [prompt, setPrompt] = useState('')
  const [author, setAuthor] = useState('Executive Team')
  const [tone, setTone] = useState<(typeof TONES)[number]['id']>('pitch')
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

  function fileName(title: string) {
    return `${baseName(title.replace(/[^\w\s-]/g, '').slice(0, 40) || 'dragon-deck')}_DragonPPT.pptx`
  }

  async function generate() {
    setError(null)
    setStatus(null)
    setBusy(true)
    try {
      setStatus('Dragon PPT: extracting facts & building prompt-accurate narrative…')
      let deck = outlineFromPrompt(prompt, {
        author,
        tone,
        ceoMode: true,
        slideCount:
          slideCount === 'auto' ? 'auto' : Number(slideCount) || 'auto',
      })
      setOutline(deck)

      if (useAi && apiKey.trim()) {
        try {
          localStorage.setItem('dragonpdf_xai_key', apiKey.trim())
        } catch {
          /* ignore */
        }
        deck = await enhanceOutlineWithXai(deck, prompt, apiKey, setStatus)
        setOutline(deck)
      }

      setStatus('Composing Dragon PPT slides and fetching visuals (no token)…')
      const blob = await buildPptx(deck, themeId, setStatus)
      const name = fileName(deck.title)
      downloadBlob(blob, name)
      setStatus(
        `Done — ${deck.slides.length} high-accuracy slides · ${name}`,
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
      const blob = await buildPptx(outline, themeId, setStatus)
      downloadBlob(blob, fileName(outline.title))
      setStatus('Dragon PPT downloaded again.')
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
        <div className="tool-icon" style={{ background: '#F07A28' }}>
          <Flame size={26} color="#0C0E14" />
        </div>
        <div>
          <h1>Dragon PPT</h1>
          <p>
            One prompt → extremely accurate, board-ready PowerPoint. Pulls your
            numbers, sections, regions, and claims into the deck — with
            executive structure and stock photography.{' '}
            <strong>No API token required.</strong>
          </p>
        </div>
      </div>

      <div className="ppt-grid">
        <section className="workspace ppt-panel">
          <label className="ppt-label">
            Your brief (one prompt)
            <textarea
              className="ppt-prompt"
              rows={8}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Be specific for max accuracy: audience, goal, $ figures, regions, and the sections to cover. Example: Series A pitch for AI invoice SaaS — problem, solution, market, product, GTM, traction, unit economics, team, $8M raise."
            />
          </label>

          <div className="ppt-examples">
            <span className="muted">Try:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex.slice(0, 28)}
                type="button"
                className="ppt-chip"
                onClick={() => setPrompt(ex)}
              >
                {ex.slice(0, 52)}…
              </button>
            ))}
          </div>

          <div className="ppt-controls">
            <label>
              Deck type
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
              Presenter
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Company / presenter name"
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

          <div className="bulk-keep-note">
            <strong>
              <ImageIcon size={14} style={{ verticalAlign: -2 }} /> Dragon PPT
              accuracy (no token)
            </strong>
            <span>
              Extracts $ figures, %, regions, and your section list · Agenda
              mirrors your brief · KPI cards from real numbers · Image+text ·
              Two-column analysis · Priority cards · 90-day roadmap tied to your
              subject · Leadership takeaway · Closing next steps
            </span>
          </div>

          <div className="ppt-ai-box">
            <label className="le-check">
              <input
                type="checkbox"
                checked={useAi}
                onChange={(e) => setUseAi(e.target.checked)}
              />
              <span>Optional AI polish (only if you have an xAI key)</span>
            </label>
            {useAi && (
              <label>
                API key (browser only)
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="xai-… (optional)"
                  autoComplete="off"
                />
              </label>
            )}
          </div>

          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !prompt.trim()}
              onClick={() => void generate()}
            >
              <Sparkles size={16} />
              {busy ? 'Creating Dragon PPT…' : 'Generate Dragon PPT'}
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
                Your high-accuracy Dragon PPT outline appears here. Theme:{' '}
                <strong>{theme.name}</strong>
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
                      <div className="ppt-slide-kind">
                        {s.kind}
                        {s.imageUrl ? ' · image' : ''}
                      </div>
                      <div className="ppt-slide-name">{s.title}</div>
                      {s.bullets && s.bullets.length > 0 && (
                        <ul>
                          {s.bullets.slice(0, 3).map((b) => (
                            <li key={b.slice(0, 48)}>{b}</li>
                          ))}
                          {s.bullets.length > 3 && (
                            <li className="muted">
                              +{s.bullets.length - 3} more…
                            </li>
                          )}
                        </ul>
                      )}
                      {s.stats && (
                        <ul>
                          {s.stats.map((st) => (
                            <li key={st.label}>
                              {st.value} — {st.label}
                            </li>
                          ))}
                        </ul>
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
