import { Routes, Route, useLocation } from 'react-router-dom'
import { Header } from './components/Header'
import { Home } from './pages/Home'
import { ToolPage } from './pages/ToolPage'
import { LiveEditor } from './pages/LiveEditor'
import { PptMaker } from './pages/PptMaker'
import { BulkMask } from './pages/BulkMask'
import { PdfToExcel } from './pages/PdfToExcel'

export default function App() {
  const location = useLocation()
  const isLiveEditor =
    location.pathname === '/editor' ||
    location.pathname === '/tools/edit-pdf'

  if (isLiveEditor) {
    return (
      <Routes>
        <Route path="/editor" element={<LiveEditor />} />
        <Route path="/tools/edit-pdf" element={<LiveEditor />} />
      </Routes>
    )
  }

  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ppt-maker" element={<PptMaker />} />
        <Route path="/tools/ppt-maker" element={<PptMaker />} />
        <Route path="/bulk-mask" element={<BulkMask />} />
        <Route path="/tools/bulk-mask" element={<BulkMask />} />
        <Route path="/pdf-to-excel" element={<PdfToExcel />} />
        <Route path="/tools/pdf-to-excel" element={<PdfToExcel />} />
        <Route path="/tools/:toolId" element={<ToolPage />} />
        <Route path="/editor" element={<LiveEditor />} />
      </Routes>
      <footer className="footer">
        <strong>dragonPDF</strong> — your files stay on this device. Nothing is
        uploaded to a server.
      </footer>
    </>
  )
}
