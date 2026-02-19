import type { ToolDefinition, CrawledPage, SitemapUrl } from '../types'
import { readProjectJSON, getActiveProjectId } from '../store'

export const definition: ToolDefinition = {
  name: 'link_suggester',
  description:
    'Find internal linking opportunities. Can suggest links for a specific page, find pages that could link using a given anchor text/keyword, or list all known site URLs from the sitemap.',
  parameters: {
    type: 'object',
    properties: {
      pageUrl: {
        type: 'string',
        description: 'Suggest internal links for this specific page URL',
      },
      keyword: {
        type: 'string',
        description: 'Find pages that could link using this anchor text/keyword',
      },
      listAllUrls: {
        type: 'boolean',
        description: 'If true, list all known URLs from the sitemap (useful for finding link targets)',
      },
    },
  },
}

interface LinkSuggestion {
  source: string
  target: string
  anchor: string
  reason: string
}

export async function execute(args: Record<string, unknown>): Promise<string> {
  const pageUrl = args.pageUrl as string | undefined
  const keyword = args.keyword as string | undefined
  const listAllUrls = args.listAllUrls as boolean | undefined

  // Load sitemap URLs
  let sitemapUrls: string[] = []
  try {
    const projectId = await getActiveProjectId()
    const sitemap = await readProjectJSON<SitemapUrl[]>(projectId, 'sitemap.json')
    if (Array.isArray(sitemap)) {
      sitemapUrls = sitemap.map(u => u.loc)
    }
  } catch {
    // no sitemap
  }

  // If just listing all URLs
  if (listAllUrls) {
    if (sitemapUrls.length === 0) {
      return 'No sitemap data available. Please crawl the site first.'
    }
    const lines = [
      `**All Known Site URLs** (${sitemapUrls.length} pages from sitemap)`,
      '',
      ...sitemapUrls.map(u => `- ${u}`),
    ]
    return lines.join('\n')
  }

  if (!pageUrl && !keyword) {
    return 'Please provide either a pageUrl, keyword, or set listAllUrls to true.'
  }

  // Load crawled pages — file is a flat array
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

  const suggestions: LinkSuggestion[] = []

  if (pageUrl) {
    const targetPage = pages.find(p => p.url === pageUrl || p.url.includes(pageUrl))
    if (!targetPage) {
      return `Page not found: "${pageUrl}". Known URLs from sitemap: ${sitemapUrls.length}`
    }
    findLinksForPage(targetPage, pages, suggestions)

    // Also suggest linking to sitemap URLs not yet linked from this page
    const existingLinks = new Set(targetPage.internalLinks.map(l => l.toLowerCase()))
    const unlinkedSitemapUrls = sitemapUrls.filter(
      u => u.toLowerCase() !== targetPage.url.toLowerCase() && !existingLinks.has(u.toLowerCase())
    )
    if (unlinkedSitemapUrls.length > 0) {
      suggestions.push(
        ...unlinkedSitemapUrls.slice(0, 5).map(u => ({
          source: targetPage.url,
          target: u,
          anchor: urlToSlug(u),
          reason: 'Sitemap page not yet linked from this page',
        }))
      )
    }
  }

  if (keyword) {
    findLinksForKeyword(keyword, pages, suggestions)
  }

  if (suggestions.length === 0) {
    return 'No internal linking opportunities found.'
  }

  // Deduplicate
  const seen = new Set<string>()
  const unique = suggestions.filter(s => {
    const key = `${s.source}->${s.target}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const lines: string[] = [
    `**Internal Linking Opportunities** (${unique.length} suggestions)`,
    '',
    '| Source Page | Target Page | Suggested Anchor | Reason |',
    '|-----------|-------------|-----------------|--------|',
  ]

  for (const s of unique.slice(0, 20)) {
    lines.push(`| ${s.source} | ${s.target} | ${s.anchor} | ${s.reason} |`)
  }

  return lines.join('\n')
}

function findLinksForPage(
  targetPage: CrawledPage,
  allPages: CrawledPage[],
  suggestions: LinkSuggestion[]
): void {
  // Extract key topics from the target page's headings
  const pageTopics = targetPage.headings
    .filter(h => h.level <= 2)
    .map(h => h.text.toLowerCase())

  const existingLinks = new Set(targetPage.internalLinks.map(l => l.toLowerCase()))

  for (const otherPage of allPages) {
    if (otherPage.url === targetPage.url) continue
    if (existingLinks.has(otherPage.url.toLowerCase())) continue

    // Check if the other page's content mentions topics from target page
    const otherContent = otherPage.content.toLowerCase()
    for (const topic of pageTopics) {
      if (topic.length > 3 && otherContent.includes(topic)) {
        suggestions.push({
          source: otherPage.url,
          target: targetPage.url,
          anchor: topic,
          reason: `"${topic}" appears in source content`,
        })
        break
      }
    }

    // Check if target page mentions topics from other page
    const targetContent = targetPage.content.toLowerCase()
    const otherTopics = otherPage.headings
      .filter(h => h.level <= 2)
      .map(h => h.text.toLowerCase())

    for (const topic of otherTopics) {
      if (topic.length > 3 && targetContent.includes(topic)) {
        suggestions.push({
          source: targetPage.url,
          target: otherPage.url,
          anchor: topic,
          reason: `"${topic}" appears in source content`,
        })
        break
      }
    }
  }
}

function findLinksForKeyword(
  keyword: string,
  allPages: CrawledPage[],
  suggestions: LinkSuggestion[]
): void {
  const kwLower = keyword.toLowerCase()

  // Find pages that mention this keyword
  const mentioningPages = allPages.filter(p => p.content.toLowerCase().includes(kwLower))

  // Find the best target page (most relevant to the keyword)
  const targetPage = allPages
    .map(p => {
      let score = 0
      if (p.title.toLowerCase().includes(kwLower)) score += 10
      if (p.headings.some(h => h.level === 1 && h.text.toLowerCase().includes(kwLower))) score += 8
      if (p.headings.some(h => h.level === 2 && h.text.toLowerCase().includes(kwLower))) score += 5

      // Count keyword occurrences
      const content = p.content.toLowerCase()
      let idx = content.indexOf(kwLower)
      while (idx !== -1) {
        score += 1
        idx = content.indexOf(kwLower, idx + 1)
      }
      return { page: p, score }
    })
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)

  if (targetPage.length === 0) return

  const bestTarget = targetPage[0].page

  // Suggest links from mentioning pages to the best target
  for (const sourcePage of mentioningPages) {
    if (sourcePage.url === bestTarget.url) continue

    const alreadyLinks = sourcePage.internalLinks.some(
      l => l.toLowerCase() === bestTarget.url.toLowerCase()
    )
    if (alreadyLinks) continue

    suggestions.push({
      source: sourcePage.url,
      target: bestTarget.url,
      anchor: keyword,
      reason: `Source mentions "${keyword}", target is the most relevant page`,
    })
  }
}

function urlToSlug(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const slug = pathname.replace(/^\/|\/$/g, '').split('/').pop() || ''
    return slug.replace(/[-_]/g, ' ').replace(/\.[^.]+$/, '') || url
  } catch {
    return url
  }
}
