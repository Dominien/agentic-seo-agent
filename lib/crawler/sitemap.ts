import * as cheerio from 'cheerio'
import type { SitemapUrl } from '@/lib/types'

export async function parseSitemap(siteUrl: string): Promise<SitemapUrl[]> {
  const base = siteUrl.replace(/\/+$/, '')
  const urls = new Map<string, SitemapUrl>()

  // Try common sitemap paths
  const commonPaths = [
    '/sitemap.xml',
    '/sitemap_index.xml',
    '/sitemap/',
  ]

  for (const p of commonPaths) {
    const found = await fetchAndParseSitemap(`${base}${p}`, urls, base)
    if (found) break
  }

  // If no URLs found, check robots.txt for Sitemap directives
  if (urls.size === 0) {
    const robotsUrl = `${base}/robots.txt`
    try {
      const res = await fetch(robotsUrl, { signal: AbortSignal.timeout(10000) })
      if (res.ok) {
        const text = await res.text()
        const sitemapDirectives = text
          .split('\n')
          .filter(line => line.toLowerCase().startsWith('sitemap:'))
          .map(line => line.slice(line.indexOf(':') + 1).trim())

        for (const url of sitemapDirectives) {
          if (url) {
            await fetchAndParseSitemap(url, urls, base)
          }
        }
      }
    } catch {
      // robots.txt not available, continue
    }
  }

  return Array.from(urls.values())
}

async function fetchAndParseSitemap(
  url: string,
  urls: Map<string, SitemapUrl>,
  baseDomain: string
): Promise<boolean> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AgenticSEO/1.0)',
        'Accept': 'application/xml, text/xml, */*',
      },
    })
    if (!res.ok) return false

    const xml = await res.text()
    const $ = cheerio.load(xml, { xmlMode: true })

    // Check if this is a sitemap index
    const sitemapLocs = $('sitemapindex sitemap loc')
    if (sitemapLocs.length > 0) {
      for (const el of sitemapLocs.toArray()) {
        const childUrl = $(el).text().trim()
        if (childUrl) {
          await fetchAndParseSitemap(childUrl, urls, baseDomain)
        }
      }
      return urls.size > 0
    }

    // Parse as regular sitemap
    const baseHost = extractRootDomain(baseDomain)
    $('urlset url').each((_, el) => {
      const loc = $(el).find('loc').text().trim()
      const lastmod = $(el).find('lastmod').text().trim() || undefined

      if (loc && isSameSite(loc, baseHost)) {
        urls.set(loc, { loc, lastmod })
      }
    })

    return urls.size > 0
  } catch {
    return false
  }
}

/**
 * Extract root domain (e.g. "example.com" from "https://www.example.com")
 * so that www and non-www variants both match.
 */
function extractRootDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname
    // Strip leading "www."
    return hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Check if a URL belongs to the same site, allowing www/non-www mismatch.
 */
function isSameSite(url: string, rootDomain: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '')
    return hostname === rootDomain
  } catch {
    return false
  }
}
