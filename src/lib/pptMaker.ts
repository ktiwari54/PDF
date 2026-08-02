/**
 * dragonPDF PPT Maker — prompt → professional .pptx
 */
import PptxGenJS from 'pptxgenjs'

export type SlideKind =
  | 'title'
  | 'section'
  | 'bullets'
  | 'two-column'
  | 'quote'
  | 'stats'
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
  notes?: string
}

export type DeckOutline = {
  title: string
  subtitle: string
  author: string
  slides: DeckSlide[]
}

export type PptThemeId = 'dragon' | 'corporate' | 'midnight' | 'ocean' | 'forest'

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
    text: 'FAFAFA',
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

/** Build a professional deck outline from a free-form prompt (works offline). */
export function outlineFromPrompt(
  prompt: string,
  opts?: {
    slideCount?: number | 'auto'
    author?: string
    tone?: 'professional' | 'pitch' | 'training' | 'report'
  },
): DeckOutline {
  const raw = prompt.trim()
  if (!raw) throw new Error('Enter a prompt describing your presentation.')

  const tone = opts?.tone || 'professional'
  const author = opts?.author?.trim() || 'dragonPDF'
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

  // Title: first line if short, else first sentence
  let title = lines[0] || 'Presentation'
  if (title.length > 80 || /[.!?]/.test(title)) {
    title = firstSentence(raw).slice(0, 90)
  }
  title = cleanTitle(title)

  const body = lines.length > 1 ? lines.slice(1).join('\n') : raw
  const topics = extractTopics(body, title)
  const target =
    opts?.slideCount === 'auto' || !opts?.slideCount
      ? Math.min(12, Math.max(6, topics.length + 3))
      : Math.min(16, Math.max(4, opts.slideCount))

  const slides: DeckSlide[] = []

  // 1. Title
  slides.push({
    kind: 'title',
    title,
    subtitle: subtitleForTone(tone, title),
    notes: `Generated from prompt · ${tone}`,
  })

  // 2. Agenda
  const agendaItems = topics.slice(0, Math.min(7, topics.length)).map((t, i) => {
    const label = t.title
    return `${i + 1}. ${label}`
  })
  if (agendaItems.length >= 2) {
    slides.push({
      kind: 'bullets',
      title: tone === 'pitch' ? 'What we’ll cover' : 'Agenda',
      bullets: agendaItems,
    })
  }

  // 3. Content from topics
  const contentSlots = Math.max(1, target - 3) // leave room for title, agenda, close
  const usedTopics = topics.slice(0, contentSlots)

  usedTopics.forEach((topic, idx) => {
    if (topic.bullets.length >= 4 && idx % 3 === 2) {
      const mid = Math.ceil(topic.bullets.length / 2)
      slides.push({
        kind: 'two-column',
        title: topic.title,
        leftTitle: 'Key points',
        leftBullets: topic.bullets.slice(0, mid),
        rightTitle: 'Details',
        rightBullets: topic.bullets.slice(mid),
      })
    } else if (topic.stats && topic.stats.length >= 2) {
      slides.push({
        kind: 'stats',
        title: topic.title,
        stats: topic.stats,
        bullets: topic.bullets.slice(0, 3),
      })
    } else {
      slides.push({
        kind: 'bullets',
        title: topic.title,
        subtitle: topic.subtitle,
        bullets:
          topic.bullets.length > 0
            ? topic.bullets.slice(0, 7)
            : [
                expandPoint(topic.title, tone, 0),
                expandPoint(topic.title, tone, 1),
                expandPoint(topic.title, tone, 2),
              ],
      })
    }
  })

  // Quote / insight if pitch
  if (tone === 'pitch' && slides.length < target) {
    slides.push({
      kind: 'quote',
      title: 'The opportunity',
      quote: insightFromPrompt(raw, title),
      attribution: author,
    })
  }

  // Closing
  slides.push({
    kind: 'closing',
    title: tone === 'pitch' ? 'Let’s talk' : 'Thank you',
    subtitle:
      tone === 'training'
        ? 'Questions & discussion'
        : tone === 'pitch'
          ? 'Next steps & contact'
          : 'Questions welcome',
    bullets:
      tone === 'pitch'
        ? ['Schedule a follow-up', 'Share materials', 'Align on next milestone']
        : ['Recap key takeaways', 'Open Q&A', 'Share resources'],
  })

  // Trim or pad to target roughly
  while (slides.length > target + 1) {
    // remove middle content slides first
    const idx = slides.findIndex((s, i) => i > 1 && s.kind === 'bullets')
    if (idx === -1) break
    slides.splice(idx, 1)
  }

  return {
    title,
    subtitle: subtitleForTone(tone, title),
    author,
    slides,
  }
}

