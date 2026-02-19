import { NextResponse } from 'next/server'
import { readJSON, getActiveProjectId } from '@/lib/store'
import { syncGSCData } from '@/lib/gsc/sync'
import type { AppConfig } from '@/lib/types'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const config = await readJSON<AppConfig>('config.json')
    const projectId = await getActiveProjectId()
    const project = config.projects?.find(p => p.id === projectId)
    if (!project) {
      return NextResponse.json({ error: 'Active project not found' }, { status: 404 })
    }

    const result = await syncGSCData(config, projectId, project.siteUrl)

    return NextResponse.json({
      success: true,
      queryCount: result.queries.length,
      pageCount: result.pages.length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
