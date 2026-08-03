/**
 * dragonPDF — Dragon PPT
 * One prompt → board-ready .pptx with images, high prompt fidelity — no API token required.
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
    id: 'boardroom',
    name: 'Boardroom Gold',
    bg: '0A0F1C',
    bgAlt: '111827',
    accent: 'C9A227',
    accent2: 'E8D48B',
    text: 'F8FAFC',
    muted: '94A3B8',
    card: '1E293B',
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
  logistics: [
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=1200&q=80',
    'https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=1200&q=80',
  ],
  middleeast: [
    'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&q=80',
    'https://images.unsplash.com/photo-1580674684081-7617fbf3d745?w=1200&q=80',
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
  if (/fintech|bank|finance|invest|fund|revenue|money|saas|payment|unit economics|raise|series/.test(p)) {
    pools.push(...IMAGE_BANK.finance)
  }
  if (/tech|ai|software|digital|cloud|data|app|platform|cyber|automation|invoice/.test(p)) {
    pools.push(...IMAGE_BANK.technology)
  }
  if (/team|people|hr|culture|talent|hire|leadership/.test(p)) {
    pools.push(...IMAGE_BANK.team)
  }
  if (/growth|scale|market|expansion|sales|gtm/.test(p)) {
    pools.push(...IMAGE_BANK.growth)
  }
  if (/strategy|plan|roadmap|vision|board|transform/.test(p)) {
    pools.push(...IMAGE_BANK.strategy)
  }
  if (/innovat|product|launch|r&d|research/.test(p)) {
    pools.push(...IMAGE_BANK.innovation)
  }
  if (/logistic|supply|freight|warehouse|shipping|fleet/.test(p)) {
    pools.push(...IMAGE_BANK.logistics)
  }
  if (/middle east|uae|dubai|saudi|gcc|qatar|abu dhabi|mena/.test(p)) {
    pools.push(...IMAGE_BANK.middleeast)
  }
  if (!pools.length) pools.push(...IMAGE_BANK.business, ...IMAGE_BANK.default)

  const out: string[] = []
  for (let i = 0; i < count; i++) {
    out.push(pools[i % pools.length])
  }
  return out
}

// ——— Framework templates (used only when prompt does not list sections) ———

const FRAME_PITCH = [
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

const FRAME_REPORT = [
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

const FRAME_TRAINING = [
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

const FRAME_PRO = [
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

/** Known section keywords users often list after a colon */
const SECTION_ALIASES: { re: RegExp; title: string }[] = [
  { re: /\bexec(utive)?\s*(summary|brief|overview)\b/i, title: 'Executive summary' },
  { re: /\bopportunity\b/i, title: 'The opportunity' },
  { re: /\bproblem\b/i, title: 'Problem we solve' },
  { re: /\bsolution\b/i, title: 'Solution & product' },
  { re: /\bproduct\b/i, title: 'Product' },
  { re: /\bmarket\b/i, title: 'Market & positioning' },
  { re: /\bposition(ing)?\b/i, title: 'Market & positioning' },
  { re: /\btraction\b/i, title: 'Traction & proof' },
  { re: /\bproof\b/i, title: 'Traction & proof' },
  { re: /\b(gtm|go[- ]?to[- ]?market)\b/i, title: 'Go-to-market' },
  { re: /\bbusiness model\b/i, title: 'Business model' },
  { re: /\bunit economics\b/i, title: 'Unit economics' },
  { re: /\bcompetit(ive|ion|ors?)\b/i, title: 'Competitive edge' },
  { re: /\bfinancials?|outlook|economics\b/i, title: 'Financial outlook' },
  { re: /\bteam\b/i, title: 'Team' },
  { re: /\braise|the ask|funding\b/i, title: 'The ask & next steps' },
  { re: /\broadmap\b/i, title: 'Roadmap' },
  { re: /\bperformance\b/i, title: 'Performance snapshot' },
  { re: /\brisks?\b/i, title: 'Risks & mitigations' },
  { re: /\bcapital\b/i, title: 'Capital plan' },
  { re: /\bdecisions?\b/i, title: 'Decision requests' },
  { re: /\bcurrent state\b/i, title: 'Current state' },
  { re: /\bworkstreams?\b/i, title: 'Workstreams' },
  { re: /\bgovernance\b/i, title: 'Governance' },
  { re: /\broi\b/i, title: 'Investment & ROI' },
  { re: /\b90[- ]?day\b/i, title: '90-day plan' },
  { re: /\brecommendations?\b/i, title: 'Recommendations' },
  { re: /\bobjectives?\b/i, title: 'Objectives' },
  { re: /\bapproach\b/i, title: 'Approach' },
  { re: /\bmilestones?\b/i, title: 'Milestones' },
  { re: /\bmetrics?\b/i, title: 'Success metrics' },
  { re: /\bexpansion\b/i, title: 'Expansion plan' },
  { re: /\btransform(ation)?\b/i, title: 'Transformation agenda' },
]

// ——— High-accuracy outline engine ———

export type PromptFacts = {
  raw: string
  title: string
  subject: string
  industry: string
  region: string
  audience: string
  money: string[]
  percents: string[]
  numbers: string[]
  entities: string[]
  listedSections: string[]
  claims: string[]
  keywords: string[]
}

