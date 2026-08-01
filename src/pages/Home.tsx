import {
  tools,
  categoryMeta,
  type ToolCategory,
} from '../data/tools'
import { ToolCard } from '../components/ToolCard'

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
  return (
    <div className="page">
      <section className="hero">
        <h1>Every tool you need to work with PDFs</h1>
        <p>
          Merge, split, compress, convert, edit, protect, OCR, and more — free
          in your browser. Files stay on your device.
        </p>
      </section>

      {order.map((cat) => {
        const list = tools.filter((t) => t.category === cat)
        const meta = categoryMeta[cat]
        return (
          <section
            key={cat}
            id={cat === 'convert-to' || cat === 'convert-from' ? 'convert' : cat}
            className="category-block"
          >
            <h2 className="category-title">
              <span
                className="category-dot"
                style={{ background: meta.color }}
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
      })}
    </div>
  )
}
