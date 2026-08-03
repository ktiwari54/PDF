/**
 * dragonPDF Advanced PPT Maker
 * One prompt → CEO-level .pptx with images — no API token required.
 */
import PptxGenJS from 'pptxgenjs'

export type SlideKind =
  | 'title'
  | 'agenda'
  | 'section'
  | 'bullets'
  | 'two-column'
  | 'image-text'
  | 'cards'
  | 'quote'
  | 'stats'
  | 'timeline'
  | 'closing'

export type DeckSlide = {
  kind: SlideKind
  title: string
  subtitle?: string
  bullets?: string[]
  leftTitle?: string
  leftBullets?: string[]
  rightTitle?: string
  rightBullets?: string[]
  quote?: string
  attribution?: string
  stats?: { value: string; label: string }[]
  cards?: { title: string; body: string }[]
  timeline?: { when: string; what: string }[]
  /** Free stock image URL (fetched at build time) */
  imageUrl?: string
  imageSide?: 'left' | 'right'
  notes?: string
}

export type DeckOutline = {
  title: string
  subtitle: string
  author: string
  tagline?: string
  slides: DeckSlide[]
  imageKeywords: string[]
}

export type PptThemeId =
  | 'dragon'
  | 'corporate'
  | 'midnight'
  | 'ocean'
  | 'forest'
  | 'boardroom'

export type PptTheme = {
  id: PptThemeId
  name: string
  bg: string
  bgAlt: string
  accent: string
  accent2: string
  text: string
  muted: string
  card: string
}

export const PPT_THEMES: PptTheme[] = [
  {
    id: 'boardroom',
    name: 'CEO Boardroom',
    bg: '0A0F1C',
    bgAlt: '111827',
    accent: 'C9A227',
    accent2: 'E8D48B',
    text: 'F8FAFC',
    muted: '94A3B8',
    card: '1E293B',
  },
  {
    id: 'dragon',
    name: 'Dragon Ember',
    bg: '0C0E14',
    bgAlt: '161A26',
    accent: 'F07A28',
    accent2: 'F0C14B',
    text: 'EEF1F8',
    muted: '8B93A7',
    card: '1C2233',
  },
  {
    id: 'corporate',
    name: 'Corporate Blue',
    bg: '0B1F3A',
    bgAlt: '122B4F',
    accent: '3B82F6',
    accent2: '60A5FA',
    text: 'F8FAFC',
    muted: '94A3B8',
    card: '1E3A5F',
  },
  {
    id: 'midnight',
    name: 'Minimal Dark',
    bg: '111111',
    bgAlt: '1A1A1A',
    accent: 'E5E5E5',
    accent2: 'A3A3A3',
    text: 'FAFAFC',
    muted: 'A3A3A3',
    card: '262626',
  },
  {
    id: 'ocean',
    name: 'Ocean Teal',
    bg: '042F2E',
    bgAlt: '0F3D3C',
    accent: '2DD4BF',
    accent2: '5EEAD4',
    text: 'F0FDFA',
    muted: '99F6E4',
    card: '115E59',
  },
  {
    id: 'forest',
    name: 'Forest Green',
    bg: '052E16',
    bgAlt: '14532D',
    accent: '4ADE80',
    accent2: '86EFAC',
    text: 'F0FDF4',
    muted: 'BBF7D0',
    card: '166534',
  },
]

export function getTheme(id: PptThemeId): PptTheme {
  return PPT_THEMES.find((t) => t.id === id) || PPT_THEMES[0]
}

// ——— Image keywords (free Unsplash CDN, no token) ———

const IMAGE_BANK: Record<string, string[]> = {
  business: [
    'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=80',
    'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=80',
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&q=80',
  ],
  technology: [
    'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80',
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1200&q=80',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&q=80',
  ],
  finance: [
    'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=80',
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80',
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80',
  ],
  team: [
    'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1200&q=80',
    'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=1200&q=80',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80',
  ],
  growth: [
    'https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=1200&q=80',
    'https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=1200&q=80',
  ],
  strategy: [
    'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1200&q=80',
    'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80',
  ],
  innovation: [
    'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=1200&q=80',
    'https://images.unsplash.com/photo-1535223289827-42f1e9919769?w=1200&q=80',
  ],
  default: [
    'https://images.unsplash.com/photo-1497366811353-6870744d04b2?w=1200&q=80',
    'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1200&q=80',
    'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=1200&q=80',
  ],
}

