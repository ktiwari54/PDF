# dragonPDF

Private, browser-only PDF toolkit. Dark ember theme — merge, split, compress, convert, edit, protect, OCR, and more.

**GitHub:** https://github.com/ktiwari54/PDF  
**Deploy:** Vercel (recommended) or GitHub Pages

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:5173

## Features

33+ tools across Organize · Optimize · Convert · Edit · Security · Intelligence.  
**AI PPT Maker** — create professional `.pptx` decks from a text prompt (themes, agenda, content).  
**Bulk Sensitive Mask** — redact email/phone/address/amounts/VAT/GST/licenses/last names for 1–10,000 PDFs (folder in/out).  
All core PDF processing stays on your device.

## Deploy on Vercel (from GitHub)

1. Push this repo to GitHub (already: `ktiwari54/PDF`).
2. Go to [https://vercel.com/new](https://vercel.com/new) and sign in with **GitHub**.
3. Import **`ktiwari54/PDF`**.
4. Framework: **Vite** (auto-detected).  
   - Build command: `npm run build`  
   - Output directory: `dist`
5. Click **Deploy**.

Every push to `main` will redeploy automatically.

SPA routes (`/bulk-mask`, `/editor`, etc.) are handled by `vercel.json` rewrites.

## Stack

React 19 · TypeScript · Vite · `@cantoo/pdf-lib` · pdf.js · Tesseract · mammoth · xlsx · pptxgenjs

## License

MIT
