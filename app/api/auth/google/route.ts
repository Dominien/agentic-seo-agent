import { NextResponse } from 'next/server'
import { getAuthUrl, getGoogleCreds } from '@/lib/gsc/client'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const { clientId, redirectUri } = getGoogleCreds()
    const url = getAuthUrl(clientId, redirectUri)
    return NextResponse.json({ url })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate auth URL' },
      { status: 500 }
    )
  }
}
