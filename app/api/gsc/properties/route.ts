import { NextResponse } from 'next/server'
import { readJSON, writeJSON } from '@/lib/store'
import { getValidToken, listProperties } from '@/lib/gsc/client'
import type { AppConfig } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const config = await readJSON<AppConfig>('config.json')
    const { token, config: updatedConfig } = await getValidToken(config)

    // Persist refreshed tokens if they changed
    if (updatedConfig !== config) {
      await writeJSON('config.json', updatedConfig)
    }

    const properties = await listProperties(token)
    return NextResponse.json({ properties })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list properties' },
      { status: 500 }
    )
  }
}
