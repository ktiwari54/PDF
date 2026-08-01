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
        PDF Tools — files are processed in your browser and never uploaded to a
        server.
      </footer>
    </>
  )
}