/**
 * Optional: improve outline with xAI (SpaceXAI) if user provides API key.
 * Key stays in the browser only if they paste it — never hardcoded.
 */
export async function enhanceOutlineWithXai(
  outline: DeckOutline,
  prompt: string,
  apiKey: string,
  onStatus?: (s: string) => void,
): Promise<DeckOutline> {
  const key = apiKey.trim()
  if (!key) return outline

  onStatus?.('Enhancing deck with AI…')
  const system = `You are an expert presentation designer. Return ONLY valid JSON matching this TypeScript type:
{
  "title": string,
  "subtitle": string,
  "author": string,
  "slides": Array<{
    "kind": "title"|"section"|"bullets"|"two-column"|"quote"|"stats"|"closing",
    "title": string,
    "subtitle"?: string,
    "bullets"?: string[],
    "leftTitle"?: string,
    "leftBullets"?: string[],
    "rightTitle"?: string,
    "rightBullets"?: string[],
    "quote"?: string,
    "attribution"?: string,
    "stats"?: {"value": string, "label": string}[]
  }>
}
Rules: 6-12 slides, professional concise bullets (max 7 per slide), no markdown, no code fences.`

  const user = `Original prompt:\n${prompt}\n\nDraft outline JSON to improve:\n${JSON.stringify(outline)}`

  try {
    const res = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'grok-3',
        temperature: 0.4,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`AI API ${res.status}: ${errText.slice(0, 200)}`)
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const content = data.choices?.[0]?.message?.content || ''
    const json = extractJson(content)
    if (!json?.slides?.length) throw new Error('AI returned no slides')
    return {
      title: String(json.title || outline.title),
      subtitle: String(json.subtitle || outline.subtitle),
      author: String(json.author || outline.author),
      slides: json.slides as DeckSlide[],
    }
  } catch (e) {
    onStatus?.(
      e instanceof Error
        ? `AI enhance skipped: ${e.message}. Using local outline.`
        : 'AI enhance skipped. Using local outline.',
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

/** Build and download a .pptx from outline + theme */
export async function buildPptx(
  outline: DeckOutline,
  themeId: PptThemeId = 'dragon',
): Promise<Blob> {
  const theme = getTheme(themeId)
  const pptx = new PptxGenJS()
  pptx.author = outline.author
  pptx.title = outline.title
  pptx.subject = outline.subtitle
  pptx.company = 'dragonPDF'
  pptx.defineLayout({ name: 'LAYOUT_16x9', width: 13.333, height: 7.5 })
  pptx.layout = 'LAYOUT_16x9'

  for (const slide of outline.slides) {
    const s = pptx.addSlide()
    s.background = { color: theme.bg }

    // Accent bar
    s.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 0.12,
      h: 7.5,
      fill: { color: theme.accent },
      line: { color: theme.accent },
    })

    if (slide.kind === 'title') {
      s.addShape(pptx.ShapeType.rect, {
        x: 0.12,
        y: 0,
        w: 13.213,
        h: 7.5,
        fill: { color: theme.bgAlt },
        line: { color: theme.bgAlt },
      })
      s.addShape(pptx.ShapeType.rect, {
        x: 0.12,
        y: 5.8,
        w: 13.213,
        h: 1.7,
        fill: { color: theme.card },
        line: { color: theme.card },
      })
      s.addText(slide.title, {
        x: 0.8,
        y: 2.2,
        w: 11.5,
        h: 1.4,
        fontSize: 40,
        fontFace: 'Arial',
        bold: true,
        color: theme.text,
        margin: 0,
      })
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 0.8,
          y: 3.7,
          w: 11.5,
          h: 0.6,
          fontSize: 18,
          fontFace: 'Arial',
          color: theme.accent2,
        })
      }
      s.addText(`${outline.author}  ·  dragonPDF`, {
        x: 0.8,
        y: 6.3,
        w: 11.5,
        h: 0.4,
        fontSize: 14,
        fontFace: 'Arial',
        color: theme.muted,
      })
      continue
    }

    if (slide.kind === 'closing') {
      s.addShape(pptx.ShapeType.rect, {
        x: 0.12,
        y: 0,
        w: 13.213,
        h: 7.5,
        fill: { color: theme.bgAlt },
        line: { color: theme.bgAlt },
      })
      s.addText(slide.title, {
        x: 0.8,
        y: 2.4,
        w: 11.5,
        h: 1,
        fontSize: 40,
        fontFace: 'Arial',
        bold: true,
        color: theme.text,
        align: 'center',
      })
      if (slide.subtitle) {
        s.addText(slide.subtitle, {
          x: 0.8,
          y: 3.5,
          w: 11.5,
          h: 0.5,
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
            y: 4.4,
            w: 6.5,
            h: 2,
            fontSize: 16,
            fontFace: 'Arial',
            color: theme.muted,
            align: 'center',
            paraSpaceAfter: 10,
          },
        )
      }
      continue
    }

    if (slide.kind === 'quote') {
      s.addText(slide.title, {
        x: 0.7,
        y: 0.45,
        w: 12,
        h: 0.55,
        fontSize: 14,
        fontFace: 'Arial',
        color: theme.accent,
        bold: true,
      })
      s.addText(`“${slide.quote || ''}”`, {
        x: 1.2,
        y: 2.2,
        w: 10.8,
        h: 2.5,
        fontSize: 28,
        fontFace: 'Georgia',
        italic: true,
        color: theme.text,
        align: 'center',
      })
      if (slide.attribution) {
        s.addText(`— ${slide.attribution}`, {
          x: 1.2,
          y: 5.0,
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

    if (slide.kind === 'stats' && slide.stats?.length) {
      s.addText(slide.title, {
        x: 0.7,
        y: 0.4,
        w: 12,
        h: 0.7,
        fontSize: 28,
        fontFace: 'Arial',
        bold: true,
        color: theme.text,
      })
      const n = Math.min(4, slide.stats.length)
      const cardW = 2.8
      const gap = 0.35
      const totalW = n * cardW + (n - 1) * gap
      const startX = (13.333 - totalW) / 2
      slide.stats.slice(0, n).forEach((st, i) => {
        const x = startX + i * (cardW + gap)
        s.addShape(pptx.ShapeType.roundRect, {
          x,
          y: 2.0,
          w: cardW,
          h: 2.8,
          fill: { color: theme.card },
          line: { color: theme.card },
          shadow: {
            type: 'outer',
            color: '000000',
            blur: 8,
            offset: 3,
            opacity: 0.25,
          },
        })
        s.addText(st.value, {
          x,
          y: 2.4,
          w: cardW,
          h: 1,
          fontSize: 32,
          fontFace: 'Arial',
          bold: true,
          color: theme.accent2,
          align: 'center',
        })
        s.addText(st.label, {
          x: x + 0.15,
          y: 3.5,
          w: cardW - 0.3,
          h: 0.9,
          fontSize: 13,
          fontFace: 'Arial',
          color: theme.muted,
          align: 'center',
        })
      })
      if (slide.bullets?.length) {
        s.addText(slide.bullets.map((b) => ({ text: b, options: { bullet: true } })), {
          x: 0.9,
          y: 5.2,
          w: 11.5,
          h: 1.8,
          fontSize: 14,
          fontFace: 'Arial',
          color: theme.text,
          paraSpaceAfter: 6,
        })
      }
      continue
    }

    if (slide.kind === 'two-column') {
      s.addText(slide.title, {
        x: 0.7,
        y: 0.4,
        w: 12,
        h: 0.7,
        fontSize: 28,
        fontFace: 'Arial',
        bold: true,
        color: theme.text,
      })
      // left card
      s.addShape(pptx.ShapeType.roundRect, {
        x: 0.7,
        y: 1.4,
        w: 5.7,
        h: 5.3,
        fill: { color: theme.card },
        line: { color: theme.card },
      })
      s.addText(slide.leftTitle || 'Overview', {
        x: 1.0,
        y: 1.65,
        w: 5.1,
        h: 0.45,
        fontSize: 16,
        bold: true,
        fontFace: 'Arial',
        color: theme.accent2,
      })
      s.addText(
        (slide.leftBullets || []).map((b) => ({
          text: b,
          options: { bullet: true },
        })),
        {
          x: 1.0,
          y: 2.3,
          w: 5.1,
          h: 4.0,
          fontSize: 15,
          fontFace: 'Arial',
          color: theme.text,
          paraSpaceAfter: 8,
        },
      )
      // right card
      s.addShape(pptx.ShapeType.roundRect, {
        x: 6.8,
        y: 1.4,
        w: 5.7,
        h: 5.3,
        fill: { color: theme.card },
        line: { color: theme.card },
      })
      s.addText(slide.rightTitle || 'Details', {
        x: 7.1,
        y: 1.65,
        w: 5.1,
        h: 0.45,
        fontSize: 16,
        bold: true,
        fontFace: 'Arial',
        color: theme.accent2,
      })
      s.addText(
        (slide.rightBullets || []).map((b) => ({
          text: b,
          options: { bullet: true },
        })),
        {
          x: 7.1,
          y: 2.3,
          w: 5.1,
          h: 4.0,
          fontSize: 15,
          fontFace: 'Arial',
          color: theme.text,
          paraSpaceAfter: 8,
        },
      )
      continue
    }

    // Default bullets / section
    s.addText(slide.title, {
      x: 0.7,
      y: 0.4,
      w: 12,
      h: 0.75,
      fontSize: 28,
      fontFace: 'Arial',
      bold: true,
      color: theme.text,
    })
    if (slide.subtitle) {
      s.addText(slide.subtitle, {
        x: 0.7,
        y: 1.15,
        w: 12,
        h: 0.4,
        fontSize: 14,
        fontFace: 'Arial',
        color: theme.muted,
      })
    }
    const bullets = slide.bullets || []
    s.addText(
      bullets.map((b) => ({ text: b, options: { bullet: true } })),
      {
        x: 0.9,
        y: slide.subtitle ? 1.8 : 1.5,
        w: 11.5,
        h: 5.2,
        fontSize: 18,
        fontFace: 'Arial',
        color: theme.text,
        paraSpaceAfter: 12,
        valign: 'top',
      },
    )
  }

  // pptxgenjs write returns blob in browser when type is 'blob'
  const out = await pptx.write({ outputType: 'blob' })
  return out as Blob
}

// ——— helpers ———

type Topic = {
  title: string
  subtitle?: string
  bullets: string[]
  stats?: { value: string; label: string }[]
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

function subtitleForTone(
  tone: string,
  title: string,
): string {
  if (tone === 'pitch') return 'Investor & stakeholder overview'
  if (tone === 'training') return 'Training workshop'
  if (tone === 'report') return 'Executive briefing'
  return `Professional presentation · ${title.slice(0, 40)}`
}

function extractTopics(body: string, mainTitle: string): Topic[] {
  const topics: Topic[] = []

  // Numbered or bulleted blocks
  const bulletLines = body
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => /^[-*•]\s+|^\d+[.)]\s+/.test(l))
    .map((l) => l.replace(/^[-*•]\s+|^\d+[.)]\s+/, '').trim())
    .filter(Boolean)

  if (bulletLines.length >= 3) {
    // Group into chunks of 3–5
    for (let i = 0; i < bulletLines.length; i += 4) {
      const chunk = bulletLines.slice(i, i + 4)
      topics.push({
        title: topicTitleFromBullets(chunk, i / 4),
        bullets: chunk.map((c) => ensureBullet(c)),
      })
    }
  }

  // Paragraphs as topics
  const paras = body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 40)

  for (const para of paras) {
    if (topics.length >= 10) break
    const sentences = para
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 15)
    if (!sentences.length) continue
    const tTitle = cleanTitle(sentences[0].replace(/[.!?]$/, '')).slice(0, 70)
    if (tTitle.toLowerCase() === mainTitle.toLowerCase()) continue
    topics.push({
      title: tTitle || 'Key insight',
      bullets: sentences.slice(1, 6).map((s) => ensureBullet(s)) ,
      stats: extractStats(para),
    })
  }

  // Keyword sections from free text
  if (topics.length < 3) {
    const keywords = [
      'Overview',
      'Problem',
      'Solution',
      'Market',
      'Strategy',
      'Benefits',
      'Implementation',
      'Results',
      'Risks',
      'Next steps',
    ]
    const words = body.split(/\s+/).filter(Boolean)
    const sliceSize = Math.max(20, Math.floor(words.length / 5))
    for (let i = 0; i < 5; i++) {
      const slice = words.slice(i * sliceSize, (i + 1) * sliceSize).join(' ')
      if (!slice) continue
      topics.push({
        title: keywords[i] || `Topic ${i + 1}`,
        bullets: [
          ensureBullet(firstSentence(slice)),
          expandPoint(keywords[i] || mainTitle, 'professional', 0),
          expandPoint(keywords[i] || mainTitle, 'professional', 1),
          expandPoint(keywords[i] || mainTitle, 'professional', 2),
        ],
        stats: i === 1 ? extractStats(body) : undefined,
      })
    }
  }

  // Ensure minimum
  if (!topics.length) {
    topics.push(
      {
        title: 'Overview',
        bullets: [
          ensureBullet(firstSentence(body)),
          'Context and goals for this discussion',
          'Key stakeholders and success criteria',
        ],
      },
      {
        title: 'Key points',
        bullets: body
          .split(/(?<=[.!?])\s+/)
          .slice(0, 5)
          .map((s) => ensureBullet(s)),
      },
      {
        title: 'Recommendations',
        bullets: [
          'Prioritize high-impact actions',
          'Align resources with stated goals',
          'Define owners and timelines',
        ],
      },
    )
  }

  return topics
}

