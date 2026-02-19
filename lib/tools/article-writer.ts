import type { ToolDefinition, AppConfig, GSCQueryRow, CrawledPage, ChatMessage } from '../types'
import { readJSON, readMarkdown, readProjectJSON, getActiveProjectId, projectPath, fileExists } from '../store'
import { createProvider } from '../providers/factory'

export const definition: ToolDefinition = {
  name: 'article_writer',
  description:
    'Write a full blog article that matches the site\'s analyzed writing style. Produces a complete article draft in markdown. Requires writing style to be analyzed first.',
  parameters: {
    type: 'object',
    properties: {
      topic: {
        type: 'string',
        description: 'The topic of the article',
      },
      targetKeyword: {
        type: 'string',
        description: 'The primary keyword to target for SEO',
      },
      angle: {
        type: 'string',
        description: 'The specific angle or perspective for the article',
      },
      audience: {
        type: 'string',
        description: 'The target audience for this article',
      },
      wordCount: {
        type: 'number',
        description: 'Target word count (default 1500)',
        default: 1500,
      },
    },
    required: ['topic', 'targetKeyword'],
  },
}

interface GSCData {
  queries: GSCQueryRow[]
  pages: { page: string; clicks: number; impressions: number; ctr: number; position: number }[]
  lastSync: string | null
}

export async function execute(args: Record<string, unknown>): Promise<string> {
  const topic = args.topic as string
  const targetKeyword = args.targetKeyword as string
  const angle = (args.angle as string) || ''
  const audience = (args.audience as string) || ''
  const wordCount = (args.wordCount as number) || 1500

  const projectId = await getActiveProjectId()

  // Check if writing style exists
  const toneExists = await fileExists(projectPath(projectId, 'writing/TONE.md'))
  if (!toneExists) {
    return 'Writing style not analyzed yet. Go to Site Profile and click "Analyze Style" first. This analyzes your existing blog content to extract your voice, tone, and writing patterns so articles match your style.'
  }

  // Load all 6 writing style files
  const writingDir = `projects/${projectId}/writing`
  const [antiWords, tone, structure, examples, context, sentenceStyle] = await Promise.all([
    readMarkdown(`${writingDir}/ANTI_WORDS.md`),
    readMarkdown(`${writingDir}/TONE.md`),
    readMarkdown(`${writingDir}/STRUCTURE.md`),
    readMarkdown(`${writingDir}/EXAMPLES.md`),
    readMarkdown(`${writingDir}/CONTEXT.md`),
    readMarkdown(`${writingDir}/SENTENCE_STYLE.md`),
  ])

  // Load GSC data for related keywords
  let relatedKeywords: GSCQueryRow[] = []
  try {
    const gscData = await readProjectJSON<GSCData>(projectId, 'gsc-data.json')
    if (gscData.queries) {
      const kwLower = targetKeyword.toLowerCase()
      const targetWords = kwLower.split(/\s+/).filter((w) => w.length > 2)
      relatedKeywords = gscData.queries
        .filter((q) => {
          const qLower = q.query.toLowerCase()
          return targetWords.some((w) => qLower.includes(w))
        })
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 20)
    }
  } catch {
    // No GSC data
  }

  // Load site context for internal link targets
  let internalLinks: { url: string; title: string }[] = []
  try {
    const pages = await readProjectJSON<CrawledPage[]>(projectId, 'site-context.json')
    if (Array.isArray(pages)) {
      const kwLower = targetKeyword.toLowerCase()
      const kwWords = kwLower.split(/\s+/).filter((w) => w.length > 3)
      internalLinks = pages
        .filter((p) => {
          return kwWords.some(
            (w) => p.content.toLowerCase().includes(w) || p.title.toLowerCase().includes(w)
          )
        })
        .slice(0, 8)
        .map((p) => ({ url: p.url, title: p.title }))
    }
  } catch {
    // No site context
  }

  // Build the writing prompt
  const relatedKwSection =
    relatedKeywords.length > 0
      ? `\n## Related Keywords to Weave In\nNaturally incorporate these where relevant:\n${relatedKeywords.map((k) => `- "${k.query}" (${k.impressions} impressions, position ${k.position.toFixed(1)})`).join('\n')}`
      : ''

  const linksSection =
    internalLinks.length > 0
      ? `\n## Internal Links to Include\nNaturally link to these pages where contextually appropriate:\n${internalLinks.map((l) => `- [${l.title}](${l.url})`).join('\n')}`
      : ''

  const angleSection = angle ? `\n**Angle:** ${angle}` : ''
  const audienceSection = audience ? `\n**Target Audience:** ${audience}` : ''

  const writingPrompt = `Write a complete blog article following these strict style guidelines.

## Article Requirements
**Topic:** ${topic}
**Target Keyword:** ${targetKeyword}${angleSection}${audienceSection}
**Target Word Count:** ~${wordCount} words
${relatedKwSection}
${linksSection}

---

## STRICT STYLE RULES — Follow ALL of these exactly:

### Banned Words & Phrases (NEVER use these)
${antiWords}

### Tone & Voice
${tone}

### Article Structure Rules
${structure}

### Writing Examples to Emulate
${examples}

### Brand Context
${context}

### Sentence-Level Rules
${sentenceStyle}

---

## Final Instructions
- Write the FULL article in markdown format
- Include a compelling title as H1
- Use H2 and H3 headings for structure
- Hit the target word count of ~${wordCount} words
- Naturally include the target keyword "${targetKeyword}" and related keywords
- Include internal links where contextually appropriate
- Do NOT use any word or phrase from the banned list
- Match the tone, structure, and sentence style exactly
- Write like a human expert, not like AI
- No filler, no fluff, no hedging
- Every sentence should add value

Write the article now:`

  // Make LLM call
  const config = await readJSON<AppConfig>('config.json')
  const provider = createProvider(config.provider)

  const messages: ChatMessage[] = [
    {
      id: 'article-1',
      role: 'user',
      content: writingPrompt,
      timestamp: Date.now(),
    },
  ]

  const response = await provider.chat(
    messages,
    [],
    'You are an expert blog writer. Write the article exactly as instructed, following all style guidelines. Output only the article in markdown format.'
  )

  return response.content
}
