import { Link } from 'react-router-dom'

export function Header() {
  return (
    <header className="app-header">
      <div className="header-inner">
        <Link to="/" className="logo" aria-label="dragonPDF home">
          <span className="logo-mark" aria-hidden>
            🐉
          </span>
          <span className="logo-text">
            dragon<em>PDF</em>
          </span>
        </Link>
        <nav className="nav-links">
          <Link to="/bulk-mask" className="nav-highlight">
            Bulk PDF Masker
          </Link>
          <Link to="/editor">Live Edit</Link>
          <Link to="/ppt-maker">CEO PPT</Link>
          <Link to="/tools/merge-pdf">Merge</Link>
          <Link to="/tools/split-pdf">Split</Link>
          <Link to="/">All tools</Link>
        </nav>
        <div className="header-spacer" />
        <Link to="/bulk-mask" className="header-pill header-pill-link">
          Bulk Masker
        </Link>
      </div>
    </header>
  )
}