export function extractPromptFacts(prompt: string): PromptFacts {
  const raw = prompt.trim()
  const lower = raw.toLowerCase()

  const money =
    raw.match(
      /\$\s?\d[\d,]*(?:\.\d+)?\s?(?:[kKmMbB]|million|billion)?|\d+(?:\.\d+)?\s?(?:million|billion)\s?(?:USD|dollars?)?/gi,
    ) || []
  const percents = raw.match(/\b\d{1,3}(?:\.\d+)?%/g) || []
  const numbers =
    raw.match(
      /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\b|\b\d+(?:\.\d+)?\s?(?:x|×|customers?|users?|seats?|deals?|countries|markets|sites|warehouses?)\b/gi,
    ) || []

  const entities = extractEntities(raw)
  const listedSections = extractListedSections(raw)
  const claims = extractClaims(raw)
  const title = extractTitle(raw)
  const subject = extractSubject(raw, title)
  const industry = detectIndustry(lower)
  const region = detectRegion(lower)
  const audience = detectAudience(lower)
  const keywords = extractKeywords(raw)

  return {
    raw,
    title,
    subject,
    industry,
    region,
    audience,
    money: unique(money.map((m) => m.replace(/\s+/g, ' ').trim())),
    percents: unique(percents),
    numbers: unique(numbers.map((n) => n.trim())),
    entities,
    listedSections,
    claims,
    keywords,
  }
}

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
  const facts = extractPromptFacts(raw)
  const framework = pickFramework(tone, facts)
  const target =
    opts?.slideCount === 'auto' || !opts?.slideCount
      ? Math.min(14, Math.max(10, framework.length + 3))
      : Math.min(16, Math.max(6, opts.slideCount))

  const images = pickImages(raw, 14)
  let imgIdx = 0
  const nextImg = () => images[imgIdx++ % images.length]

  const slides: DeckSlide[] = []
  const subtitle = deckSubtitle(tone, facts)

  // Title
  slides.push({
    kind: 'title',
    title: facts.title,
    subtitle,
    notes: `Dragon PPT · ${tone} · prompt-faithful · offline`,
    imageUrl: nextImg(),
  })

  // Agenda — only sections that will appear
  const contentSections = framework.slice(0, Math.max(1, target - 5))
  slides.push({
    kind: 'agenda',
    title: 'Agenda',
    subtitle: `${facts.audience} · ${contentSections.length} discussion blocks`,
    bullets: contentSections.map(
      (t, i) => `${String(i + 1).padStart(2, '0')}  ${t}`,
    ),
  })

  // KPI snapshot grounded in prompt numbers
  slides.push({
    kind: 'stats',
    title: tone === 'pitch' ? 'Snapshot at a glance' : 'Key metrics',
    subtitle: facts.money.length || facts.percents.length
      ? 'Figures extracted from your brief'
      : 'Leadership metrics derived from the brief',
    stats: buildAccurateStats(facts, tone),
    imageUrl: nextImg(),
  })

  // Content slides — high fidelity to prompt
  contentSections.forEach((sectionTitle, idx) => {
    const bullets = buildAccurateBullets(sectionTitle, facts, tone, idx)
    const layout = idx % 4

    if (layout === 1) {
      slides.push({
        kind: 'image-text',
        title: sectionTitle,
        subtitle: sectionContextLine(sectionTitle, facts),
        bullets: bullets.slice(0, 5),
        imageUrl: nextImg(),
        imageSide: idx % 8 === 1 ? 'right' : 'left',
      })
    } else if (layout === 2) {
      const mid = Math.ceil(bullets.length / 2)
      slides.push({
        kind: 'two-column',
        title: sectionTitle,
        leftTitle: leftColTitle(sectionTitle),
        leftBullets: bullets.slice(0, mid),
        rightTitle: rightColTitle(sectionTitle),
        rightBullets: bullets.slice(mid).length
          ? bullets.slice(mid)
          : implicationsFrom(sectionTitle, facts),
      })
    } else if (layout === 3 && bullets.length >= 3) {
      slides.push({
        kind: 'cards',
        title: sectionTitle,
        cards: bullets.slice(0, 3).map((b, i) => ({
          title: cardTitle(sectionTitle, i),
          body: b,
        })),
      })
    } else {
      slides.push({
        kind: 'bullets',
        title: sectionTitle,
        subtitle: sectionContextLine(sectionTitle, facts),
        bullets: bullets.slice(0, 6),
      })
    }
  })

  // Timeline grounded in subject
  slides.push({
    kind: 'timeline',
    title: tone === 'training' ? 'Learning path' : '90-day roadmap',
    subtitle: facts.subject.slice(0, 80),
    timeline: buildAccurateTimeline(tone, facts),
  })

  // Leadership takeaway from real claims
  slides.push({
    kind: 'quote',
    title: 'Leadership takeaway',
    quote: insightFromFacts(facts),
    attribution: author,
  })

  // Closing with concrete next steps
  slides.push({
    kind: 'closing',
    title: closingTitle(tone, facts),
    subtitle: closingSubtitle(tone, facts),
    bullets: closingBullets(tone, facts),
    imageUrl: nextImg(),
  })

  while (slides.length > target + 2) {
    const idx = slides.findIndex(
      (s, i) => i > 3 && (s.kind === 'bullets' || s.kind === 'cards'),
    )
    if (idx === -1) break
    slides.splice(idx, 1)
  }

  return {
    title: facts.title,
    subtitle,
    author,
    tagline: 'CONFIDENTIAL · Dragon PPT',
    slides,
    imageKeywords: [facts.title, facts.subject, facts.industry].filter(Boolean),
  }
}

