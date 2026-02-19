import type { ToolDefinition, CrawledPage } from '../types'
import { readProjectJSON, getActiveProjectId } from '../store'

export const definition: ToolDefinition = {
  name: 'site_context',
  description:
    'Search crawled site content. Can search for pages mentioning a term, find thin pages (< 300 words), or check which pages use a specific keyword.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search term or keyword to look for',
      },
      type: {
        type: 'string',
        description: 'Type of search to perform',
        enum: ['search', 'thin_pages', 'keyword_check'],
      },
    },
    required: ['query'],
  },
}

export async function execute(args: Record<string, unknown>): Promise<string> {
  const query = args.query as string
  const type = (args.type as string) || 'search'

  let pages: CrawledPage[]
  try {
    const projectId = await getActiveProjectId()
    const raw = await readProjectJSON<CrawledPage[] | { pages: CrawledPage[] }>(projectId, 'site-context.json')
    pages = Array.isArray(raw) ? raw : raw.pages ?? []
  } catch {
    return 'No site context data available. Please crawl the site first.'
  }

  if (pages.length === 0) {
    return 'No crawled pages available. Please crawl the site first.'
  }

  switch (type) {
    case 'thin_pages':
      return findThinPages(pages)
    case 'keyword_check':
      return keywordCheck(pages, query)
    case 'search':
    default:
      return searchPages(pages, query)
  }
}

function searchPages(pages: CrawledPage[], query: string): string {
  const term = query.toLowerCase()
  const matches = pages.filter(p => {
    const inTitle = p.title.toLowerCase().includes(term)
    const inContent = p.content.toLowerCase().includes(term)
    const inHeadings = p.headings.some(h => h.text.toLowerCase().includes(term))
    return inTitle || inContent || inHeadings
  })

  if (matches.length === 0) {
    return `No pages found mentioning "${query}".`
  }

  const lines: string[] = [
    `**Pages mentioning "${query}"** (${matches.length} results)`,
    '',
    '| Page | Title | Word Count | Mentions In |',
    '|------|-------|------------|-------------|',
  ]

  for (const p of matches) {
    const locations: string[] = []
    if (p.title.toLowerCase().includes(term)) locations.push('title')
    if (p.headings.some(h => h.text.toLowerCase().includes(term))) locations.push('headings')
    if (p.content.toLowerCase().includes(term)) locations.push('content')
    lines.push(`| ${p.url} | ${p.title} | ${p.wordCount} | ${locations.join(', ')} |`)
  }

  return lines.join('\n')
}

function findThinPages(pages: CrawledPage[]): string {
  const thin = pages.filter(p => p.wordCount < 300).sort((a, b) => a.wordCount - b.wordCount)

  if (thin.length === 0) {
    return 'No thin pages found (all pages have 300+ words).'
  }

  const lines: string[] = [
    `**Thin Pages** (${thin.length} pages under 300 words)`,
    '',
    '| Page | Title | Word Count |',
    '|------|-------|------------|',
  ]

  for (const p of thin) {
    lines.push(`| ${p.url} | ${p.title} | ${p.wordCount} |`)
  }

  return lines.join('\n')
}

function keywordCheck(pages: CrawledPage[], keyword: string): string {
  const term = keyword.toLowerCase()
  const results = pages.map(p => {
    const inTitle = p.title.toLowerCase().includes(term)
    const inH1 = p.headings.some(h => h.level === 1 && h.text.toLowerCase().includes(term))
    const inH2 = p.headings.some(h => h.level === 2 && h.text.toLowerCase().includes(term))
    const inContent = p.content.toLowerCase().includes(term)

    // Count occurrences in content
    const contentLower = p.content.toLowerCase()
    let count = 0
    let idx = contentLower.indexOf(term)
    while (idx !== -1) {
      count++
      idx = contentLower.indexOf(term, idx + 1)
    }

    return { url: p.url, title: p.title, inTitle, inH1, inH2, inContent, count }
  }).filter(r => r.count > 0)

  if (results.length === 0) {
    return `No pages use the keyword "${keyword}".`
  }

  results.sort((a, b) => b.count - a.count)

  const lines: string[] = [
    `**Keyword Check: "${keyword}"** (${results.length} pages)`,
    '',
    '| Page | Title | In Title | In H1 | In H2 | Occurrences |',
    '|------|-------|----------|-------|-------|-------------|',
  ]

  for (const r of results) {
    lines.push(
      `| ${r.url} | ${r.title} | ${r.inTitle ? 'Yes' : 'No'} | ${r.inH1 ? 'Yes' : 'No'} | ${r.inH2 ? 'Yes' : 'No'} | ${r.count} |`
    )
  }

  return lines.join('\n')
}
