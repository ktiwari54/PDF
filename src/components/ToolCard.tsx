import { Link } from 'react-router-dom'
import type { ToolDef } from '../data/tools'
import { ToolIcon } from './ToolIcon'

export function ToolCard({ tool }: { tool: ToolDef }) {
  return (
    <Link to={`/tools/${tool.id}`} className="tool-card">
      {tool.badge && <span className="badge">{tool.badge}</span>}
      <ToolIcon name={tool.icon} color={tool.color} />
      <h3>{tool.name}</h3>
      <p>{tool.description}</p>
    </Link>
  )
}