function topicTitleFromBullets(chunk: string[], index: number): string {
  const first = chunk[0] || `Topic ${index + 1}`
  if (first.length <= 55) return cleanTitle(first)
  return cleanTitle(first.slice(0, 52) + '…')
}

function ensureBullet(s: string): string {
  let t = s.replace(/^[-*•]\s+/, '').trim()
  if (t.length > 140) t = t.slice(0, 137) + '…'
  // Capitalize
  if (t && t[0] === t[0].toLowerCase()) {
    t = t[0].toUpperCase() + t.slice(1)
  }
  return t
}

function expandPoint(topic: string, _tone: string, i: number): string {
  const templates = [
    `Clarify objectives related to ${topic}`,
    `Identify risks and dependencies for ${topic}`,
    `Define measurable outcomes for ${topic}`,
    `Align stakeholders on ${topic}`,
    `Outline next actions for ${topic}`,
  ]
  return templates[i % templates.length]
}

function extractStats(
  text: string,
): { value: string; label: string }[] | undefined {
  const found: { value: string; label: string }[] = []
  const pct = text.match(/\b\d{1,3}(?:\.\d+)?%\b/g) || []
  pct.slice(0, 3).forEach((p, i) => {
    found.push({ value: p, label: ['Growth', 'Share', 'Target'][i] || 'Metric' })
  })
  const money = text.match(/\$\s?\d[\d,]*(?:\.\d+)?[kKmMbB]?/g) || []
  money.slice(0, 2).forEach((m, i) => {
    found.push({ value: m.replace(/\s/g, ''), label: ['Revenue', 'Budget'][i] || 'Value' })
  })
  return found.length >= 2 ? found.slice(0, 4) : undefined
}

function insightFromPrompt(raw: string, title: string): string {
  const s = firstSentence(raw)
  if (s.length > 30 && s.length < 160) return s
  return `${title} represents a clear opportunity to create measurable impact with focused execution.`
}
