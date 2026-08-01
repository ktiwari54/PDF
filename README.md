# PDF Tools

Browser-based PDF editor inspired by iLovePDF — **all tools from the product screenshots**, running locally in your browser.

**Repo:** https://github.com/ktiwari54/PDF

## Features

### Organize PDF
- Merge PDF · Split PDF · Remove pages · Extract pages · Organize PDF · Scan to PDF

### Optimize PDF
- Compress PDF · Repair PDF · OCR PDF

### Convert to PDF
- JPG to PDF · Word to PDF · PowerPoint to PDF · Excel to PDF · HTML to PDF

### Convert from PDF
- PDF to JPG · PDF to Word · PDF to PowerPoint · PDF to Excel · PDF to PDF/A

### Edit PDF
- Rotate PDF · Add page numbers · Add watermark · Crop PDF · Edit PDF · PDF Forms

### PDF Security
- Unlock PDF · Protect PDF · Sign PDF · Redact PDF · Compare PDF

### PDF Intelligence
- AI Summarizer · Translate PDF · PDF to Markdown

> Processing is **client-side**. Files stay on your device (except OCR language model download from the CDN).

## Quick start

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

```bash
npm run build
npm run preview
```

## Stack

- React + TypeScript + Vite
- `pdf-lib` · `pdfjs-dist` · `jspdf` · `jszip`
- `mammoth` (Word) · `xlsx` (Excel) · `tesseract.js` (OCR)

## Notes

- **Protect / Unlock** password encryption support depends on pdf-lib capabilities; complex DRM may not apply.
- **Office conversions** are best-effort in the browser (text/layout approximations).
- **AI Translate** uses the browser Translator API when available; otherwise exports a marked text PDF.
- **OCR** downloads English trained data on first use.

## License

MIT
