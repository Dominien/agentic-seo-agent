import { NextRequest, NextResponse } from 'next/server'
import { readProjectJSON, writeProjectJSON, getActiveProjectId } from '@/lib/store'
import type { CrawledPage } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const projectId = await getActiveProjectId()
    const pages = await readProjectJSON<CrawledPage[]>(projectId, 'site-context.json')
    return NextResponse.json({ pages })
  } catch {
    return NextResponse.json({ pages: [] })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const projectId = await getActiveProjectId()
    const { pages } = await request.json()
    await writeProjectJSON(projectId, 'site-context.json', pages)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const projectId = await getActiveProjectId()
    const { url } = await request.json()
    const pages = await readProjectJSON<CrawledPage[]>(projectId, 'site-context.json')
    const filtered = pages.filter((p) => p.url !== url)
    await writeProjectJSON(projectId, 'site-context.json', filtered)
    return NextResponse.json({ ok: true, remaining: filtered.length })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete' },
      { status: 500 }
    )
  }
}