function pickFramework(
  tone: string,
  facts: PromptFacts,
): string[] {
  // Prefer explicit section list from the user (highest accuracy)
  if (facts.listedSections.length >= 3) {
    return facts.listedSections.slice(0, 12)
  }

  // Merge user-mentioned sections into a tone framework in order of appearance
  const mentioned = SECTION_ALIASES.filter((a) => a.re.test(facts.raw)).map(
    (a) => a.title,
  )
  const uniqueMentioned = unique(mentioned)
  if (uniqueMentioned.length >= 4) {
    // Keep discovery order, dedupe
    return uniqueMentioned.slice(0, 12)
  }

  let base: string[]
  if (tone === 'pitch') base = [...FRAME_PITCH]
  else if (tone === 'report') base = [...FRAME_REPORT]
  else if (tone === 'training') base = [...FRAME_TRAINING]
  else if (/pitch|investor|fundrais|seed|series/i.test(facts.raw))
    base = [...FRAME_PITCH]
  else base = [...FRAME_PRO]

  // Inject domain-specific sections when relevant
  if (/middle east|uae|gcc|mena|dubai|saudi/i.test(facts.raw) && !base.includes('Regional focus')) {
    const i = Math.min(3, base.length - 1)
    base.splice(i, 0, 'Regional focus')
  }
  if (/transform/i.test(facts.raw) && !base.some((s) => /transform/i.test(s))) {
    base.splice(2, 0, 'Transformation agenda')
  }
  if (facts.money.some((m) => /raise|\$/i.test(m)) && tone === 'pitch') {
    // ensure ask is last
    if (!base.some((s) => /ask|next/i.test(s))) base.push('The ask & next steps')
  }

  return base
}

/**
 * Build bullets that stay faithful to the user brief:
 * 1) Reuse real claims & numbers from the prompt
 * 2) Section-aware templates filled with extracted entities
 * 3) Only fall back to structured executive language (never random filler)
 */
function buildAccurateBullets(
  section: string,
  facts: PromptFacts,
  tone: string,
  sectionIndex: number,
): string[] {
  const s = section.toLowerCase()
  const out: string[] = []
  const used = new Set<string>()

  const push = (line: string) => {
    const t = polishBullet(line)
    if (!t) return
    const key = t.toLowerCase().slice(0, 60)
    if (used.has(key)) return
    used.add(key)
    out.push(t)
  }

  // 1) Claims that lexically match this section
  for (const c of facts.claims) {
    if (claimMatchesSection(c, s)) push(c)
    if (out.length >= 3) break
  }

  // 2) Numbers / money that belong on this slide
  if (/financial|outlook|ask|economics|roi|capital|invest|raise|unit/i.test(s)) {
    facts.money.forEach((m) => {
      if (out.length >= 5) return
      push(
        tone === 'pitch'
          ? `Capital context: ${m} framed against the growth plan.`
          : `Financial reference point: ${m} from the brief.`,
      )
    })
    facts.percents.forEach((p) => {
      if (out.length >= 5) return
      push(`Performance signal: ${p} called out in the source brief.`)
    })
  }

  if (/traction|proof|performance|metric|snapshot|finding/i.test(s)) {
    ;[...facts.percents, ...facts.numbers].slice(0, 3).forEach((v) => {
      push(`Tracked indicator: ${v}.`)
    })
  }

  // 3) Section-specific accurate templates using subject/industry/region
  for (const line of sectionTemplates(section, facts, tone)) {
    if (out.length >= 6) break
    push(line)
  }

  // 4) Remaining unused claims as supporting points
  if (out.length < 4) {
    const offset = sectionIndex % Math.max(1, facts.claims.length)
    for (let i = 0; i < facts.claims.length && out.length < 5; i++) {
      push(facts.claims[(offset + i) % facts.claims.length])
    }
  }

  // 5) Hard floor — executive but still tied to subject (never generic alone)
  let n = 0
  while (out.length < 4) {
    push(subjectAnchoredPoint(section, facts, n++))
  }

  return out.slice(0, 6)
}

function claimMatchesSection(claim: string, sectionLower: string): boolean {
  const c = claim.toLowerCase()
  const tokens = sectionLower
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 3 && !['with', 'from', 'that', 'this', 'next'].includes(t))
  if (tokens.some((t) => c.includes(t))) return true
  // semantic buckets
  if (/problem|pain|challenge|gap/.test(sectionLower) && /problem|pain|slow|manual|cost|ineffic|lack|fragment/.test(c))
    return true
  if (/solution|product|approach/.test(sectionLower) && /automat|platform|product|solution|ai|software|system/.test(c))
    return true
  if (/market|position/.test(sectionLower) && /market|segment|customer|enterprise|smb|industry/.test(c))
    return true
  if (/gtm|go-to|sales/.test(sectionLower) && /sales|gtm|channel|partner|pipeline|landing/.test(c))
    return true
  if (/risk/.test(sectionLower) && /risk|mitigat|depend|regulat|compliance/.test(c))
    return true
  if (/team/.test(sectionLower) && /team|founder|hire|leader|talent/.test(c))
    return true
  if (/roadmap|milestone|90/.test(sectionLower) && /phase|quarter|month|day|roadmap|milestone/.test(c))
    return true
  return false
}

