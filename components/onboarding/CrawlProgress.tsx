'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'

export function CrawlProgress() {
  const router = useRouter()
  const [status, setStatus] = useState('Starting...')
  const [currentUrl, setCurrentUrl] = useState('')
  const [crawled, setCrawled] = useState(0)
  const [total, setTotal] = useState(0)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    // Fire and forget GSC sync
    fetch('/api/gsc/sync', { method: 'POST' }).catch(() => {})

    // Start crawl with SSE
    async function startCrawl() {
      try {
        const projRes = await fetch('/api/projects')
        const projData = await projRes.json()
        const activeProject = (projData.projects || []).find(
          (p: { id: string }) => p.id === projData.activeProjectId
        )
        const siteUrl = activeProject?.siteUrl
        if (!siteUrl) {
          setError('No site URL configured')
          return
        }

        const res = await fetch('/api/crawl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl }),
        })

        if (!res.ok || !res.body) {
          setError('Failed to start crawl')
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done: readerDone, value } = await reader.read()
          if (readerDone) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (!data) continue

            try {
              const event = JSON.parse(data)
              if (event.type === 'progress') {
                setStatus('Crawling...')
                setCrawled(event.current || 0)
                setTotal(event.total || 0)
                setCurrentUrl(event.url || '')
              } else if (event.type === 'complete') {
                setCrawled(event.pages || 0)
                setTotal(event.pages || 0)
                setDone(true)
                setStatus('Crawl complete!')
              } else if (event.type === 'error') {
                setError(event.message || 'Crawl error')
              }
            } catch {
              // skip malformed events
            }
          }
        }

        if (!done) {
          setDone(true)
          setStatus('Crawl complete!')
        }
      } catch {
        setError('Failed to crawl site')
      }
    }

    startCrawl()
  }, [done])

  useEffect(() => {
    if (done && !error) {
      const timer = setTimeout(() => router.push('/onboarding?step=ready'), 1500)
      return () => clearTimeout(timer)
    }
  }, [done, error, router])

  const progress = total > 0 ? Math.round((crawled / total) * 100) : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Crawling Your Site</CardTitle>
        <CardDescription>
          Analyzing your site content and syncing search console data.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{status}</span>
            <span className="font-mono text-muted-foreground">
              {crawled}/{total || '?'}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          {currentUrl && (
            <p className="truncate text-xs text-muted-foreground">{currentUrl}</p>
          )}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {done && !error && (
          <p className="text-sm text-center text-muted-foreground">
            Redirecting...
          </p>
        )}
      </CardContent>
    </Card>
  )
}