function pickImages(prompt: string, count: number): string[] {
  const p = prompt.toLowerCase()
  const pools: string[] = []
  if (/fintech|bank|finance|invest|fund|revenue|money|saas|payment/.test(p)) {
    pools.push(...IMAGE_BANK.finance)
  }
  if (/tech|ai|software|digital|cloud|data|app|platform|cyber/.test(p)) {
    pools.push(...IMAGE_BANK.technology)
  }
  if (/team|people|hr|culture|talent|hire|leadership/.test(p)) {
    pools.push(...IMAGE_BANK.team)
  }
  if (/growth|scale|market|expansion|sales/.test(p)) {
    pools.push(...IMAGE_BANK.growth)
  }
  if (/strategy|plan|roadmap|vision|ceo|board/.test(p)) {
    pools.push(...IMAGE_BANK.strategy)
  }
  if (/innovat|product|launch|r&d|research/.test(p)) {
    pools.push(...IMAGE_BANK.innovation)
  }
  if (!pools.length) pools.push(...IMAGE_BANK.business, ...IMAGE_BANK.default)

  const out: string[] = []
  for (let i = 0; i < count; i++) {
    out.push(pools[i % pools.length])
  }
  return out
}

// ——— CEO-level outline (no token) ———

const CEO_SECTIONS_PITCH = [
  'Executive summary',
  'The opportunity',
  'Problem we solve',
  'Solution & product',
  'Market & positioning',
  'Traction & proof',
  'Business model',
  'Go-to-market',
  'Competitive edge',
  'Financial outlook',
  'Roadmap',
  'The ask & next steps',
]

const CEO_SECTIONS_REPORT = [
  'Executive brief',
  'Context & objectives',
  'Key findings',
  'Performance snapshot',
  'Strategic priorities',
  'Risks & mitigations',
  'Resource plan',
  'Recommendations',
  'Decision requests',
  'Appendix highlights',
]

const CEO_SECTIONS_TRAINING = [
  'Welcome & outcomes',
  'Why this matters',
  'Core concepts',
  'Process walkthrough',
  'Tools & systems',
  'Best practices',
  'Common pitfalls',
  'Practice scenarios',
  'Checklist',
  'Q&A and resources',
]

const CEO_SECTIONS_PRO = [
  'Executive overview',
  'Strategic context',
  'Current state',
  'Objectives',
  'Approach',
  'Workstreams',
  'Milestones',
  'Success metrics',
  'Risks',
  'Governance',
  'Investment & ROI',
  'Next steps',
]