function sectionTemplates(
  section: string,
  facts: PromptFacts,
  tone: string,
): string[] {
  const s = section.toLowerCase()
  const sub = facts.subject
  const ind = facts.industry || 'the target market'
  const reg = facts.region
  const ent = facts.entities[0]
  const mon = facts.money[0]
  const lines: string[] = []

  if (/exec|overview|summary|brief/.test(s)) {
    lines.push(
      `${sub}: focused mandate for ${facts.audience.toLowerCase()}.`,
      reg
        ? `Geographic lens: ${reg} with clear commercial and operating priorities.`
        : `Scope covers strategy, execution, and decision rights for ${ind}.`,
      mon
        ? `Material financial context includes ${mon}.`
        : `Outcomes are defined so leadership can decide within one cycle.`,
      ent
        ? `${ent} is positioned as a primary reference in the narrative.`
        : `Narrative is ordered for board-speed comprehension.`,
    )
  } else if (/opportunity|context/.test(s)) {
    lines.push(
      `${ind} presents a timely window for ${sub}.`,
      reg
        ? `${reg} demand and infrastructure support accelerated entry.`
        : `Customer and market signals justify prioritized investment.`,
      `Winning requires focus on the highest-leverage segment first.`,
      `Delay raises competitive and opportunity cost over the next 2–3 quarters.`,
    )
  } else if (/problem|current state/.test(s)) {
    lines.push(
      `Current state leaves material value on the table for ${sub}.`,
      `Fragmented processes and manual work slow decision speed and accuracy.`,
      `Customers and operators feel friction that competitors can exploit.`,
      `Without a structured fix, cost of inaction compounds each quarter.`,
    )
  } else if (/solution|product|approach|transform/.test(s)) {
    lines.push(
      `Proposed approach for ${sub} is phased, measurable, and executable.`,
      facts.keywords.some((k) => /ai|automat|digital|platform|software/i.test(k))
        ? `Technology and process redesign are co-designed—not bolted on.`
        : `Operating model and capability build run in parallel.`,
      `Integration maps to existing systems, owners, and data flows.`,
      `Early releases prove value before full-scale rollout.`,
    )
  } else if (/market|position|regional|expansion/.test(s)) {
    lines.push(
      reg
        ? `${reg} is the primary theatre for expansion under this plan.`
        : `Addressable market prioritizes segments with clear willingness to pay.`,
      `Positioning emphasizes business outcomes over feature checklists.`,
      ent
        ? `${ent} competes on focus, speed, and proof—not breadth alone.`
        : `Competitive response window remains open for a decisive mover.`,
      `Go-deep in a beachhead segment before horizontal expansion.`,
    )
  } else if (/traction|proof|finding|performance|snapshot/.test(s)) {
    lines.push(
      facts.percents[0]
        ? `Headline signal: ${facts.percents[0]} highlighted in the brief.`
        : `Early indicators validate demand and execution quality.`,
      facts.numbers[0]
        ? `Scale marker: ${facts.numbers[0]} as stated in source materials.`
        : `Proof points are designed to de-risk the next investment step.`,
      mon
        ? `Commercial reference: ${mon}.`
        : `Unit economics improve with focused scale—not unfocused growth.`,
      `Reporting cadence keeps leadership sighted on leading indicators.`,
    )
  } else if (/business model|unit economics|financial|outlook|roi|capital|invest/.test(s)) {
    lines.push(
      mon
        ? `Plan anchors on ${mon} as a key financial stake in the brief.`
        : `Investment case is built on payback, margin, and capital efficiency.`,
      `Base / upside / downside scenarios are available for decisioning.`,
      `Spend prioritizes highest-ROI workstreams with clear kill criteria.`,
      tone === 'pitch'
        ? `Use of proceeds maps directly to growth milestones and proof.`
        : `Resource plan matches ambition to capacity and risk appetite.`,
    )
  } else if (/gtm|go-to|sales/.test(s)) {
    lines.push(
      `GTM sequences ICP definition → land → expand with named owners.`,
      reg
        ? `Local partners and channels in ${reg} accelerate first logos.`
        : `Channel mix balances direct enterprise motion with scalable partners.`,
      `Pipeline stages and conversion targets are instrumented weekly.`,
      `Messaging is outcome-led for buyers and operators alike.`,
    )
  } else if (/competit/.test(s)) {
    lines.push(
      `Differentiation rests on focused execution for ${sub}.`,
      `Competitors are mapped on product depth, price, and time-to-value.`,
      `Moat compounds via data, workflow lock-in, and reference customers.`,
      `Win themes are explicit so the field can execute consistently.`,
    )
  } else if (/team/.test(s)) {
    lines.push(
      `Leadership bench owns delivery with single-threaded accountability.`,
      ent
        ? `${ent} is referenced as a key organizational anchor.`
        : `Critical roles for the next phase are identified and sequenced.`,
      `Hiring plan aligns to roadmap milestones—not open-ended headcount.`,
      `Culture emphasizes speed, clarity, and measured risk-taking.`,
    )
  } else if (/roadmap|milestone|path|90/.test(s)) {
    lines.push(
      `Near-term milestones create visible momentum on ${sub}.`,
      `Dependencies, owners, and exit criteria are explicit per phase.`,
      `30 / 60 / 90-day checkpoints enable course correction without delay.`,
      `What works is codified into playbooks before broader scale.`,
    )
  } else if (/risk/.test(s)) {
    lines.push(
      `Top risks for ${sub} are named with owners and mitigations.`,
      reg
        ? `Regional / regulatory exposure in ${reg} is actively monitored.`
        : `Operational, commercial, and delivery risks are tracked weekly.`,
      `Early-warning metrics trigger escalation within one business week.`,
      `Contingency paths exist for critical-path dependencies.`,
    )
  } else if (/workstream/.test(s)) {
    lines.push(
      `Workstreams partition ${sub} into accountable delivery lines.`,
      `Each stream has a single owner, KPI set, and interface contracts.`,
      `Cross-stream governance prevents thrash and duplicate effort.`,
      `Value release is sequenced so the org sees progress early.`,
    )
  } else if (/govern/.test(s)) {
    lines.push(
      `Decision rights and RACI are documented for ${facts.audience}.`,
      `Cadence: weekly operating review, monthly steering, quarterly board pack.`,
      `Escalation paths are short—no orphaned blockers.`,
      `Audit trail supports compliance and investor-grade reporting.`,
    )
  } else if (/recommend|decision|ask|next/.test(s)) {
    lines.push(
      mon && tone === 'pitch'
        ? `Decision requested: advance the plan with ${mon} as outlined.`
        : `Specific decisions are requested from leadership in this session.`,
      `Proposed owners, budget envelope, and timeline are ready for approval.`,
      `Success criteria and first 30-day deliverables are pre-defined.`,
      `Follow-up checkpoint scheduled within two weeks of decision.`,
    )
  } else if (/object/.test(s)) {
    lines.push(
      `Primary objective: advance ${sub} with measurable outcomes.`,
      `Secondary objectives cover risk, capability, and stakeholder alignment.`,
      `Each objective maps to an owner and a leading indicator.`,
      `Trade-offs are explicit so the board can prioritize cleanly.`,
    )
  } else {
    lines.push(
      `Advance ${section} with clear ownership under ${sub}.`,
      `Translate ${section.toLowerCase()} into KPIs leadership can track.`,
      `Sequence work so value appears early and risk is contained.`,
      `Report progress in a board-ready, decision-oriented format.`,
    )
  }

  return lines
}

