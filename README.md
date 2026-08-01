# PDF Tools — Full Browser PDF Editor

Free, full-featured PDF suite inspired by iLovePDF. **All processing runs in your browser** — files are not uploaded to a server.

**GitHub:** https://github.com/ktiwari54/PDF  
**Live (after Pages enabled):** https://ktiwari54.github.io/PDF/

## Tools (33)

### Organize PDF
Merge · Split · Remove pages · Extract pages · Organize (reorder) · Scan to PDF

### Optimize PDF
Compress (real JPEG re-encode) · Repair · OCR (Tesseract)

### Convert to PDF
JPG/PNG → PDF · Word → PDF · PowerPoint → PDF · Excel → PDF · HTML → PDF

### Convert from PDF
PDF → JPG · PDF → Word · PDF → PowerPoint · PDF → Excel · PDF → PDF/A

### Edit PDF
Rotate · Page numbers · Watermark · Crop · Edit text · PDF Forms

### Security
Unlock · Protect (password) · Sign (draw signature) · Redact · Compare side-by-side

### Intelligence
AI Summarizer (extractive) · Translate · PDF → Markdown

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:5173

```bash
npm run build
npm run preview
```

## Enable GitHub Pages

1. Repo **Settings → Pages**
2. Source: **GitHub Actions**
3. Push to `main` (workflow deploys automatically)

## Stack

- React 19 + TypeScript + Vite
- `@cantoo/pdf-lib` · `pdfjs-dist` · `jspdf` · `jszip`
- `mammoth` · `xlsx` · `tesseract.js` · `html2canvas`

## Privacy

Files stay on your machine. OCR may download language data from a CDN on first use. Translation may call a public API when available.

## License

MIT