export function outlineFromPrompt(
  prompt: string,
  opts?: {
    slideCount?: number | 'auto'
    author?: string
    tone?: 'professional' | 'pitch' | 'training' | 'report'
    ceoMode?: boolean
  },
): DeckOutline {
  const raw = prompt.trim()
  if (!raw) throw new Error('Enter a prompt describing your presentation.')

  const tone = opts?.tone || 'pitch'
  const author = opts?.author?.trim() || 'Executive Team'
  const ceoMode = opts?.ceoMode !== false

  let title = extractTitle(raw)
  const body = raw
  const topics = extractTopics(body, title)
  const framework = pickFramework(tone, topics, raw)

  const target =
    opts?.slideCount === 'auto' || !opts?.slideCount
      ? ceoMode
        ? Math.min(14, Math.max(10, framework.length + 2))
        : Math.min(12, Math.max(7, topics.length + 3))
      : Math.min(16, Math.max(6, opts.slideCount))

  const images = pickImages(raw, 12)
  let imgIdx = 0
  const nextImg = () => images[imgIdx++ % images.length]

  const slides: DeckSlide[] = []

  // Title
  slides.push({
    kind: 'title',
    title,
    subtitle: ceoSubtitle(tone, title),
    notes: `CEO deck · ${tone} · generated offline`,
    imageUrl: nextImg(),
  })

  // Agenda
  const agendaTitles = framework.slice(0, Math.min(8, framework.length))
  slides.push({
    kind: 'agenda',
    title: tone === 'pitch' ? 'Agenda' : 'Discussion agenda',
    subtitle: 'Board-ready narrative',
    bullets: agendaTitles.map((t, i) => `${String(i + 1).padStart(2, '0')}  ${t}`),
  })

  // Executive summary / stats early
  const stats = extractOrInventStats(raw, title)
  slides.push({
    kind: 'stats',
    title: tone === 'pitch' ? 'Snapshot at a glance' : 'Key metrics',
    subtitle: 'What leadership needs to know first',
    stats,
    imageUrl: nextImg(),
  })

  // Build content from framework
  const used = framework.slice(0, Math.max(1, target - 4))
  used.forEach((sectionTitle, idx) => {
    const topic = topics[idx % Math.max(1, topics.length)]
    const bullets = buildCeoBullets(sectionTitle, topic, raw, tone)

    if (idx % 4 === 1) {
      slides.push({
        kind: 'image-text',
        title: sectionTitle,
        subtitle: topic?.subtitle,
        bullets: bullets.slice(0, 5),
        imageUrl: nextImg(),
        imageSide: idx % 8 === 1 ? 'right' : 'left',
      })
    } else if (idx % 4 === 2) {
      const mid = Math.ceil(bullets.length / 2)
      slides.push({
        kind: 'two-column',
        title: sectionTitle,
        leftTitle: 'Insights',
        leftBullets: bullets.slice(0, mid),
        rightTitle: 'Implications',
        rightBullets: bullets.slice(mid),
      })
    } else if (idx % 4 === 3 && bullets.length >= 3) {
      slides.push({
        kind: 'cards',
        title: sectionTitle,
        cards: bullets.slice(0, 3).map((b, i) => ({
          title: ['Priority', 'Action', 'Outcome'][i] || `Point ${i + 1}`,
          body: b,
        })),
      })
    } else {
      slides.push({
        kind: 'bullets',
        title: sectionTitle,
        subtitle: ceoSectionTag(sectionTitle),
        bullets: bullets.slice(0, 6),
      })
    }
  })

  // Timeline / roadmap
  slides.push({
    kind: 'timeline',
    title: tone === 'training' ? 'Learning path' : '90-day roadmap',
    timeline: buildTimeline(tone, title),
  })

  // Quote
  slides.push({
    kind: 'quote',
    title: 'Leadership takeaway',
    quote: insightFromPrompt(raw, title),
    attribution: author,
  })

  // Closing
  slides.push({
    kind: 'closing',
    title: tone === 'pitch' ? 'Partnership opportunity' : 'Thank you',
    subtitle:
      tone === 'pitch'
        ? 'Ready for next conversation'
        : 'Questions & discussion',
    bullets:
      tone === 'pitch'
        ? [
            'Align on success criteria',
            'Confirm pilot scope & owners',
            'Schedule decision checkpoint',
          ]
        : [
            'Confirm decisions and owners',
            'Share follow-up pack',
            'Book working session',
          ],
    imageUrl: nextImg(),
  })

  // Trim if over target
  while (slides.length > target + 2) {
    const idx = slides.findIndex(
      (s, i) => i > 3 && (s.kind === 'bullets' || s.kind === 'cards'),
    )
    if (idx === -1) break
    slides.splice(idx, 1)
  }

  return {
    title,
    subtitle: ceoSubtitle(tone, title),
    author,
    tagline: 'Confidential · Board materials',
    slides,
    imageKeywords: [title],
  }
}

function pickFramework(
  tone: string,
  topics: Topic[],
  raw: string,
): string[] {
  if (topics.length >= 6) {
    return topics.slice(0, 10).map((t) => t.title)
  }
  if (tone === 'pitch') return [...CEO_SECTIONS_PITCH]
  if (tone === 'report') return [...CEO_SECTIONS_REPORT]
  if (tone === 'training') return [...CEO_SECTIONS_TRAINING]
  if (/pitch|investor|fundrais|seed|series/i.test(raw)) return [...CEO_SECTIONS_PITCH]
  return [...CEO_SECTIONS_PRO]
}

function buildCeoBullets(
  section: string,
  topic: Topic | undefined,
  prompt: string,
  tone: string,
): string[] {
  const base =
    topic && topic.bullets.length
      ? topic.bullets
      : extractSentences(prompt).slice(0, 5)

  const polished = base.map((b) => polishBullet(b)).filter(Boolean)
  while (polished.length < 4) {
    polished.push(ceoFiller(section, polished.length, tone))
  }
  return polished.slice(0, 6)
}

function polishBullet(s: string): string {
  let t = s.replace(/^[-*•\d.)\s]+/, '').trim()
  if (!t) return ''
  if (t[0] === t[0].toLowerCase()) t = t[0].toUpperCase() + t.slice(1)
  if (t.length > 140) t = t.slice(0, 137) + '…'
  // Ensure executive tone
  if (!/[.!?]$/.test(t) && t.length > 40) t += '.'
  return t
}