function subjectAnchoredPoint(
  section: string,
  facts: PromptFacts,
  i: number,
): string {
  const pool = [
    `For ${facts.subject}: make ${section.toLowerCase()} decision-ready with owners and dates.`,
    `Tie ${section.toLowerCase()} to ${facts.industry || 'business'} outcomes the board can measure.`,
    facts.region
      ? `Reflect ${facts.region} realities in how ${section.toLowerCase()} is resourced.`
      : `Keep ${section.toLowerCase()} scoped to the highest-leverage actions first.`,
    facts.money[0]
      ? `Align ${section.toLowerCase()} spend with the ${facts.money[0]} context in the brief.`
      : `Protect capital efficiency while executing ${section.toLowerCase()}.`,
  ]
  return pool[i % pool.length]
}

function buildAccurateStats(
  facts: PromptFacts,
  tone: string,
): { value: string; label: string }[] {
  const found: { value: string; label: string }[] = []

  facts.money.slice(0, 2).forEach((m, i) => {
    const labels =
      tone === 'pitch'
        ? ['Raise / capital', 'Commercial stake']
        : ['Budget / value', 'Financial marker']
    found.push({ value: compactMetric(m), label: labels[i] || 'Value' })
  })

  facts.percents.slice(0, 2).forEach((p, i) => {
    found.push({
      value: p,
      label: ['Growth / rate', 'Conversion'][i] || 'KPI',
    })
  })

  facts.numbers.slice(0, 2).forEach((n) => {
    if (found.length >= 4) return
    const label = /customer|user|seat/i.test(n)
      ? 'Scale'
      : /country|market|site|warehouse/i.test(n)
        ? 'Footprint'
        : 'Volume'
    found.push({ value: compactMetric(n), label })
  })

  if (found.length >= 3) return found.slice(0, 4)

  // Context-aware defaults (not fake revenue) — execution framing
  const defaults: { value: string; label: string }[] = [
    {
      value: String(Math.min(12, Math.max(4, facts.listedSections.length || 6))),
      label: 'Focus chapters',
    },
    { value: '90d', label: 'Execution window' },
    {
      value: facts.region ? '1' : '3',
      label: facts.region ? 'Primary region' : 'Priority workstreams',
    },
    { value: '1', label: 'North-star outcome' },
  ]
  return [...found, ...defaults].slice(0, 4)
}

function compactMetric(v: string): string {
  return v.replace(/\s+/g, ' ').trim().slice(0, 18)
}

