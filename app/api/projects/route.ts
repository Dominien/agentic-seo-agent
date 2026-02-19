import { NextRequest, NextResponse } from 'next/server'
import { readJSON, writeJSON, writeProjectJSON } from '@/lib/store'
import { siteUrlToSlug } from '@/lib/store/migrate'
import type { AppConfig, ProjectConfig } from '@/lib/types'
import { promises as fs } from 'fs'
import path from 'path'

export const runtime = 'nodejs'

// GET — List all projects
export async function GET() {
  try {
    const config = await readJSON<AppConfig>('config.json')
    return NextResponse.json({
      projects: config.projects || [],
      activeProjectId: config.activeProjectId,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read projects' },
      { status: 500 }
    )
  }
}

// POST — Create new project
export async function POST(request: NextRequest) {
  try {
    const { siteUrl, name } = await request.json()
    if (!siteUrl) {
      return NextResponse.json({ error: 'siteUrl is required' }, { status: 400 })
    }

    const config = await readJSON<AppConfig>('config.json')
    const slug = siteUrlToSlug(siteUrl)
    const displayName = name || siteUrl.replace('sc-domain:', '').replace(/^https?:\/\//, '').replace(/\/$/, '')

    // Check if project already exists
    if (config.projects?.some(p => p.id === slug)) {
      // Just switch to it
      config.activeProjectId = slug
      await writeJSON('config.json', config)
      return NextResponse.json({ project: config.projects.find(p => p.id === slug), activeProjectId: slug })
    }

    const project: ProjectConfig = {
      id: slug,
      name: displayName,
      siteUrl,
      createdAt: new Date().toISOString(),
    }

    // Write project.json
    await writeProjectJSON(slug, 'project.json', project)

    // Update config
    if (!config.projects) config.projects = []
    config.projects.push(project)
    config.activeProjectId = slug
    await writeJSON('config.json', config)

    return NextResponse.json({ project, activeProjectId: slug })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create project' },
      { status: 500 }
    )
  }
}

// PATCH — Switch active project
export async function PATCH(request: NextRequest) {
  try {
    const { activeProjectId } = await request.json()
    if (!activeProjectId) {
      return NextResponse.json({ error: 'activeProjectId is required' }, { status: 400 })
    }

    const config = await readJSON<AppConfig>('config.json')

    const project = config.projects?.find(p => p.id === activeProjectId)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    config.activeProjectId = activeProjectId
    await writeJSON('config.json', config)

    return NextResponse.json({ activeProjectId, project })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to switch project' },
      { status: 500 }
    )
  }
}

// DELETE — Remove project
export async function DELETE(request: NextRequest) {
  try {
    const { projectId } = await request.json()
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const config = await readJSON<AppConfig>('config.json')
    config.projects = (config.projects || []).filter(p => p.id !== projectId)

    // If deleting the active project, switch to the first remaining project
    if (config.activeProjectId === projectId) {
      config.activeProjectId = config.projects[0]?.id
    }

    await writeJSON('config.json', config)

    // Remove project directory
    const projDir = path.join(process.cwd(), 'data', 'projects', projectId)
    try {
      await fs.rm(projDir, { recursive: true })
    } catch {
      // Directory may not exist
    }

    return NextResponse.json({ ok: true, activeProjectId: config.activeProjectId })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete project' },
      { status: 500 }
    )
  }
}