function ceoFiller(section: string, i: number, tone: string): string {
  const s = section.toLowerCase()
  const bank: string[] = []
  if (/exec|overview|summary|brief/.test(s)) {
    bank.push(
      'Clear mandate from leadership with measurable outcomes.',
      'Priority aligned to growth, resilience, and customer value.',
      'Decision path defined for the next planning cycle.',
    )
  } else if (/problem|opportunity|context/.test(s)) {
    bank.push(
      'Material gap between current performance and ambition.',
      'Customer and market signals support urgent action.',
      'Cost of inaction compounds over the next 2–3 quarters.',
    )
  } else if (/solution|product|approach/.test(s)) {
    bank.push(
      'Differentiated approach that is executable with current capabilities.',
      'Phased delivery reduces risk while preserving speed.',
      'Integration points mapped to existing systems and teams.',
    )
  } else if (/market|position|competitive/.test(s)) {
    bank.push(
      'Attractive addressable market with room to lead in a focused segment.',
      'Positioning emphasizes outcomes, not features.',
      'Competitive response window is open now.',
    )
  } else if (/traction|proof|finding|performance/.test(s)) {
    bank.push(
      'Early indicators validate demand and willingness to pay.',
      'Unit economics improve with scale and focus.',
      'Proof points de-risk the next investment tranche.',
    )
  } else if (/financial|roi|invest/.test(s)) {
    bank.push(
      'Investment case anchored in payback and margin expansion.',
      'Scenario planning covers base, upside, and downside cases.',
      'Capital allocation prioritizes highest-ROI workstreams.',
    )
  } else if (/roadmap|milestone|path/.test(s)) {
    bank.push(
      'Near-term milestones create visible momentum.',
      'Dependencies and owners are explicit.',
      'Checkpoints enable course-correction without delay.',
    )
  } else if (/risk/.test(s)) {
    bank.push(
      'Top risks identified with named mitigations.',
      'Early-warning metrics monitored weekly.',
      'Contingency paths prepared for critical paths.',
    )
  } else if (/ask|next|decision|recommend/.test(s)) {
    bank.push(
      'Specific decisions requested from leadership today.',
      'Owners, budget, and timeline proposed for approval.',
      'Follow-up cadence established within two weeks.',
    )
  } else {
    bank.push(
      `Drive clarity on ${section.toLowerCase()} with accountable ownership.`,
      `Translate ${section.toLowerCase()} into measurable KPIs.`,
      `Sequence initiatives so value appears early.`,
      `Communicate progress in a board-ready format.`,
    )
  }
  return bank[i % bank.length]
}

function buildTimeline(
  tone: string,
  title: string,
): { when: string; what: string }[] {
  if (tone === 'training') {
    return [
      { when: 'Week 1', what: 'Foundations & expectations' },
      { when: 'Week 2', what: 'Tools & hands-on practice' },
      { when: 'Week 3', what: 'Scenarios & coaching' },
      { when: 'Week 4', what: 'Certification & enablement' },
    ]
  }
  return [
    { when: 'Days 1–30', what: `Mobilize team and baseline for ${title.slice(0, 40)}` },
    { when: 'Days 31–60', what: 'Deliver first value and instrument metrics' },
    { when: 'Days 61–90', what: 'Scale what works; lock operating cadence' },
    { when: 'Q+1', what: 'Expand scope with proven playbooks' },
  ]
}

function extractOrInventStats(
  prompt: string,
  title: string,
): { value: string; label: string }[] {
  const found: { value: string; label: string }[] = []
  const pct = prompt.match(/\b\d{1,3}(?:\.\d+)?%/g) || []
  pct.slice(0, 2).forEach((p, i) => {
    found.push({ value: p, label: ['Growth', 'Conversion'][i] || 'KPI' })
  })
  const money = prompt.match(/\$\s?\d[\d,]*(?:\.\d+)?[kKmMbB]?/g) || []
  money.slice(0, 2).forEach((m, i) => {
    found.push({
      value: m.replace(/\s/g, ''),
      label: ['Revenue', 'Pipeline'][i] || 'Value',
    })
  })
  if (found.length >= 3) return found.slice(0, 4)
  // Executive defaults (illustrative, clearly metric-style)
  const defaults = [
    { value: '3×', label: 'Focus areas' },
    { value: '90d', label: 'Execution window' },
    { value: '4', label: 'Workstreams' },
    { value: '1', label: 'North-star outcome' },
  ]
  return [...found, ...defaults].slice(0, 4)
}

function ceoSubtitle(tone: string, title: string): string {
  if (tone === 'pitch') return 'Investor & leadership briefing'
  if (tone === 'report') return 'Executive performance briefing'
  if (tone === 'training') return 'Leadership enablement session'
  return `Strategic presentation · ${title.slice(0, 36)}`
}

function ceoSectionTag(section: string): string {
  return 'Confidential · Leadership materials'
}

// ——— Optional AI (token) kept but not required ———

