import { NextRequest, NextResponse } from 'next/server'
import { readJSON, writeJSON } from '@/lib/store'
import { exchangeCode, getGoogleCreds } from '@/lib/gsc/client'
import type { AppConfig } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code')
    if (!code) {
      return NextResponse.json({ error: 'Missing authorization code' }, { status: 400 })
    }

    const { clientId, clientSecret, redirectUri } = getGoogleCreds()
    const tokens = await exchangeCode(code, clientId, clientSecret, redirectUri)

    const config = await readJSON<AppConfig>('config.json')
    const updatedConfig: AppConfig = {
      ...config,
      google: { ...config.google, tokens },
    }
    await writeJSON('config.json', updatedConfig)

    return NextResponse.redirect(new URL('/onboarding?step=property', request.url))
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'OAuth callback failed' },
      { status: 500 }
    )
  }
}
