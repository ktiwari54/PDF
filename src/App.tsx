import { Routes, Route } from 'react-router-dom'
import { Header } from './components/Header'
import { Home } from './pages/Home'
import { ToolPage } from './pages/ToolPage'

export default function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tools/:toolId" element={<ToolPage />} />
      </Routes>
      <footer className="footer">
        <strong>dragonPDF</strong> — your files stay on this device. Nothing is
        uploaded to a server.
      </footer>
    </>
  )
}