export async function enhanceOutlineWithXai(
  outline: DeckOutline,
  prompt: string,
  apiKey: string,
  onStatus?: (s: string) => void,
): Promise<DeckOutline> {
  const key = apiKey.trim()
  if (!key) return outline
  onStatus?.('Optional AI polish…')
  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'grok-3',
        temperature: 0.35,
        messages: [
          {
            role: 'system',
            content:
              'Return ONLY JSON with title, subtitle, author, slides[{kind,title,subtitle?,bullets?,stats?,cards?,quote?,timeline?}]. CEO-level concise language. 10-14 slides.',
          },
          {
            role: 'user',
            content: `Prompt:\n${prompt}\n\nDraft:\n${JSON.stringify(outline)}`,
          },
        ],
      }),
    })
    if (!res.ok) throw new Error(`API ${res.status}`)
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = data.choices?.[0]?.message?.content || ''
    const json = extractJson(content)
    if (!json?.slides?.length) throw new Error('No slides')
    return {
      ...outline,
      title: String(json.title || outline.title),
      subtitle: String(json.subtitle || outline.subtitle),
      author: String(json.author || outline.author),
      slides: json.slides as DeckSlide[],
    }
  } catch (e) {
    onStatus?.(
      e instanceof Error
        ? `AI polish skipped: ${e.message}`
        : 'AI polish skipped',
    )
    return outline
  }
}

function extractJson(text: string): DeckOutline | null {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim()
  try {
    return JSON.parse(cleaned) as DeckOutline
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/)
    if (!m) return null
    try {
      return JSON.parse(m[0]) as DeckOutline
    } catch {
      return null
    }
  }
}

// ——— Build PPTX with images ———

async function fetchImageAsBase64(
  url: string,
): Promise<{ data: string; ext: 'jpg' | 'png' } | null> {
  try {
    const res = await fetch(url, { mode: 'cors' })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
    const b64 = btoa(binary)
    const ext = url.includes('.png') ? 'png' : 'jpg'
    return { data: b64, ext }
  } catch {
    return null
  }
}

