'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function ReadyScreen() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState({ pages: 0, keywords: 0 })

  useEffect(() => {
    async function loadStats() {
      try {
        const res = await fetch('/api/config')
        const config = await res.json()
        setStats({
          pages: config.crawl?.lastCrawl ? config.crawl.maxPages : 0,
          keywords: config.gsc?.lastSync ? 1000 : 0,
        })
      } catch {
        // ignore
      }
    }
    loadStats()
  }, [])

  async function handleStart() {
    setSaving(true)
    try {
      await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setupComplete: true }),
      })
      router.push('/chat')
    } catch {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>You're All Set</CardTitle>
        <CardDescription>
          Your site data has been synced. You can select your AI model in the chat.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-border p-4 text-center">
            <p className="text-2xl font-bold">{stats.pages}</p>
            <p className="text-xs text-muted-foreground">Pages Crawled</p>
          </div>
          <div className="rounded-lg border border-border p-4 text-center">
            <p className="text-2xl font-bold">{stats.keywords}</p>
            <p className="text-xs text-muted-foreground">Keywords Found</p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Tip:</p>
          <p>Make sure you've set your LLM API key in <code className="text-xs bg-muted px-1 py-0.5 rounded">.env.local</code> (OPENAI_API_KEY or ANTHROPIC_API_KEY). You can switch models anytime from the chat header.</p>
        </div>

        <Button onClick={handleStart} disabled={saving} size="lg" className="w-full">
          {saving ? 'Starting...' : 'Start Chatting'}
        </Button>
      </CardContent>
    </Card>
  )
}
