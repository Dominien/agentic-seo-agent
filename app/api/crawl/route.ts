import { NextRequest } from 'next/server'
import { parseSitemap } from '@/lib/crawler/sitemap'
import { crawlSite } from '@/lib/crawler/page'
import { writeProjectJSON, getActiveProjectId } from '@/lib/store'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { siteUrl: rawSiteUrl, maxPages = 50 } = body

  if (!rawSiteUrl || typeof rawSiteUrl !== 'string') {
    return new Response(JSON.stringify({ error: 'siteUrl is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let projectId: string
  try {
    projectId = await getActiveProjectId()
  } catch {
    return new Response(JSON.stringify({ error: 'No active project' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // GSC domain properties are prefixed with "sc-domain:" — convert to https URL
  const siteUrl = rawSiteUrl.startsWith('sc-domain:')
    ? `https://${rawSiteUrl.replace('sc-domain:', '')}`
    : rawSiteUrl

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // Fetch sitemap
        const sitemapUrls = await parseSitemap(siteUrl)
        const urlsToCrawl = sitemapUrls.length > 0
          ? sitemapUrls.map(u => u.loc)
          : [siteUrl]

        // Crawl pages with progress
        const pages = await crawlSite(urlsToCrawl, maxPages, (current, total, url) => {
          sendEvent({ type: 'progress', current, total, url })
        })

        // Save results to project directory
        await writeProjectJSON(projectId, 'site-context.json', pages)
        await writeProjectJSON(projectId, 'sitemap.json', sitemapUrls)

        sendEvent({ type: 'complete', pages: pages.length })
      } catch (err) {
        sendEvent({
          type: 'error',
          error: err instanceof Error ? err.message : 'Crawl failed',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