export async function buildPptx(
  outline: DeckOutline,
  themeId: PptThemeId = 'boardroom',
  onStatus?: (s: string) => void,
): Promise<Blob> {
  const theme = getTheme(themeId)
  const pptx = new PptxGenJS()
  pptx.author = outline.author
  pptx.title = outline.title
  pptx.subject = outline.subtitle
  pptx.company = 'dragonPDF'
  pptx.defineLayout({ name: 'LAYOUT_16x9', width: 13.333, height: 7.5 })
  pptx.layout = 'LAYOUT_16x9'

  // Preload unique images
  const urls = [
    ...new Set(
      outline.slides.map((s) => s.imageUrl).filter(Boolean) as string[],
    ),
  ]
  const imageCache = new Map<string, { data: string; ext: 'jpg' | 'png' }>()
  onStatus?.(`Loading ${urls.length} executive visuals…`)
  await Promise.all(
    urls.map(async (url, i) => {
      const img = await fetchImageAsBase64(url)
      if (img) imageCache.set(url, img)
      onStatus?.(`Visual ${i + 1}/${urls.length} ready`)
    }),
  )

  const addImage = (
    s: PptxGenJS.Slide,
    url: string | undefined,
    opts: { x: number; y: number; w: number; h: number },
  ) => {
    if (!url) return
    const img = imageCache.get(url)
    if (!img) return
    try {
      s.addImage({
        data: `image/${img.ext};base64,${img.data}`,
        x: opts.x,
        y: opts.y,
        w: opts.w,
        h: opts.h,
      })
    } catch {
      /* skip broken image */
    }
  }

  for (const slide of outline.slides) {
    const s = pptx.addSlide()
    s.background = { color: theme.bg }

    // Gold accent rail
    s.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 0.1,
      h: 7.5,
      fill: { color: theme.accent },
      line: { color: theme.accent },
    })

    if (slide.kind === 'title') {
      // Full visual left panel
      if (slide.imageUrl && imageCache.has(slide.imageUrl)) {
        addImage(s, slide.imageUrl, { x: 0.1, y: 0, w: 6.2, h: 7.5 })
        s.addShape(pptx.ShapeType.rect, {
          x: 0.1,
          y: 0,
          w: 6.2,
          h: 7.5,
          fill: { color: theme.bg, transparency: 45 },
          line: { color: theme.bg, transparency: 100 },
        })
      } else {
        s.addShape(pptx.ShapeType.rect, {
          x: 0.1,
          y: 0,
          w: 6.2,
          h: 7.5,
          fill: { color: theme.bgAlt },
          line: { color: theme.bgAlt },
        })
      }
      s.addText(outline.tagline || 'CONFIDENTIAL', {
        x: 6.7,
        y: 1.6,
        w: 6,
        h: 0.35,
        fontSize: 11,
        fontFace: 'Arial',
        color: theme.accent,
        bold: true,
        charSpacing: 3,
      })
      s.addText(slide.title, {
        x: 6.7,
        y: 2.2,
        w: 6,
        h: 1.8,
        fontSize: 36,
        fontFace: 'Arial',
        bold: true,
        color: theme.text,
        margin: 0,
        valign: 'top',
      })
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 6.7,
          y: 4.2,
          w: 6,
          h: 0.5,
          fontSize: 16,
          fontFace: 'Arial',
          color: theme.accent2,
        })
      }
      s.addShape(pptx.ShapeType.rect, {
        x: 6.7,
        y: 4.9,
        w: 1.2,
        h: 0.06,
        fill: { color: theme.accent },
        line: { color: theme.accent },
      })
      s.addText(outline.author, {
        x: 6.7,
        y: 5.3,
        w: 6,
        h: 0.4,
        fontSize: 14,
        fontFace: 'Arial',
        color: theme.muted,
      })
      continue
    }

    if (slide.kind === 'closing') {
      if (slide.imageUrl && imageCache.has(slide.imageUrl)) {
        addImage(s, slide.imageUrl, { x: 0.1, y: 0, w: 13.233, h: 7.5 })
        s.addShape(pptx.ShapeType.rect, {
          x: 0.1,
          y: 0,
          w: 13.233,
          h: 7.5,
          fill: { color: theme.bg, transparency: 35 },
          line: { color: theme.bg, transparency: 100 },
        })
      }
      s.addText(slide.title, {
        x: 1,
        y: 2.3,
        w: 11.3,
        h: 1,
        fontSize: 40,
        fontFace: 'Arial',
        bold: true,
        color: theme.text,
        align: 'center',
      })
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 1,
          y: 3.4,
          w: 11.3,
          h: 0.45,
          fontSize: 18,
          fontFace: 'Arial',
          color: theme.accent2,
          align: 'center',
        })
      }
      if (slide.bullets?.length) {
        s.addText(
          slide.bullets.map((b) => ({ text: b, options: { bullet: false } })),
          {
            x: 3.5,
            y: 4.2,
            w: 6.3,
            h: 2,
            fontSize: 15,
            fontFace: 'Arial',
            color: theme.muted,
            align: 'center',
            paraSpaceAfter: 10,
          },
        )
      }
      continue
    }

    // Standard header for content slides
    s.addText(slide.title, {
      x: 0.55,
      y: 0.35,
      w: 12.2,
      h: 0.65,
      fontSize: 26,
      fontFace: 'Arial',
      bold: true,
      color: theme.text,
    })
    if (slide.subtitle) {
      s.addText(slide.subtitle, {
        x: 0.55,
        y: 0.95,
        w: 12.2,
        h: 0.35,
        fontSize: 12,
        fontFace: 'Arial',
        color: theme.muted,
      })
    }
    s.addShape(pptx.ShapeType.rect, {
      x: 0.55,
      y: 1.35,
      w: 1.4,
      h: 0.05,
      fill: { color: theme.accent },
      line: { color: theme.accent },
    })

    if (slide.kind === 'agenda') {
      const items = slide.bullets || []
      items.forEach((b, i) => {
        const col = i < 5 ? 0 : 1
        const row = i < 5 ? i : i - 5
        const x = 0.7 + col * 6.2
        const y = 1.7 + row * 0.95
        s.addShape(pptx.ShapeType.roundRect, {
          x,
          y,
          w: 5.8,
          h: 0.8,
          fill: { color: theme.card },
          line: { color: theme.card },
          rectRadius: 0.08,
        })
        s.addText(b, {
          x: x + 0.25,
          y: y + 0.18,
          w: 5.3,
          h: 0.45,
          fontSize: 14,
          fontFace: 'Arial',
          color: theme.text,
          bold: true,
        })
      })
      continue
    }

    if (slide.kind === 'stats' && slide.stats?.length) {
      const n = Math.min(4, slide.stats.length)
      const cardW = 2.85
      const gap = 0.3
      const totalW = n * cardW + (n - 1) * gap
      const startX = (13.333 - totalW) / 2
      slide.stats.slice(0, n).forEach((st, i) => {
        const x = startX + i * (cardW + gap)
        s.addShape(pptx.ShapeType.roundRect, {
          x,
          y: 2.0,
          w: cardW,
          h: 3.2,
          fill: { color: theme.card },
          line: { color: theme.card },
          rectRadius: 0.1,
        })
        s.addText(st.value, {
          x,
          y: 2.5,
          w: cardW,
          h: 1.1,
          fontSize: 36,
          fontFace: 'Arial',
          bold: true,
          color: theme.accent2,
          align: 'center',
        })
        s.addText(st.label, {
          x: x + 0.15,
          y: 3.8,
          w: cardW - 0.3,
          h: 0.8,
          fontSize: 13,
          fontFace: 'Arial',
          color: theme.muted,
          align: 'center',
        })
      })
      continue
    }

    if (slide.kind === 'image-text') {
      const side = slide.imageSide || 'right'
      const imgX = side === 'right' ? 7.4 : 0.5
      const textX = side === 'right' ? 0.55 : 6.9
      if (slide.imageUrl && imageCache.has(slide.imageUrl)) {
        addImage(s, slide.imageUrl, { x: imgX, y: 1.6, w: 5.4, h: 5.3 })
        s.addShape(pptx.ShapeType.roundRect, {
          x: imgX,
          y: 1.6,
          w: 5.4,
          h: 5.3,
          fill: { type: 'none' },
          line: { color: theme.card, width: 0 },
          rectRadius: 0.08,
        })
      } else {
        s.addShape(pptx.ShapeType.roundRect, {
          x: imgX,
          y: 1.6,
          w: 5.4,
          h: 5.3,
          fill: { color: theme.card },
          line: { color: theme.card },
          rectRadius: 0.08,
        })
      }
      s.addText(
        (slide.bullets || []).map((b) => ({ text: b, options: { bullet: true } })),
        {
          x: textX,
          y: 1.7,
          w: 5.6,
          h: 5,
          fontSize: 15,
          fontFace: 'Arial',
          color: theme.text,
          paraSpaceAfter: 10,
          valign: 'top',
        },
      )
      continue
    }

    if (slide.kind === 'two-column') {
      const col = (
        x: number,
        title: string,
        bullets: string[],
      ) => {
        s.addShape(pptx.ShapeType.roundRect, {
          x,
          y: 1.65,
          w: 5.9,
          h: 5.2,
          fill: { color: theme.card },
          line: { color: theme.card },
          rectRadius: 0.1,
        })
        s.addText(title, {
          x: x + 0.3,
          y: 1.9,
          w: 5.3,
          h: 0.4,
          fontSize: 14,
          bold: true,
          fontFace: 'Arial',
          color: theme.accent2,
        })
        s.addText(
          bullets.map((b) => ({ text: b, options: { bullet: true } })),
          {
            x: x + 0.3,
            y: 2.5,
            w: 5.3,
            h: 4,
            fontSize: 14,
            fontFace: 'Arial',
            color: theme.text,
            paraSpaceAfter: 8,
          },
        )
      }
      col(0.55, slide.leftTitle || 'Insights', slide.leftBullets || [])
      col(6.85, slide.rightTitle || 'Implications', slide.rightBullets || [])
      continue
    }

    if (slide.kind === 'cards' && slide.cards?.length) {
      const n = Math.min(3, slide.cards.length)
      const cardW = 3.8
      const gap = 0.3
      const startX = 0.7
      slide.cards.slice(0, n).forEach((c, i) => {
        const x = startX + i * (cardW + gap)
        s.addShape(pptx.ShapeType.roundRect, {
          x,
          y: 1.8,
          w: cardW,
          h: 4.8,
          fill: { color: theme.card },
          line: { color: theme.card },
          rectRadius: 0.1,
        })
        s.addShape(pptx.ShapeType.ellipse, {
          x: x + 0.3,
          y: 2.15,
          w: 0.45,
          h: 0.45,
          fill: { color: theme.accent },
          line: { color: theme.accent },
        })
        s.addText(String(i + 1), {
          x: x + 0.3,
          y: 2.2,
          w: 0.45,
          h: 0.4,
          fontSize: 14,
          bold: true,
          color: theme.bg,
          align: 'center',
          fontFace: 'Arial',
        })
        s.addText(c.title, {
          x: x + 0.3,
          y: 2.9,
          w: cardW - 0.6,
          h: 0.5,
          fontSize: 16,
          bold: true,
          fontFace: 'Arial',
          color: theme.accent2,
        })
        s.addText(c.body, {
          x: x + 0.3,
          y: 3.55,
          w: cardW - 0.6,
          h: 2.6,
          fontSize: 13,
          fontFace: 'Arial',
          color: theme.text,
          valign: 'top',
        })
      })
      continue
    }

    if (slide.kind === 'timeline' && slide.timeline?.length) {
      const items = slide.timeline.slice(0, 4)
      const step = 12 / items.length
      items.forEach((t, i) => {
        const x = 0.7 + i * step
        s.addShape(pptx.ShapeType.ellipse, {
          x: x + step / 2 - 0.18,
          y: 3.2,
          w: 0.36,
          h: 0.36,
          fill: { color: theme.accent },
          line: { color: theme.accent },
        })
        if (i < items.length - 1) {
          s.addShape(pptx.ShapeType.rect, {
            x: x + step / 2 + 0.2,
            y: 3.35,
            w: step - 0.4,
            h: 0.06,
            fill: { color: theme.accent2 },
            line: { color: theme.accent2 },
          })
        }
        s.addText(t.when, {
          x,
          y: 2.3,
          w: step - 0.2,
          h: 0.4,
          fontSize: 13,
          bold: true,
          color: theme.accent2,
          align: 'center',
          fontFace: 'Arial',
        })
        s.addText(t.what, {
          x,
          y: 3.9,
          w: step - 0.2,
          h: 1.8,
          fontSize: 13,
          color: theme.text,
          align: 'center',
          fontFace: 'Arial',
        })
      })
      continue
    }

    if (slide.kind === 'quote') {
      s.addText(`“${slide.quote || ''}”`, {
        x: 1.2,
        y: 2.4,
        w: 10.8,
        h: 2.4,
        fontSize: 26,
        fontFace: 'Georgia',
        italic: true,
        color: theme.text,
        align: 'center',
      })
      if (slide.attribution) {
        s.addText(`— ${slide.attribution}`, {
          x: 1.2,
          y: 5.1,
          w: 10.8,
          h: 0.4,
          fontSize: 14,
          fontFace: 'Arial',
          color: theme.muted,
          align: 'center',
        })
      }
      continue
    }

    // Default bullets
    s.addText(
      (slide.bullets || []).map((b) => ({ text: b, options: { bullet: true } })),
      {
        x: 0.7,
        y: 1.7,
        w: 11.8,
        h: 5.2,
        fontSize: 16,
        fontFace: 'Arial',
        color: theme.text,
        paraSpaceAfter: 12,
        valign: 'top',
      },
    )
  }

  const out = await pptx.write({ outputType: 'blob' })
  return out as Blob
}

