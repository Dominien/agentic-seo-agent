import { NextRequest, NextResponse } from 'next/server'
import { readJSON, writeJSON } from '@/lib/store'
import type { AppConfig } from '@/lib/types'

export const runtime = 'nodejs'

function redactConfig(config: AppConfig): Record<string, unknown> {
  return {
    ...config,
    google: {
      ...config.google,
      tokens: config.google.tokens
        ? {
            ...config.google.tokens,
            access_token: '***',
            refresh_token: '***',
          }
        : undefined,
    },
  }
}

export async function GET() {
  try {
    const config = await readJSON<AppConfig>('config.json')
    return NextResponse.json(redactConfig(config))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read config' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const updates = await request.json()
    const config = await readJSON<AppConfig>('config.json')

    const merged = deepMerge(
      config as unknown as Record<string, unknown>,
      updates as Record<string, unknown>
    ) as unknown as AppConfig
    await writeJSON('config.json', merged)

    return NextResponse.json(redactConfig(merged))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update config' },
      { status: 500 }
    )
  }
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    const targetVal = target[key]
    const sourceVal = source[key]
    if (
      targetVal &&
      sourceVal &&
      typeof targetVal === 'object' &&
      typeof sourceVal === 'object' &&
      !Array.isArray(targetVal) &&
      !Array.isArray(sourceVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      )
    } else {
      result[key] = sourceVal
    }
  }
  return result
}
