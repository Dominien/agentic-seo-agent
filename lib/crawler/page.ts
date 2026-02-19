import * as cheerio from 'cheerio'
import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import type { CrawledPage } from '@/lib/types'

export async function crawlPage(url: string): Promise<CrawledPage> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15000),
    headers: {
      'User-Agent': 'AgenticSEO-Crawler/1.0',
      'Accept': 'text/html,application/xhtml+xml',
    },
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`)
  }

  const html = await res.text()

  // Use cheerio for metadata extraction
  const $ = cheerio.load(html)

  const title = $('title').first().text().trim()
  const description = $('meta[name="description"]').attr('content')?.trim() || ''

  const headings: { level: number; text: string }[] = []
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const tag = $(el).prop('tagName')?.toLowerCase() || ''
    const level = parseInt(tag.replace('h', ''), 10)
    const text = $(el).text().trim()
    if (text) {
      headings.push({ level, text })
    }
  })

  const pageHost = new URL(url).hostname
  const internalLinks: string[] = []
  const seen = new Set<string>()

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href')
    if (!href) return
    try {
      const resolved = new URL(href, url).href
      if (new URL(resolved).hostname === pageHost && !seen.has(resolved)) {
        seen.add(resolved)
        internalLinks.push(resolved)
      }
    } catch {
      // skip invalid URLs
    }
  })

  // Use JSDOM + Readability for content extraction
  let content = ''
  try {
    const dom = new JSDOM(html, { url })
    const reader = new Readability(dom.window.document)
    const article = reader.parse()
    content = article?.textContent?.trim() || ''
  } catch {
    // Fallback: extract body text via cheerio
    $('script, style, nav, footer, header').remove()
    content = $('body').text().replace(/\s+/g, ' ').trim()
  }

  const wordCount = content ? content.split(/\s+/).filter(Boolean).length : 0

  return {
    url,
    title,
    description,
    headings,
    content,
    internalLinks,
    wordCount,
    crawledAt: new Date().toISOString(),
  }
}

export async function crawlSite(
  urls: string[],
  maxPages: number,
  onProgress?: (current: number, total: number, url: string) => void
): Promise<CrawledPage[]> {
  const pagesToCrawl = urls.slice(0, maxPages)
  const total = pagesToCrawl.length
  const pages: CrawledPage[] = []
  let completed = 0

  // Simple semaphore for concurrency limiting
  const concurrency = 5
  let running = 0
  let index = 0

  await new Promise<void>((resolve) => {
    function next() {
      while (running < concurrency && index < pagesToCrawl.length) {
        const url = pagesToCrawl[index++]
        running++

        crawlPage(url)
          .then((page) => {
            pages.push(page)
          })
          .catch(() => {
            // Skip pages that fail to crawl
          })
          .finally(() => {
            running--
            completed++
            onProgress?.(completed, total, url)
            if (completed === total) {
              resolve()
            } else {
              next()
            }
          })
      }
    }

    if (pagesToCrawl.length === 0) {
      resolve()
    } else {
      next()
    }
  })

  return pages
}
