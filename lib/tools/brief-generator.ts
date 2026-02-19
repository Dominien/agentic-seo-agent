import type { ToolDefinition, GSCQueryRow, CrawledPage } from '../types'
import { readProjectJSON, getActiveProjectId } from '../store'

export const definition: ToolDefinition = {
  name: 'brief_generator',
  description:
    'Generate a structured content brief for a target keyword. Includes suggested title, related keywords from GSC data, outline, word count target, and internal link suggestions.',
  parameters: {
    type: 'object',
    properties: {
      targetKeyword: {
        type: 'string',
        description: 'The primary keyword to target',
      },
      suggestedTitle: {
        type: 'string',
        description: 'Optional suggested title for the content',
      },
      wordCount: {
        type: 'number',
        description: 'Target word count (default 1500)',
        default: 1500,
      },
    },
    required: ['targetKeyword'],
  },
}

interface GSCData {
  queries: GSCQueryRow[]
  pages: { page: string; clicks: number; impressions: number; ctr: number; position: number }[]
  lastSync: string | null
}

interface SiteContext {
  pages: CrawledPage[]
  lastCrawl: string | null
}

export async function execute(args: Record<string, unknown>): Promise<string> {
  const targetKeyword = args.targetKeyword as string
  const suggestedTitle = args.suggestedTitle as string | undefined
  const wordCount = (args.wordCount as number) || 1500
  const kwLower = targetKeyword.toLowerCase()

  // Load GSC data for related keywords
  let gscData: GSCData = { queries: [], pages: [], lastSync: null }
  try {
    const projectId = await getActiveProjectId()
    gscData = await readProjectJSON<GSCData>(projectId, 'gsc-data.json')
  } catch {
    // No GSC data available
  }

  // Load site context for existing coverage
  let siteContext: SiteContext = { pages: [], lastCrawl: null }
  try {
    const projectId = await getActiveProjectId()
    siteContext = await readProjectJSON<SiteContext>(projectId, 'site-context.json')
  } catch {
    // No site context available
  }

  // Find related keywords from GSC data
  const relatedKeywords = gscData.queries
    .filter(q => {
      const qLower = q.query.toLowerCase()
      // Keywords that share words with the target
      const targetWords = kwLower.split(/\s+/)
      return targetWords.some(w => w.length > 2 && qLower.includes(w))
    })
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 15)

  // Find existing pages covering this topic
  const existingCoverage = siteContext.pages.filter(p => {
    const inTitle = p.title.toLowerCase().includes(kwLower)
    const inContent = p.content.toLowerCase().includes(kwLower)
    const inHeadings = p.headings.some(h => h.text.toLowerCase().includes(kwLower))
    return inTitle || inContent || inHeadings
  })

  // Find internal link candidates (pages on related topics)
  const linkCandidates = siteContext.pages
    .filter(p => {
      if (existingCoverage.includes(p)) return false
      const kwWords = kwLower.split(/\s+/).filter(w => w.length > 3)
      return kwWords.some(
        w => p.content.toLowerCase().includes(w) || p.title.toLowerCase().includes(w)
      )
    })
    .slice(0, 5)

  // Generate suggested H2 headings based on related keywords
  const suggestedH2s = generateOutline(targetKeyword, relatedKeywords)

  // Build the brief
  const title = suggestedTitle || `Guide to ${targetKeyword}`
  const lines: string[] = [
    `# Content Brief: ${targetKeyword}`,
    '',
    '## Overview',
    `- **Title:** ${title}`,
    `- **Target Keyword:** ${targetKeyword}`,
    `- **Word Count Target:** ${wordCount}`,
    '',
  ]

  // Related keywords section
  if (relatedKeywords.length > 0) {
    lines.push('## Related Keywords')
    lines.push('')
    lines.push('| Keyword | Impressions | Clicks | CTR | Position |')
    lines.push('|---------|-------------|--------|-----|----------|')
    for (const kw of relatedKeywords) {
      lines.push(
        `| ${kw.query} | ${kw.impressions} | ${kw.clicks} | ${(kw.ctr * 100).toFixed(1)}% | ${kw.position.toFixed(1)} |`
      )
    }
    lines.push('')
  }

  // Suggested outline
  lines.push('## Suggested Outline')
  lines.push('')
  for (const h2 of suggestedH2s) {
    lines.push(`- **H2:** ${h2}`)
  }
  lines.push('')

  // Existing coverage
  if (existingCoverage.length > 0) {
    lines.push('## Existing Coverage')
    lines.push('')
    lines.push('Pages already covering this topic:')
    lines.push('')
    for (const p of existingCoverage) {
      lines.push(`- [${p.title}](${p.url}) (${p.wordCount} words)`)
    }
    lines.push('')
  } else {
    lines.push('## Existing Coverage')
    lines.push('')
    lines.push('No existing pages cover this topic — this is a content gap opportunity.')
    lines.push('')
  }

  // Internal link suggestions
  if (linkCandidates.length > 0) {
    lines.push('## Internal Link Suggestions')
    lines.push('')
    lines.push('Pages that could link to/from this content:')
    lines.push('')
    for (const p of linkCandidates) {
      lines.push(`- [${p.title}](${p.url})`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

function generateOutline(keyword: string, relatedKeywords: GSCQueryRow[]): string[] {
  const outlines: string[] = [
    `What is ${keyword}?`,
    `Why ${keyword} matters`,
  ]

  // Extract unique topic angles from related keywords
  const seen = new Set<string>()
  for (const kw of relatedKeywords) {
    const q = kw.query.toLowerCase()
    if (q.startsWith('how to')) {
      const topic = kw.query.charAt(0).toUpperCase() + kw.query.slice(1)
      if (!seen.has(topic)) {
        outlines.push(topic)
        seen.add(topic)
      }
    } else if (q.startsWith('best ') || q.startsWith('top ')) {
      const topic = kw.query.charAt(0).toUpperCase() + kw.query.slice(1)
      if (!seen.has(topic)) {
        outlines.push(topic)
        seen.add(topic)
      }
    }
    if (outlines.length >= 6) break
  }

  if (outlines.length < 4) {
    outlines.push(`${keyword} best practices`)
    outlines.push(`Common mistakes with ${keyword}`)
  }

  outlines.push('Conclusion and next steps')
  return outlines
}
