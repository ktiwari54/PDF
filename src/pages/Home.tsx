import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  tools,
  categoryMeta,
  type ToolCategory,
} from '../data/tools'
import { ToolCard } from '../components/ToolCard'
import { Search } from 'lucide-react'

const order: ToolCategory[] = [
  'organize',
  'optimize',
  'convert-to',
  'convert-from',
  'edit',
  'security',
  'intelligence',
]

export function Home() {
  const [q, setQ] = useState('')

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return tools
    return tools.filter(
      (t) =>
        t.name.toLowerCase().includes(s) ||
        t.description.toLowerCase().includes(s) ||
        t.id.includes(s) ||
        t.category.includes(s),
    )
  }, [q])

  return (
    <div className="page">
      <section className="hero">
        <div className="hero-badge">🐉 dragonPDF suite</div>
        <h1>
          Forge PDFs with <span>dragon power</span>
        </h1>
        <p>
          Live-edit without breaking fonts or layout. Merge, compress, convert,
          and protect — private, in your browser.
        </p>
        <div
          style={{
            marginTop: '1.1rem',
            display: 'flex',
            gap: '0.6rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Link to="/editor" className="btn btn-primary">
            Open Live Editor
          </Link>
          <Link to="/ppt-maker" className="btn btn-ghost">
            AI PPT Maker
          </Link>
        </div>
        <div className="search-bar">
          <Search size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Find a tool (merge, OCR, watermark…)"
            aria-label="Search tools"
          />
        </div>
        <div className="hero-stats">
          <span>{tools.length} tools</span>
          <span>·</span>
          <span>Private by design</span>
          <span>·</span>
          <span>No signup</span>
        </div>
      </section>

      {q.trim() ? (
        <section className="category-block">
          <h2 className="category-title">
            Search results ({filtered.length})
          </h2>
          {filtered.length === 0 ? (
            <p className="muted">No tools match “{q}”.</p>
          ) : (
            <div className="tools-grid">
              {filtered.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          )}
        </section>
      ) : (
        order.map((cat) => {
          const list = tools.filter((t) => t.category === cat)
          const meta = categoryMeta[cat]
          return (
            <section
              key={cat}
              id={
                cat === 'convert-to' || cat === 'convert-from' ? 'convert' : cat
              }
              className="category-block"
            >
              <h2 className="category-title">
                <span
                  className="category-dot"
                  style={{ background: meta.color, color: meta.color }}
                />
                {meta.title}
              </h2>
              <div className="tools-grid">
                {list.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>
            </section>
          )
        })
      )}
    </div>
  )
}
