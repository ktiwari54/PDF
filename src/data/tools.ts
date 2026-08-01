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
  organize: { title: 'Organize PDF', color: '#E5322D' },
  optimize: { title: 'Optimize PDF', color: '#27AE60' },
  'convert-to': { title: 'Convert to PDF', color: '#F39C12' },
  'convert-from': { title: 'Convert from PDF', color: '#3498DB' },
  edit: { title: 'Edit PDF', color: '#9B59B6' },
  security: { title: 'PDF Security', color: '#2980B9' },
  intelligence: { title: 'PDF Intelligence', color: '#8E44AD' },
}

export const tools: ToolDef[] = [
  // Organize
  {
    id: 'merge-pdf',
    name: 'Merge PDF',
    description:
      'Combine PDFs in the order you want with the easiest PDF merger available.',
    category: 'organize',
    color: '#E5322D',
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
    color: '#E5322D',
    icon: 'split',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'remove-pages',
    name: 'Remove pages',
    description: 'Delete pages from your PDF. Remove unwanted pages in seconds.',
    category: 'organize',
    color: '#E5322D',
    icon: 'remove',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'extract-pages',
    name: 'Extract pages',
    description: 'Extract selected pages from your PDF into a new document.',
    category: 'organize',
    color: '#E5322D',
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
    color: '#E5322D',
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
    color: '#E5322D',
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
    color: '#27AE60',
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
    color: '#27AE60',
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
    color: '#27AE60',
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
    color: '#F39C12',
    icon: 'jpg-pdf',
    accept: 'image/jpeg,image/jpg,image/png,image/webp,image/gif',
    multiple: true,
  },
  {
    id: 'word-to-pdf',
    name: 'Word to PDF',
    description: 'Make DOC and DOCX files easy to read by converting them to PDF.',
    category: 'convert-to',
    color: '#2B579A',
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
    color: '#D24726',
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
    color: '#217346',
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
    color: '#E67E22',
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
    color: '#F1C40F',
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
    color: '#2B579A',
    icon: 'pdf-word',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'pdf-to-powerpoint',
    name: 'PDF to PowerPoint',
    description: 'Turn your PDF files into easy to edit PPT and PPTX slideshows.',
    category: 'convert-from',
    color: '#D24726',
    icon: 'pdf-ppt',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'pdf-to-excel',
    name: 'PDF to Excel',
    description:
      'Pull data straight from PDFs into Excel spreadsheets in a few short seconds.',
    category: 'convert-from',
    color: '#217346',
    icon: 'pdf-excel',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'pdf-to-pdfa',
    name: 'PDF to PDF/A',
    description:
      'Transform your PDF to PDF/A, the ISO-standardized version of PDF for long-term archiving.',
    category: 'convert-from',
    color: '#3498DB',
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
    color: '#9B59B6',
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
    color: '#9B59B6',
    icon: 'numbers',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'watermark',
    name: 'Add watermark',
    description:
      'Stamp an image or text over your PDF in seconds. Choose typography and transparency.',
    category: 'edit',
    color: '#9B59B6',
    icon: 'watermark',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'crop-pdf',
    name: 'Crop PDF',
    description:
      'Crop margins of PDF documents or select specific areas, then apply to one page or the whole document.',
    category: 'edit',
    color: '#9B59B6',
    icon: 'crop',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'edit-pdf',
    name: 'Edit PDF',
    description:
      'Add text, images, shapes or freehand annotations to a PDF document. Edit size, font, and color.',
    category: 'edit',
    color: '#9B59B6',
    icon: 'edit',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'pdf-forms',
    name: 'PDF Forms',
    description:
      'Detect form fields automatically, create interactive fillable PDFs, or fill PDF forms yourself.',
    category: 'edit',
    color: '#9B59B6',
    icon: 'forms',
    accept: 'application/pdf',
    multiple: false,
    badge: 'New!',
  },

  // Security
  {
    id: 'unlock-pdf',
    name: 'Unlock PDF',
    description:
      'Remove PDF password security, giving you the freedom to use your PDFs as you want.',
    category: 'security',
    color: '#2980B9',
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
    color: '#2980B9',
    icon: 'protect',
    accept: 'application/pdf',
    multiple: false,
  },
  {
    id: 'sign-pdf',
    name: 'Sign PDF',
    description: 'Sign yourself or request electronic signatures from others.',
    category: 'security',
    color: '#2980B9',
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
    color: '#2980B9',
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
    color: '#2980B9',
    icon: 'compare',
    accept: 'application/pdf',
    multiple: true,
    minFiles: 2,
  },

  // Intelligence
  {
    id: 'ai-summarizer',
    name: 'AI Summarizer',
    description:
      'Quickly generate concise summaries from articles, paragraphs, and essays with key points.',
    category: 'intelligence',
    color: '#8E44AD',
    icon: 'summarize',
    accept: 'application/pdf',
    multiple: false,
    badge: 'New!',
  },
  {
    id: 'translate-pdf',
    name: 'Translate PDF',
    description:
      'Easily translate PDF files. Keep fonts, layout, and formatting intact where possible.',
    category: 'intelligence',
    color: '#8E44AD',
    icon: 'translate',
    accept: 'application/pdf',
    multiple: false,
    badge: 'New!',
  },
  {
    id: 'pdf-to-markdown',
    name: 'PDF to Markdown',
    description: 'Convert PDF content into clean Markdown for docs and blogs.',
    category: 'intelligence',
    color: '#8E44AD',
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
