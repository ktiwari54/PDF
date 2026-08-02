import { Link } from 'react-router-dom'
import type { ToolDef } from '../data/tools'
import { ToolIcon } from './ToolIcon'

export function ToolCard({ tool }: { tool: ToolDef }) {
  const href =
    tool.id === 'edit-pdf'
      ? '/editor'
      : tool.id === 'ppt-maker'
        ? '/ppt-maker'
        : tool.id === 'bulk-mask'
          ? '/bulk-mask'
          : `/tools/${tool.id}`
  return (
    <Link to={href} className="tool-card">
      {tool.badge && <span className="badge">{tool.badge}</span>}
      <ToolIcon name={tool.icon} color={tool.color} />
      <h3>{tool.name}</h3>
      <p>{tool.description}</p>
    </Link>
  )
}