// ——— Text helpers ———

type Topic = {
  title: string
  subtitle?: string
  bullets: string[]
  stats?: { value: string; label: string }[]
}

function extractTitle(raw: string): string {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  let title = lines[0] || 'Strategic Presentation'
  if (title.length > 80 || /[.!?]/.test(title)) {
    title = firstSentence(raw).slice(0, 90)
  }
  return cleanTitle(title)
}

function firstSentence(text: string): string {
  const m = text.match(/^[^.!?\n]+[.!?]?/)
  return (m?.[0] || text).trim()
}

function cleanTitle(t: string): string {
  return t
    .replace(/^#+\s*/, '')
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)
}

function extractTopics(body: string, mainTitle: string): Topic[] {
  const topics: Topic[] = []
  const bulletLines = body
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => /^[-*•]\s+|^\d+[.)]\s+/.test(l))
    .map((l) => l.replace(/^[-*•]\s+|^\d+[.)]\s+/, '').trim())
    .filter(Boolean)

  if (bulletLines.length >= 3) {
    for (let i = 0; i < bulletLines.length; i += 4) {
      const chunk = bulletLines.slice(i, i + 4)
      topics.push({
        title: cleanTitle(chunk[0].slice(0, 55)),
        bullets: chunk.map((c) => polishBullet(c)),
      })
    }
  }

  const paras = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 40)

  for (const para of paras) {
    if (topics.length >= 10) break
    const sentences = extractSentences(para)
    if (!sentences.length) continue
    const tTitle = cleanTitle(sentences[0].replace(/[.!?]$/, '')).slice(0, 70)
    if (tTitle.toLowerCase() === mainTitle.toLowerCase()) continue
    topics.push({
      title: tTitle || 'Key insight',
      bullets: sentences.slice(1, 6).map((s) => polishBullet(s)),
    })
  }

  if (!topics.length) {
    const sents = extractSentences(body)
    topics.push(
      {
        title: 'Strategic context',
        bullets: (sents.slice(0, 4).length
          ? sents.slice(0, 4)
          : [firstSentence(body)]
        ).map((s) => polishBullet(s)),
      },
      {
        title: 'Priorities',
        bullets: [
          'Focus leadership attention on the highest-leverage outcomes.',
          'Sequence initiatives for early, visible progress.',
          'Assign single-threaded ownership for each workstream.',
        ],
      },
      {
        title: 'Execution',
        bullets: [
          'Operate on a 90-day cadence with clear checkpoints.',
          'Instrument leading indicators, not only lagging results.',
          'Escalate blockers within one business week.',
        ],
      },
    )
  }

  return topics
}

function insightFromPrompt(raw: string, title: string): string {
  const s = firstSentence(raw)
  if (s.length > 40 && s.length < 180) return s
  return `Winning on ${title} requires focus, speed, and disciplined capital allocation—executed with clear ownership.`
}
