import { Link } from 'react-router-dom'

export function Header() {
  return (
    <header className="app-header">
      <div className="header-inner">
        <Link to="/" className="logo">
          <span className="logo-heart">♥</span>
          <span>PDF</span>
        </Link>
        <nav className="nav-links">
          <Link to="/tools/merge-pdf">MERGE PDF</Link>
          <Link to="/tools/split-pdf">SPLIT PDF</Link>
          <Link to="/tools/compress-pdf">COMPRESS PDF</Link>
          <Link to="/#convert">CONVERT PDF</Link>
          <Link to="/">ALL PDF TOOLS</Link>
        </nav>
        <div className="header-spacer" />
      </div>
    </header>
  )
}