function buildAccurateTimeline(
  tone: string,
  facts: PromptFacts,
): { when: string; what: string }[] {
  const sub = facts.subject.slice(0, 48)
  if (tone === 'training') {
    return [
      { when: 'Week 1', what: `Foundations for ${sub}` },
      { when: 'Week 2', what: 'Tools & hands-on practice' },
      { when: 'Week 3', what: 'Scenarios & coaching' },
      { when: 'Week 4', what: 'Certification & enablement' },
    ]
  }
  return [
    {
      when: 'Days 1–30',
      what: `Mobilize owners, baseline metrics, and kick off ${sub}`,
    },
    {
      when: 'Days 31–60',
      what: facts.region
        ? `Deliver first value in ${facts.region}; instrument leading KPIs`
        : 'Ship first value release; instrument leading KPIs',
    },
    {
      when: 'Days 61–90',
      what: 'Scale what works; lock operating cadence and governance',
    },
    {
      when: 'Q+1',
      what: facts.money[0]
        ? `Expand with proof against ${facts.money[0]} plan`
        : 'Expand scope using proven playbooks',
    },
  ]
}

function insightFromFacts(facts: PromptFacts): string {
  // Prefer a strong claim from the user
  const strong = facts.claims.find((c) => c.length >= 50 && c.length <= 200)
  if (strong) return strong.replace(/[.!?]?$/, '.')

  if (facts.money[0] && facts.subject) {
    return `Winning on ${facts.subject} requires focus, speed, and disciplined use of ${facts.money[0]}—with clear ownership and a 90-day proof cycle.`
  }
  if (facts.region) {
    return `Success on ${facts.subject} in ${facts.region} hinges on beachhead focus, local execution quality, and measurable milestones the board can track.`
  }
  return `Winning on ${facts.subject} requires focus, speed, and disciplined capital allocation—executed with single-threaded ownership.`
}

function deckSubtitle(tone: string, facts: PromptFacts): string {
  const bits: string[] = []
  if (tone === 'pitch') bits.push('Investor & leadership briefing')
  else if (tone === 'report') bits.push('Executive performance briefing')
  else if (tone === 'training') bits.push('Leadership enablement')
  else bits.push('Strategic board presentation')
  if (facts.region) bits.push(facts.region)
  else if (facts.industry) bits.push(facts.industry)
  return bits.join(' · ')
}

function sectionContextLine(section: string, facts: PromptFacts): string {
  if (facts.region && /region|expans|market|gtm/i.test(section))
    return facts.region
  if (facts.entities[0]) return `${facts.entities[0]} · ${facts.industry || 'strategic'}`
  return facts.industry ? `${facts.industry} · decision support` : 'Confidential · leadership materials'
}

function leftColTitle(section: string): string {
  if (/risk/i.test(section)) return 'Risks'
  if (/competit/i.test(section)) return 'Landscape'
  if (/problem|current/i.test(section)) return 'Today'
  return 'Insights'
}

function rightColTitle(section: string): string {
  if (/risk/i.test(section)) return 'Mitigations'
  if (/competit/i.test(section)) return 'Our edge'
  if (/problem|current/i.test(section)) return 'Implications'
  return 'Implications'
}

function implicationsFrom(section: string, facts: PromptFacts): string[] {
  return [
    `Leadership must resource ${section.toLowerCase()} deliberately.`,
    `Owners and dates for ${facts.subject} should be confirmed this session.`,
    `Track progress with a simple weekly dashboard.`,
  ]
}

function cardTitle(section: string, i: number): string {
  if (/risk/i.test(section)) return ['Risk', 'Impact', 'Mitigation'][i] || `Point ${i + 1}`
  if (/ask|decision|next/i.test(section))
    return ['Decision', 'Owner', 'Timeline'][i] || `Point ${i + 1}`
  if (/workstream/i.test(section))
    return ['Stream A', 'Stream B', 'Stream C'][i] || `Stream ${i + 1}`
  return ['Priority', 'Action', 'Outcome'][i] || `Point ${i + 1}`
}

function closingTitle(tone: string, facts: PromptFacts): string {
  if (tone === 'pitch') {
    return facts.money[0]
      ? `The opportunity · ${compactMetric(facts.money[0])}`
      : 'Partnership opportunity'
  }
  return 'Thank you'
}

function closingSubtitle(tone: string, facts: PromptFacts): string {
  if (tone === 'pitch') return `Ready for next conversation on ${facts.subject.slice(0, 48)}`
  return 'Questions & decisions'
}

function closingBullets(tone: string, facts: PromptFacts): string[] {
  if (tone === 'pitch') {
    return [
      facts.money[0]
        ? `Align on success criteria for the ${facts.money[0]} plan`
        : 'Align on success criteria and beachhead segment',
      'Confirm pilot scope, owners, and first 30-day deliverables',
      'Schedule decision checkpoint within two weeks',
    ]
  }
  return [
    `Confirm decisions and owners for ${facts.subject.slice(0, 40)}`,
    'Share follow-up pack with metrics and risks',
    'Book working session for the 90-day plan',
  ]
}

