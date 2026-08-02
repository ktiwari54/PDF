import {
  Combine,
  Scissors,
  Trash2,
  FileOutput,
  LayoutGrid,
  ScanLine,
  Minimize2,
  Wrench,
  ScanText,
  ImagePlus,
  FileType,
  Presentation,
  Table,
  Code2,
  Image,
  FileText,
  FileSpreadsheet,
  Archive,
  RotateCw,
  Hash,
  Droplets,
  DropletOff,
  Crop,
  Pencil,
  FormInput,
  Unlock,
  Shield,
  PenLine,
  Eraser,
  Columns2,
  Sparkles,
  Languages,
  FileCode,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react'

const map: Record<string, LucideIcon> = {
  merge: Combine,
  split: Scissors,
  remove: Trash2,
  extract: FileOutput,
  organize: LayoutGrid,
  scan: ScanLine,
  compress: Minimize2,
  repair: Wrench,
  ocr: ScanText,
  'jpg-pdf': ImagePlus,
  'word-pdf': FileType,
  'ppt-pdf': Presentation,
  'excel-pdf': Table,
  'html-pdf': Code2,
  'pdf-jpg': Image,
  'pdf-word': FileText,
  'pdf-ppt': Presentation,
  'pdf-excel': FileSpreadsheet,
  pdfa: Archive,
  rotate: RotateCw,
  numbers: Hash,
  watermark: Droplets,
  'remove-watermark': DropletOff,
  crop: Crop,
  edit: Pencil,
  forms: FormInput,
  unlock: Unlock,
  protect: Shield,
  sign: PenLine,
  redact: Eraser,
  compare: Columns2,
  summarize: Sparkles,
  translate: Languages,
  markdown: FileCode,
  'ppt-maker': Presentation,
  'bulk-mask': ShieldAlert,
}

export function ToolIcon({
  name,
  color,
  size = 22,
}: {
  name: string
  color: string
  size?: number
}) {
  const Icon = map[name] || FileText
  return (
    <div className="tool-icon" style={{ background: color }}>
      <Icon size={size} strokeWidth={2} />
    </div>
  )
}
