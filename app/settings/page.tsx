'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { AppConfig } from '@/lib/types'

export default function SettingsPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-3 md:px-8">
          <Button variant="ghost" size="sm" onClick={() => router.push('/chat')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </Button>
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6 md:px-8 space-y-6">
        <AgentInstructions />
        <AdvancedSection />
        <DangerZone />
      </div>
    </div>
  )
}

/* ── Agent Instructions ── */

function AgentInstructions() {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/config?file=AGENT.md')
        if (res.ok) {
          const data = await res.json()
          setContent(data.content || '')
        }
      } catch {
        // ignore
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentMd: content }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // ignore
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="h-4 w-40 rounded bg-muted animate-pulse" />
        <div className="mt-4 h-48 rounded bg-muted/50 animate-pulse" />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20V10M18 20V4M6 20v-4" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Agent Instructions</h2>
            <p className="text-xs text-muted-foreground">Customize how the AI agent behaves and responds</p>
          </div>
        </div>
      </div>
      <div className="p-5 space-y-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[320px] font-mono text-xs leading-relaxed bg-muted/20 border-border/60"
          placeholder="Write custom instructions for your SEO agent...&#10;&#10;Example:&#10;- Always suggest content briefs in German&#10;- Focus on long-tail keywords&#10;- Prioritize blog content over landing pages"
        />
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">
            This is the AGENT.md system prompt — it shapes every response.
          </p>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ── Advanced Section ── */

function AdvancedSection() {
  const [maxTokens, setMaxTokens] = useState(4096)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [memoryFiles, setMemoryFiles] = useState<string[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [configRes, memoryRes] = await Promise.all([
          fetch('/api/config'),
          fetch('/api/config?list=memory'),
        ])
        const config: AppConfig = await configRes.json()
        setMaxTokens(config.provider?.maxTokens || 4096)
        if (memoryRes.ok) {
          const data = await memoryRes.json()
          setMemoryFiles(data.files || [])
        }
      } catch {
        // ignore
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSaveTokens() {
    setSaving(true)
    setSaved(false)
    try {
      await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: { maxTokens } }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // ignore
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="h-4 w-32 rounded bg-muted animate-pulse" />
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold">Advanced</h2>
            <p className="text-xs text-muted-foreground">Model and provider are configured in the chat sidebar</p>
          </div>
        </div>
      </div>
      <div className="p-5 space-y-4">
        {/* Max tokens */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-sm font-medium">Max Tokens</p>
            <p className="text-xs text-muted-foreground">Maximum response length per message</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(Number(e.target.value))}
              className="h-8 w-24 text-sm text-center"
            />
            <Button size="sm" variant="outline" onClick={handleSaveTokens} disabled={saving}>
              {saving ? '...' : saved ? 'Done' : 'Save'}
            </Button>
          </div>
        </div>

        {/* Memory files */}
        {memoryFiles.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Agent Memory</p>
            <div className="rounded-lg border border-border/60 bg-muted/10 divide-y divide-border/40">
              {memoryFiles.map((file) => (
                <div key={file} className="flex items-center gap-2 px-3 py-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted-foreground flex-shrink-0">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-xs font-mono text-muted-foreground">{file}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Env hint */}
        <div className="rounded-lg bg-muted/30 px-4 py-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            API keys are managed via environment variables in <code className="rounded bg-muted px-1 py-0.5 text-[11px] font-mono">
            .env.local</code> — OPENAI_API_KEY, ANTHROPIC_API_KEY, OPENROUTER_API_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Danger Zone ── */

function DangerZone() {
  const [status, setStatus] = useState('')

  async function handleClearHistory() {
    if (!confirm('Are you sure? This will permanently delete all chat history.')) return
    try {
      await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearHistory: true }),
      })
      setStatus('Chat history cleared')
      setTimeout(() => setStatus(''), 3000)
    } catch {
      setStatus('Failed to clear history')
    }
  }

  return (
    <div className="rounded-xl border border-destructive/20 bg-card overflow-hidden">
      <div className="px-5 py-4 border-b border-destructive/10">
        <h2 className="text-sm font-semibold text-destructive">Danger Zone</h2>
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Clear Chat History</p>
            <p className="text-xs text-muted-foreground">Remove all messages — this cannot be undone</p>
          </div>
          <Button size="sm" variant="destructive" onClick={handleClearHistory}>
            Clear
          </Button>
        </div>
        {status && (
          <p className="mt-3 text-xs text-muted-foreground">{status}</p>
        )}
      </div>
    </div>
  )
}