function polishBullet(s: string): string {
  let t = s.replace(/^[-*•\d.)\s]+/, '').trim()
  if (!t) return ''
  if (t[0] === t[0].toLowerCase()) t = t[0].toUpperCase() + t.slice(1)
  if (t.length > 145) t = t.slice(0, 142) + '…'
  if (!/[.!?]$/.test(t) && t.length > 35) t += '.'
  return t
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
        temperature: 0.25,
        messages: [
          {
            role: 'system',
            content:
              'You are Dragon PPT, an elite board-deck writer. Return ONLY JSON: {title,subtitle,author,slides:[{kind,title,subtitle?,bullets?,stats?,cards?,quote?,timeline?}]}. kinds: title|agenda|bullets|two-column|image-text|cards|quote|stats|timeline|closing. Rules: (1) Stay strictly faithful to the user prompt—use their numbers, names, regions, and section list. (2) No generic filler or invented financials. (3) Concise executive language, 10-14 slides. (4) Every bullet must be specific and actionable.',
          },
          {
            role: 'user',
            content: `User prompt (source of truth):\n${prompt}\n\nDraft outline to refine (keep facts, improve precision):\n${JSON.stringify(outline)}`,
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
  themeId: PptThemeId = 'dragon',
  onStatus?: (s: string) => void,
): Promise<Blob> {
  const theme = getTheme(themeId)
  const pptx = new PptxGenJS()
  pptx.author = outline.author
  pptx.title = outline.title
  pptx.subject = outline.subtitle
  pptx.company = 'dragonPDF · Dragon PPT'
  pptx.defineLayout({ name: 'LAYOUT_16x9', width: 13.333, height: 7.5 })
  pptx.layout = 'LAYOUT_16x9'

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

    // Accent rail
    s.addShape(pptx.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 0.1,
      h: 7.5,
      fill: { color: theme.accent },
      line: { color: theme.accent },
    })

    if (slide.kind === 'title') {
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
      s.addText(outline.tagline || 'CONFIDENTIAL · DRAGON PPT', {
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
        fontSize: 34,
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
          fontSize: 15,
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
        fontSize: 36,
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
          fontSize: 16,
          fontFace: 'Arial',
          color: theme.accent2,
          align: 'center',
        })
      }
      if (slide.bullets?.length) {
        s.addText(
          slide.bullets.map((b) => ({ text: b, options: { bullet: false } })),
          {
            x: 2.5,
            y: 4.2,
            w: 8.3,
            h: 2,
            fontSize: 14,
            fontFace: 'Arial',
            color: theme.muted,
            align: 'center',
            paraSpaceAfter: 10,
          },
        )
      }
      continue
    }

    // Standard header
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
          fontSize: 32,
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
      const col = (x: number, title: string, bullets: string[]) => {
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
        fontSize: 24,
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

// ——— Text / NLP helpers (offline, high fidelity) ———

function unique<T>(arr: T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const x of arr) {
    const k = String(x).toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(x)
  }
  return out
}

function extractTitle(raw: string): string {
  // Pattern: "Series A pitch for X" / "board update on X" / "roadmap for X"
  const forOn = raw.match(
    /(?:pitch|deck|presentation|update|briefing|roadmap|plan|training|report)\s+(?:for|on|about)\s+([^:.\n]+)/i,
  )
  if (forOn?.[1]) {
    let t = cleanTitle(forOn[1])
    // Prefix with deck type if short
    const kind = raw.match(
      /\b(Series\s+[A-D]|Seed|Board update|Digital transformation|Investor pitch)\b/i,
    )
    if (kind && t.length < 60) t = `${kind[0]}: ${t}`
    if (t.length >= 12 && t.length <= 90) return t
  }

  // Colon-led title
  const colon = raw.match(/^([^:\n]{12,80}):/)
  if (colon) return cleanTitle(colon[1])

  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  let title = lines[0] || 'Strategic Presentation'
  if (title.length > 90 || (/[.!?]/.test(title) && title.length > 70)) {
    title = firstSentence(raw).slice(0, 90)
  }
  // Strip trailing section list after em dash or colon lists
  title = title.split(/\s+[—–-]\s+/)[0]
  title = title.replace(/:\s*(problem|solution|market|product|gtm).*$/i, '')
  return cleanTitle(title).slice(0, 90) || 'Strategic Presentation'
}

function extractSubject(raw: string, title: string): string {
  const m = raw.match(
    /(?:for|on|about)\s+(?:an?\s+)?([^:.\n]{8,80}?)(?:\s*[:—–-]|\s+for\s|\s*$)/i,
  )
  if (m?.[1] && m[1].length > 6) return cleanTitle(m[1]).slice(0, 70)
  return title.slice(0, 70)
}

function extractEntities(raw: string): string[] {
  const out: string[] = []
  // Capitalized multi-word names (simple NER)
  const caps = raw.match(
    /\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3}\b/g,
  ) || []
  const stop = new Set([
    'Series',
    'Problem',
    'Solution',
    'Market',
    'Product',
    'Traction',
    'Business',
    'Competitive',
    'Financial',
    'Roadmap',
    'Executive',
    'Middle',
    'East',
    'Enterprise',
    'Digital',
    'Transformation',
    'Investor',
    'Leadership',
    'Board',
    'Update',
    'Pitch',
    'The',
    'And',
    'For',
    'With',
  ])
  for (const c of caps) {
    if (stop.has(c.split(' ')[0])) continue
    if (c.length < 3) continue
    out.push(c)
  }
  // SaaS / product style phrases
  const product = raw.match(
    /\b(?:AI-powered|AI|SaaS|platform|automation)\s+[\w\s-]{3,40}/gi,
  )
  if (product) out.push(...product.map((p) => p.trim()))
  return unique(out).slice(0, 8)
}

