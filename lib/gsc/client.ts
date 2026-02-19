import type { AppConfig, GoogleTokens, GSCQueryRow } from '../types'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GSC_API_BASE = 'https://www.googleapis.com/webmasters/v3'
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'

export function getGoogleCreds() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback'

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local')
  }

  return { clientId, clientSecret, redirectUri }
}

export function getAuthUrl(clientId: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    access_type: 'offline',
    prompt: 'consent',
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export async function exchangeCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<GoogleTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  const data = await res.json()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: data.token_type,
    expiry_date: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  }
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<GoogleTokens> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Token refresh failed: ${error}`)
  }

  const data = await res.json()
  return {
    access_token: data.access_token,
    refresh_token: refreshToken,
    token_type: data.token_type,
    expiry_date: Date.now() + data.expires_in * 1000,
    scope: data.scope,
  }
}

export async function getValidToken(
  config: AppConfig
): Promise<{ token: string; config: AppConfig }> {
  const tokens = config.google.tokens
  if (!tokens) {
    throw new Error('No Google tokens found. Please authenticate first.')
  }

  // Refresh if token expires within 5 minutes
  if (tokens.expiry_date < Date.now() + 5 * 60 * 1000) {
    const { clientId, clientSecret } = getGoogleCreds()
    const newTokens = await refreshAccessToken(
      tokens.refresh_token,
      clientId,
      clientSecret
    )
    const updatedConfig: AppConfig = {
      ...config,
      google: { ...config.google, tokens: newTokens },
    }
    return { token: newTokens.access_token, config: updatedConfig }
  }

  return { token: tokens.access_token, config }
}

export async function listProperties(
  accessToken: string
): Promise<{ siteUrl: string; permissionLevel: string }[]> {
  const res = await fetch(`${GSC_API_BASE}/sites`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Failed to list properties: ${error}`)
  }

  const data = await res.json()
  return (data.siteEntry || []).map(
    (entry: { siteUrl: string; permissionLevel: string }) => ({
      siteUrl: entry.siteUrl,
      permissionLevel: entry.permissionLevel,
    })
  )
}

export async function querySearchAnalytics(
  accessToken: string,
  siteUrl: string,
  params: {
    startDate: string
    endDate: string
    dimensions: string[]
    rowLimit?: number
    startRow?: number
  }
): Promise<GSCQueryRow[]> {
  const encodedSiteUrl = encodeURIComponent(siteUrl)
  const url = `${GSC_API_BASE}/sites/${encodedSiteUrl}/searchAnalytics/query`

  const body: Record<string, unknown> = {
    startDate: params.startDate,
    endDate: params.endDate,
    dimensions: params.dimensions,
    rowLimit: params.rowLimit ?? 25000,
    startRow: params.startRow ?? 0,
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const error = await res.text()
    throw new Error(`Search analytics query failed: ${error}`)
  }

  const data = await res.json()
  if (!data.rows) return []

  return data.rows.map(
    (row: { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }) => {
      const result: GSCQueryRow = {
        query: '',
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      }

      params.dimensions.forEach((dim, i) => {
        if (dim === 'query') result.query = row.keys[i]
        if (dim === 'page') result.page = row.keys[i]
        if (dim === 'date') result.date = row.keys[i]
      })

      return result
    }
  )
}
