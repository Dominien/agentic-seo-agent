'use client'

import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function GoogleConnect() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleConnect() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/google')
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError('Failed to get authorization URL')
      }
    } catch {
      setError('Failed to connect to Google')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connect Google Search Console</CardTitle>
        <CardDescription>
          Link your Google Search Console account to analyze your search performance data,
          track keyword rankings, and get AI-powered SEO recommendations.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Before you start:</p>
          <p className="mb-2">Make sure your <code className="text-xs bg-muted px-1 py-0.5 rounded">.env.local</code> file has these variables set:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li><code className="text-xs bg-muted px-1 py-0.5 rounded">GOOGLE_CLIENT_ID</code> and <code className="text-xs bg-muted px-1 py-0.5 rounded">GOOGLE_CLIENT_SECRET</code> from Google Cloud Console</li>
            <li><code className="text-xs bg-muted px-1 py-0.5 rounded">OPENAI_API_KEY</code> or <code className="text-xs bg-muted px-1 py-0.5 rounded">ANTHROPIC_API_KEY</code> for the AI chat</li>
          </ul>
          <p className="mt-2 text-xs">See <a href="https://github.com/user/agentic-seo/blob/main/docs/google-oauth-setup.md" className="underline">setup guide</a> for details. Don't forget to add yourself as a <strong>test user</strong> in the OAuth consent screen.</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">What we access:</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Search performance data (queries, clicks, impressions)</li>
            <li>Site property information</li>
            <li>URL inspection data</li>
          </ul>
        </div>
        <Button onClick={handleConnect} disabled={loading} size="lg" className="w-full">
          {loading ? 'Connecting...' : 'Connect Google Search Console'}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  )
}