function extractListedSections(raw: string): string[] {
  // After a colon: "problem, solution, market, product, GTM, ..."
  const afterColon = raw.match(
    /:\s*([^.!?\n]{20,400})$/m,
  ) || raw.match(
    /:\s*((?:[A-Za-z][\w\s&/%$-]{2,40},?\s*){3,}(?:and\s+)?[A-Za-z][\w\s&/%$-]{2,40})/i,
  )

  let chunk = ''
  if (afterColon) chunk = afterColon[1]
  // Also "cover X, Y, and Z"
  if (!chunk) {
    const cover = raw.match(
      /(?:cover|including|across|spanning)\s+([^.!?\n]{20,300})/i,
    )
    if (cover) chunk = cover[1]
  }

  if (!chunk) {
    // Bullet or numbered lines as sections
    const lines = raw
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => /^[-*•]\s+|^\d+[.)]\s+/.test(l))
      .map((l) => l.replace(/^[-*•]\s+|^\d+[.)]\s+/, '').trim())
    if (lines.length >= 3) {
      return lines.map((l) => titleCaseSection(l.split(/[—(]/)[0].slice(0, 55)))
    }
    return []
  }

  // Split on commas / and / semicolons / slashes between major topics
  const parts = chunk
    .split(/\s*,\s*|\s*;\s*|\s+and\s+|\s*\/\s*|\s*\|\s*/i)
    .map((p) => p.replace(/^\$[\d.]+[kKmMbB]?\s*/i, '').trim()) // drop pure money as section
    .map((p) => p.replace(/\.$/, '').trim())
    .filter((p) => p.length >= 2 && p.length <= 55)
    .filter((p) => !/^\$/.test(p))

  // Map known aliases to clean titles
  const mapped = parts.map((p) => {
    for (const a of SECTION_ALIASES) {
      if (a.re.test(p) && p.length < 30) return a.title
    }
    return titleCaseSection(p)
  })

  return unique(mapped).slice(0, 12)
}

function titleCaseSection(s: string): string {
  const t = s.replace(/\s+/g, ' ').trim()
  if (t === t.toUpperCase() && t.length <= 6) return t // GTM, ROI
  if (/^[a-z]/.test(t)) return t[0].toUpperCase() + t.slice(1)
  return t
}

function extractClaims(raw: string): string[] {
  const claims: string[] = []

  // Full sentences
  for (const s of extractSentences(raw)) {
    if (s.length >= 25 && s.length <= 200) claims.push(s)
  }

  // Clause fragments after colons that are descriptive
  const clauses = raw.split(/[;|]/).map((c) => c.trim())
  for (const c of clauses) {
    if (c.length >= 30 && c.length <= 160 && !/^[-*•]/.test(c)) {
      if (!claims.some((x) => x.includes(c.slice(0, 40)))) claims.push(c)
    }
  }

  return unique(claims).slice(0, 20)
}

function extractKeywords(raw: string): string[] {
  const words = raw.toLowerCase().match(/\b[a-z][a-z0-9-]{3,}\b/g) || []
  const stop = new Set(
    'this that with from for about into over under than then them they their what when where which while would could should about after before between being been have has had were was are and the presentation pitch deck board update including required quarter'.split(
      ' ',
    ),
  )
  const freq = new Map<string, number>()
  for (const w of words) {
    if (stop.has(w)) continue
    freq.set(w, (freq.get(w) || 0) + 1)
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .slice(0, 24)
}

function detectIndustry(lower: string): string {
  if (/invoice|fintech|payment|bank|saas/.test(lower)) return 'SaaS / fintech'
  if (/logistic|supply|freight|warehouse/.test(lower)) return 'Logistics'
  if (/health|pharma|hospital/.test(lower)) return 'Healthcare'
  if (/retail|e-?commerce|consumer/.test(lower)) return 'Retail'
  if (/energy|oil|renewable/.test(lower)) return 'Energy'
  if (/ai|software|cloud|digital|platform/.test(lower)) return 'Technology'
  if (/real estate|property/.test(lower)) return 'Real estate'
  return ''
}

function detectRegion(lower: string): string {
  if (/middle east|mena|gcc/.test(lower)) return 'Middle East / GCC'
  if (/uae|dubai|abu dhabi/.test(lower)) return 'UAE'
  if (/saudi|ksa|neom/.test(lower)) return 'Saudi Arabia'
  if (/india|mumbai|bangalore|delhi/.test(lower)) return 'India'
  if (/europe|eu\b|uk\b|emea/.test(lower)) return 'Europe / EMEA'
  if (/apac|asia|singapore|japan/.test(lower)) return 'APAC'
  if (/north america|us\b|usa|canada/.test(lower)) return 'North America'
  if (/latam|brazil|mexico/.test(lower)) return 'LATAM'
  return ''
}

function detectAudience(lower: string): string {
  if (/investor|pitch|series|seed|fundrais/.test(lower)) return 'Investors & board'
  if (/board/.test(lower)) return 'Board of directors'
  if (/train|enablement|workshop/.test(lower)) return 'Leadership team'
  if (/customer|sales|proposal/.test(lower)) return 'Customer stakeholders'
  return 'Executive leadership'
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
