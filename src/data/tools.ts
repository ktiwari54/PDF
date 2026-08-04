export type ToolCategory =
  | 'organize'
  | 'optimize'
  | 'convert-to'
  | 'convert-from'
  | 'edit'
  | 'security'
  | 'intelligence'

export interface ToolDef {
  id: string
  name: string
  description: string
  category: ToolCategory
  color: string
  icon: string
  accept: string
  multiple: boolean
  badge?: string
  minFiles?: number
}

export const categoryMeta: Record<
  ToolCategory,
  { title: string; color: string }
> = {
  organize: { title: 'Organize', color: '#f07a28' },
  optimize: { title: 'Optimize', color: '#3dd68c' },
  'convert-to': { title: 'Convert to PDF', color: '#f0c14b' },
  'convert-from': { title: 'Convert from PDF', color: '#5b9dff' },
  edit: { title: 'Edit', color: '#c084fc' },
  security: { title: 'Security', color: '#38bdf8' },
  intelligence: { title: 'Intelligence', color: '#fb7185' },
}

export const tools: ToolDef[] = [
  // Organize
  {
    id: 'merge-pdf',
    name: 'Merge PDF',
    description:
      'Combine PDFs in the order you want with the easiest PDF merger available.',
    category: 'organize',
    color: '#f07a28',
    icon: 'merge',
    accept: 'application/pdf',
    multiple: true,
    minFiles: 2,
  },
  {
    id: 'split-pdf',
    name: 'Split PDF',
    description:
      'Separate one page or a whole set for easy conversion into independent PDF files.',
    category: 'organize',
    color: '#f07a28',
    icon: 'split',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'remove-pages',
    name: 'Remove pages',
    description: 'Delete pages from your PDF. Remove unwanted pages in seconds.',
    category: 'organize',
    color: '#f07a28',
    icon: 'remove',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'extract-pages',
    name: 'Extract pages',
    description: 'Extract selected pages from your PDF into a new document.',
    category: 'organize',
    color: '#f07a28',
    icon: 'extract',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'organize-pdf',
    name: 'Organize PDF',
    description:
      'Sort pages of your PDF however you like. Delete PDF pages or add PDF pages.',
    category: 'organize',
    color: '#f07a28',
    icon: 'organize',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'scan-to-pdf',
    name: 'Scan to PDF',
    description:
      'Capture document images from your device and turn them into a PDF instantly.',
    category: 'organize',
    color: '#f07a28',
    icon: 'scan',
    accept: 'image/*',
    multiple: true,
  },

  // Optimize
  {
    id: 'compress-pdf',
    name: 'Compress PDF',
    description:
      'Reduce file size while optimizing for maximal PDF quality.',
    category: 'optimize',
    color: '#3dd68c',
    icon: 'compress',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'repair-pdf',
    name: 'Repair PDF',
    description:
      'Repair a damaged PDF and recover data from corrupt PDF files.',
    category: 'optimize',
    color: '#3dd68c',
    icon: 'repair',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'ocr-pdf',
    name: 'OCR PDF',
    description:
      'Easily convert scanned PDF into searchable and selectable documents.',
    category: 'optimize',
    color: '#3dd68c',
    icon: 'ocr',
    accept: 'application/pdf,image/*',
    multiple: false,
  },

  // Convert to PDF
  {
    id: 'jpg-to-pdf',
    name: 'JPG to PDF',
    description:
      'Convert JPG images to PDF in seconds. Easily adjust orientation and margins.',
    category: 'convert-to',
    color: '#f0c14b',
    icon: 'jpg-pdf',
    accept: 'image/jpeg,image/jpg,image/png,image/webp,image/gif',
    multiple: true,
  },
  {
    id: 'word-to-pdf',
    name: 'Word to PDF',
    description: 'Make DOC and DOCX files easy to read by converting them to PDF.',
    category: 'convert-to',
    color: '#5b9dff',
    icon: 'word-pdf',
    accept:
      '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    multiple: false,
  },
  {
    id: 'powerpoint-to-pdf',
    name: 'PowerPoint to PDF',
    description:
      'Make PPT and PPTX slideshows easy to view by converting them to PDF.',
    category: 'convert-to',
    color: '#ff6b4a',
    icon: 'ppt-pdf',
    accept:
      '.ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation',
    multiple: false,
  },
  {
    id: 'excel-to-pdf',
    name: 'Excel to PDF',
    description: 'Make Excel spreadsheets easy to read by converting them to PDF.',
    category: 'convert-to',
    color: '#34d399',
    icon: 'excel-pdf',
    accept:
      '.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    multiple: false,
  },
  {
    id: 'html-to-pdf',
    name: 'HTML to PDF',
    description:
      'Convert webpages in HTML to PDF. Paste HTML content and convert.',
    category: 'convert-to',
    color: '#fb923c',
    icon: 'html-pdf',
    accept: '.html,.htm,text/html',
    multiple: false,
  },

  // Convert from PDF
  {
    id: 'pdf-to-jpg',
    name: 'PDF to JPG',
    description:
      'Convert each PDF page into a JPG or extract all images contained in a PDF.',
    category: 'convert-from',
    color: '#fbbf24',
    icon: 'pdf-jpg',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'pdf-to-word',
    name: 'PDF to Word',
    description:
      'Easily convert your PDF files into easy to edit DOC and DOCX documents.',
    category: 'convert-from',
    color: '#5b9dff',
    icon: 'pdf-word',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'pdf-to-powerpoint',
    name: 'PDF to PowerPoint',
    description: 'Turn your PDF files into easy to edit PPT and PPTX slideshows.',
    category: 'convert-from',
    color: '#ff6b4a',
    icon: 'pdf-ppt',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'pdf-to-excel',
    name: 'PDF / Image to Excel',
    description:
      'Extract tables from PDFs or images into .xlsx. Layout detection for text PDFs; OCR for scans and photos.',
    category: 'convert-from',
    color: '#34d399',
    icon: 'pdf-excel',
    accept:
      'application/pdf,image/png,image/jpeg,image/webp,image/gif,image/bmp,image/tiff,.pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff',
    multiple: true,
    badge: 'OCR',
  },
  {
    id: 'pdf-to-pdfa',
    name: 'PDF to PDF/A',
    description:
      'Transform your PDF to PDF/A, the ISO-standardized version of PDF for long-term archiving.',
    category: 'convert-from',
    color: '#38bdf8',
    icon: 'pdfa',
    accept: 'application/pdf',
    multiple: false,
  },

  // Edit
  {
    id: 'rotate-pdf',
    name: 'Rotate PDF',
    description:
      'Rotate your PDFs the way you need them. You can even rotate multiple PDFs at once!',
    category: 'edit',
    color: '#c084fc',
    icon: 'rotate',
    accept: 'application/pdf',
    multiple: true,
  },
  {
    id: 'page-numbers',
    name: 'Add page numbers',
    description:
      'Add page numbers into PDFs with ease. Choose your positions, dimensions, typography.',
    category: 'edit',
    color: '#c084fc',
    icon: 'numbers',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'watermark',
    name: 'Add watermark',
    description:
      'Stamp text over every page — center, tile, top, or bottom with opacity control.',
    category: 'edit',
    color: '#c084fc',
    icon: 'watermark',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'remove-watermark',
    name: 'Remove watermark',
    description:
      'Cover or strip watermark text (CONFIDENTIAL, DRAFT, etc.) or clear the center band.',
    category: 'edit',
    color: '#fb7185',
    icon: 'remove-watermark',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'crop-pdf',
    name: 'Crop PDF',
    description:
      'Crop margins of PDF documents or select specific areas, then apply to one page or the whole document.',
    category: 'edit',
    color: '#c084fc',
    icon: 'crop',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'edit-pdf',
    name: 'Live Edit PDF',
    description:
      'Non-destructive live editor. Keeps original fonts & layout; ink mode for handwritten/scanned PDFs.',
    category: 'edit',
    color: '#c084fc',
    icon: 'edit',
    accept: 'application/pdf',
    multiple: false,
    badge: 'Live',
  },
  {
    id: 'pdf-forms',
    name: 'PDF Forms',
    description:
      'Detect form fields automatically, create interactive fillable PDFs, or fill PDF forms yourself.',
    category: 'edit',
    color: '#c084fc',
    icon: 'forms',
    accept: 'application/pdf',
    multiple: false,
    badge: 'New!',
  },

  // Security
  {
    id: 'bulk-mask',
    name: 'Bulk PDF Masker',
    description:
      'Mask emails, phones, addresses, amounts, VAT/GST, licenses & names on digital or scanned PDFs — up to 10,000 files.',
    category: 'security',
    color: '#38bdf8',
    icon: 'bulk-mask',
    accept: 'application/pdf',
    multiple: true,
    badge: 'Bulk',
  },
  {
    id: 'unlock-pdf',
    name: 'Unlock PDF',
    description:
      'Remove PDF password security, giving you the freedom to use your PDFs as you want.',
    category: 'security',
    color: '#38bdf8',
    icon: 'unlock',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'protect-pdf',
    name: 'Protect PDF',
    description:
      'Protect PDF files with a password. Encrypt PDF documents to prevent unauthorized access.',
    category: 'security',
    color: '#38bdf8',
    icon: 'protect',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'sign-pdf',
    name: 'Sign PDF',
    description: 'Sign yourself or request electronic signatures from others.',
    category: 'security',
    color: '#38bdf8',
    icon: 'sign',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'redact-pdf',
    name: 'Redact PDF',
    description:
      'Redact text and graphics to permanently remove sensitive information from a PDF.',
    category: 'security',
    color: '#38bdf8',
    icon: 'redact',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'compare-pdf',
    name: 'Compare PDF',
    description:
      'Show a side-by-side document comparison and easily spot changes between different file versions.',
    category: 'security',
    color: '#38bdf8',
    icon: 'compare',
    accept: 'application/pdf',
    multiple: true,
    minFiles: 2,
  },

  // Intelligence
  {
    id: 'ppt-maker',
    name: 'Dragon PPT',
    description:
      'One prompt → extremely accurate board-ready PowerPoint with images, KPIs, roadmap. No API token required.',
    category: 'intelligence',
    color: '#F07A28',
    icon: 'ppt-maker',
    accept: '*/*',
    multiple: false,
    badge: 'Dragon',
  },
  {
    id: 'ai-summarizer',
    name: 'AI Summarizer',
    description:
      'Quickly generate concise summaries from articles, paragraphs, and essays with key points.',
    category: 'intelligence',
    color: '#fb7185',
    icon: 'summarize',
    accept: 'application/pdf',
    multiple: false,
    badge: 'New!',
  },
  {
    id: 'translate-pdf',
    name: 'Translate PDF',
    description:
      'Translate PDF text into 100+ languages. Auto-detect source, download a translated PDF.',
    category: 'intelligence',
    color: '#fb7185',
    icon: 'translate',
    accept: 'application/pdf',
    multiple: false,
    badge: 'Live',
  },
  {
    id: 'pdf-to-markdown',
    name: 'PDF to Markdown',
    description: 'Convert PDF content into clean Markdown for docs and blogs.',
    category: 'intelligence',
    color: '#fb7185',
    icon: 'markdown',
    accept: 'application/pdf',
    multiple: false,
    badge: 'New!',
  },
]

export function getTool(id: string): ToolDef | undefined {
  return tools.find((t) => t.id === id)
}

export const navHighlights = [
  'merge-pdf',
  'split-pdf',
  'compress-pdf',
] as const
