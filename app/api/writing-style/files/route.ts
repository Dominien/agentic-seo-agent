import { NextRequest, NextResponse } from 'next/server'
import { getActiveProjectId, projectPath, listFiles, readMarkdown, writeMarkdown } from '@/lib/store'

export const runtime = 'nodejs'

const STYLE_FILES = ['ANTI_WORDS.md', 'TONE.md', 'STRUCTURE.md', 'EXAMPLES.md', 'CONTEXT.md', 'SENTENCE_STYLE.md']

export async function GET() {
  try {
    const projectId = await getActiveProjectId()
    const existing = await listFiles(projectPath(projectId, 'writing'))
    const files: { name: string; content: string }[] = []

    for (const name of STYLE_FILES) {
      if (existing.includes(name)) {
        const content = await readMarkdown(projectPath(projectId, `writing/${name}`))
        files.push({ name, content })
      }
    }

    return NextResponse.json({ files })
  } catch {
    return NextResponse.json({ files: [] })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const projectId = await getActiveProjectId()
    const { name, content } = await request.json()

    if (!STYLE_FILES.includes(name)) {
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 })
    }

    await writeMarkdown(projectPath(projectId, `writing/${name}`), content)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save' },
      { status: 500 }
    )
  }
}
