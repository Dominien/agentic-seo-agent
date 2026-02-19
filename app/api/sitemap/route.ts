import { NextResponse } from 'next/server'
import { readProjectJSON, getActiveProjectId } from '@/lib/store'
import type { SitemapUrl } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const projectId = await getActiveProjectId()
    const urls = await readProjectJSON<SitemapUrl[]>(projectId, 'sitemap.json')
    return NextResponse.json({ urls: Array.isArray(urls) ? urls : [] })
  } catch {
    return NextResponse.json({ urls: [] })
  }
}
