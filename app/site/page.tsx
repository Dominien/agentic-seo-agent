'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { CrawledPage, SitemapUrl } from '@/lib/types'

export default function SiteProfilePage() {
  const router = useRouter()
  const [pages, setPages] = useState<CrawledPage[]>([])
  const [sitemapUrls, setSitemapUrls] = useState<SitemapUrl[]>([])
  const [loading, setLoading] = useState(true)
  const [siteUrl, setSiteUrl] = useState('')
  const [projectName, setProjectName] = useState('')
  const [lastCrawled, setLastCrawled] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const [siteRes, projRes, sitemapRes] = await Promise.all([
          fetch('/api/site-context'),
          fetch('/api/projects'),
          fetch('/api/sitemap'),
        ])
        const siteData = await siteRes.json()
        const projData = await projRes.json()
        const activeProject = (projData.projects || []).find(
          (p: { id: string }) => p.id === projData.activeProjectId
        )
        setPages(siteData.pages || [])
        setSiteUrl(activeProject?.siteUrl || '')
        setProjectName(activeProject?.name || '')
        if (sitemapRes.ok) {
          const smData = await sitemapRes.json()
          setSitemapUrls(smData.urls || [])
        }
        if (siteData.pages?.length) {
          const dates = siteData.pages.map((p: CrawledPage) => p.crawledAt).filter(Boolean)
          if (dates.length) setLastCrawled(dates.sort().pop()!)
        }
      } catch {
        // ignore
      }
      setLoading(false)
    }
    load()
  }, [])

  const crawledUrls = new Set(pages.map((p) => p.url))

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3 md:px-8">
          <Button variant="ghost" size="sm" onClick={() => router.push('/chat')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">
              {projectName || 'Site Profile'}
            </h1>
            <p className="text-xs text-muted-foreground">
              {siteUrl ? siteUrl.replace('sc-domain:', '') : 'No site connected'}
            </p>
          </div>
          {pages.length > 0 && <SiteActions siteUrl={siteUrl} />}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
        {loading ? (
          <LoadingSkeleton />
        ) : pages.length === 0 ? (
          <EmptyState onNavigate={() => router.push('/settings')} />
        ) : (
          <>
            {/* Stats overview */}
            <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3">
              <StatCard label="Pages Crawled" value={pages.length} />
              <StatCard label="Sitemap URLs" value={sitemapUrls.length} />
              <StatCard
                label="Last Crawled"
                value={lastCrawled ? timeAgo(lastCrawled) : 'Never'}
              />
            </div>

            {/* Sitemap URLs */}
            {sitemapUrls.length > 0 && (
              <SitemapSection urls={sitemapUrls} crawledUrls={crawledUrls} />
            )}

            {/* Writing style files */}
            <WritingStyleSection />

            {/* Page list */}
            <div className="space-y-4">
              {pages.map((page, i) => (
                <PageCard
                  key={page.url}
                  page={page}
                  onUpdate={(updated) => {
                    const next = [...pages]
                    next[i] = updated
                    setPages(next)
                  }}
                  onDelete={() => {
                    setPages(pages.filter((_, j) => j !== i))
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Stat Card ── */

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

/* ── Page Card ── */

function PageCard({
  page,
  onUpdate,
  onDelete,
}: {
  page: CrawledPage
  onUpdate: (p: CrawledPage) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState(page)

  const save = useCallback(async (updated: CrawledPage) => {
    setSaving(true)
    try {
      // We need to send the full pages array — fetch current, replace, save
      const res = await fetch('/api/site-context')
      const data = await res.json()
      const all: CrawledPage[] = data.pages || []
      const idx = all.findIndex((p) => p.url === page.url)
      if (idx !== -1) all[idx] = updated
      else all.push(updated)
      await fetch('/api/site-context', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: all }),
      })
      onUpdate(updated)
      setEditing(false)
    } catch {
      // ignore
    }
    setSaving(false)
  }, [page.url, onUpdate])

  async function handleDelete() {
    if (!confirm(`Remove "${page.title}" from site context?`)) return
    try {
      await fetch('/api/site-context', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: page.url }),
      })
      onDelete()
    } catch {
      // ignore
    }
  }

  const headingTree = page.headings || []

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden transition-shadow hover:shadow-sm">
      {/* Header row — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-start gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/20"
      >
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight truncate">{page.title || 'Untitled'}</p>
          <p className="mt-0.5 text-xs text-muted-foreground truncate">{page.url}</p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span>{page.wordCount} words</span>
            <span>{headingTree.length} headings</span>
            <span>{(page.internalLinks || []).length} links</span>
            {page.crawledAt && (
              <span>Crawled {timeAgo(page.crawledAt)}</span>
            )}
          </div>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`mt-1 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border">
          {editing ? (
            <EditForm
              draft={draft}
              setDraft={setDraft}
              onSave={() => save(draft)}
              onCancel={() => { setEditing(false); setDraft(page) }}
              saving={saving}
            />
          ) : (
            <ViewDetail
              page={page}
              onEdit={() => { setDraft(page); setEditing(true) }}
              onDelete={handleDelete}
            />
          )}
        </div>
      )}
    </div>
  )
}

/* ── View Detail (read-only) ── */

function ViewDetail({
  page,
  onEdit,
  onDelete,
}: {
  page: CrawledPage
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div className="px-5 py-4 space-y-5">
      {/* Meta */}
      <Section title="Meta">
        <Field label="Title" value={page.title} />
        <Field label="Description" value={page.description} />
        <Field label="URL" value={page.url} mono />
      </Section>

      {/* Heading structure */}
      <Section title="Page Structure">
        <div className="rounded-lg border border-border/60 bg-muted/10 p-3 space-y-0.5">
          {(page.headings || []).map((h, i) => (
            <div
              key={i}
              className="flex items-center gap-2 text-sm"
              style={{ paddingLeft: `${(h.level - 1) * 16}px` }}
            >
              <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-primary/10 text-[10px] font-bold text-primary">
                H{h.level}
              </span>
              <span className="text-foreground/80 truncate">{h.text}</span>
            </div>
          ))}
          {(page.headings || []).length === 0 && (
            <p className="text-xs text-muted-foreground italic">No headings found</p>
          )}
        </div>
      </Section>

      {/* Content */}
      <Section title="Extracted Content">
        <div className="rounded-lg border border-border/60 bg-muted/10 p-3 max-h-60 overflow-y-auto custom-scrollbar">
          <p className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap">
            {page.content || 'No content extracted'}
          </p>
        </div>
      </Section>

      {/* Internal links */}
      <Section title="Internal Links">
        <div className="rounded-lg border border-border/60 bg-muted/10 p-3 max-h-48 overflow-y-auto custom-scrollbar space-y-1">
          {(page.internalLinks || []).map((link, i) => (
            <p key={i} className="text-xs font-mono text-primary/80 truncate">{link}</p>
          ))}
          {(page.internalLinks || []).length === 0 && (
            <p className="text-xs text-muted-foreground italic">No internal links found</p>
          )}
        </div>
      </Section>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button size="sm" onClick={onEdit}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit Page
        </Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
          </svg>
          Remove
        </Button>
      </div>
    </div>
  )
}

/* ── Edit Form ── */

function EditForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
}: {
  draft: CrawledPage
  setDraft: (p: CrawledPage) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  function updateHeading(index: number, text: string) {
    const next = [...draft.headings]
    next[index] = { ...next[index], text }
    setDraft({ ...draft, headings: next })
  }

  function removeHeading(index: number) {
    setDraft({ ...draft, headings: draft.headings.filter((_, i) => i !== index) })
  }

  function addHeading() {
    const lastLevel = draft.headings.length ? draft.headings[draft.headings.length - 1].level : 2
    setDraft({ ...draft, headings: [...draft.headings, { level: lastLevel, text: '' }] })
  }

  function updateLink(index: number, value: string) {
    const next = [...draft.internalLinks]
    next[index] = value
    setDraft({ ...draft, internalLinks: next })
  }

  function removeLink(index: number) {
    setDraft({ ...draft, internalLinks: draft.internalLinks.filter((_, i) => i !== index) })
  }

  function addLink() {
    setDraft({ ...draft, internalLinks: [...draft.internalLinks, ''] })
  }

  return (
    <div className="px-5 py-4 space-y-5">
      {/* Meta */}
      <Section title="Meta">
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Description</label>
            <Textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              className="mt-1 min-h-[60px]"
            />
          </div>
        </div>
      </Section>

      {/* Headings */}
      <Section title="Page Structure">
        <div className="space-y-2">
          {draft.headings.map((h, i) => (
            <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${(h.level - 1) * 12}px` }}>
              <select
                value={h.level}
                onChange={(e) => {
                  const next = [...draft.headings]
                  next[i] = { ...next[i], level: Number(e.target.value) }
                  setDraft({ ...draft, headings: next })
                }}
                className="h-8 w-14 rounded-md border border-input bg-transparent px-1 text-xs focus:ring-1 focus:ring-ring"
              >
                {[1, 2, 3, 4, 5, 6].map((l) => (
                  <option key={l} value={l}>H{l}</option>
                ))}
              </select>
              <Input
                value={h.text}
                onChange={(e) => updateHeading(i, e.target.value)}
                className="h-8 text-sm flex-1"
              />
              <button
                onClick={() => removeHeading(i)}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addHeading}>
            + Add Heading
          </Button>
        </div>
      </Section>

      {/* Content */}
      <Section title="Extracted Content">
        <Textarea
          value={draft.content}
          onChange={(e) => setDraft({ ...draft, content: e.target.value, wordCount: e.target.value.split(/\s+/).filter(Boolean).length })}
          className="min-h-[200px] text-sm font-mono leading-relaxed"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">{draft.wordCount} words</p>
      </Section>

      {/* Internal links */}
      <Section title="Internal Links">
        <div className="space-y-2">
          {draft.internalLinks.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={link}
                onChange={(e) => updateLink(i, e.target.value)}
                className="h-8 text-xs font-mono flex-1"
                placeholder="https://..."
              />
              <button
                onClick={() => removeLink(i)}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addLink}>
            + Add Link
          </Button>
        </div>
      </Section>

      {/* Save / Cancel */}
      <div className="flex gap-2 pt-2">
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

/* ── Shared helpers ── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</h3>
      {children}
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="mb-2 last:mb-0">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-sm text-foreground/90 ${mono ? 'font-mono text-xs' : ''}`}>
        {value || <span className="italic text-muted-foreground">Not set</span>}
      </p>
    </div>
  )
}

function EmptyState({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 mb-6">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
          <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold mb-2">No site data yet</h2>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        Crawl your site first to see the extracted content, headings, and internal links that the agent uses for context.
      </p>
      <Button onClick={onNavigate}>Go to Settings</Button>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4">
            <div className="h-3 w-20 rounded bg-muted animate-pulse" />
            <div className="mt-2 h-7 w-12 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-5">
          <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
          <div className="mt-2 h-3 w-1/2 rounded bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  )
}

/* ── Sitemap Section ── */

function SitemapSection({ urls, crawledUrls }: { urls: SitemapUrl[]; crawledUrls: Set<string> }) {
  const [expanded, setExpanded] = useState(false)

  const crawled = urls.filter((u) => crawledUrls.has(u.loc))
  const notCrawled = urls.filter((u) => !crawledUrls.has(u.loc))

  return (
    <div className="mb-8 rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/20 transition-colors"
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18" />
            <path d="M7 16l4-8 4 4 4-8" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Sitemap</p>
          <p className="text-xs text-muted-foreground">
            {urls.length} URLs found &middot; {crawled.length} crawled &middot; {notCrawled.length} not yet crawled
          </p>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`flex-shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-border px-5 py-4 max-h-80 overflow-y-auto custom-scrollbar space-y-1">
          {urls.map((u) => {
            const isCrawled = crawledUrls.has(u.loc)
            return (
              <div key={u.loc} className="flex items-center gap-2 py-1">
                <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full ${
                  isCrawled ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'
                }`}>
                  {isCrawled ? (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  )}
                </span>
                <span className={`text-xs font-mono truncate ${isCrawled ? 'text-foreground/80' : 'text-muted-foreground'}`}>
                  {u.loc}
                </span>
                {u.lastmod && (
                  <span className="ml-auto text-[10px] text-muted-foreground/50 flex-shrink-0">
                    {u.lastmod}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* ── Writing Style Section ── */

interface StyleFile {
  name: string
  content: string
}

const STYLE_FILE_LABELS: Record<string, string> = {
  'CONTEXT.md': 'Context',
  'TONE.md': 'Tone',
  'STRUCTURE.md': 'Structure',
  'SENTENCE_STYLE.md': 'Sentence Style',
  'EXAMPLES.md': 'Examples',
  'ANTI_WORDS.md': 'Anti-Words',
}

function WritingStyleSection() {
  const [files, setFiles] = useState<StyleFile[]>([])
  const [expanded, setExpanded] = useState(false)
  const [editingFile, setEditingFile] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/writing-style/files')
        const data = await res.json()
        setFiles(data.files || [])
      } catch {
        // ignore
      }
      setLoaded(true)
    }
    load()
  }, [])

  if (!loaded || files.length === 0) return null

  async function handleSave(name: string) {
    setSaving(true)
    try {
      await fetch('/api/writing-style/files', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, content: editContent }),
      })
      setFiles(files.map((f) => (f.name === name ? { ...f, content: editContent } : f)))
      setEditingFile(null)
    } catch {
      // ignore
    }
    setSaving(false)
  }

  return (
    <div className="mb-8 rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-muted/20 transition-colors"
      >
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Writing Style</p>
          <p className="text-xs text-muted-foreground">
            {files.length} style files generated
          </p>
        </div>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          className={`flex-shrink-0 text-muted-foreground transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-border">
          {files.map((file) => (
            <div key={file.name} className="border-b border-border/50 last:border-b-0">
              <div className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{STYLE_FILE_LABELS[file.name] || file.name}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">{file.name}</p>
                </div>
                <div className="flex gap-2">
                  {editingFile === file.name ? (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleSave(file.name)}
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingFile(null)}
                        disabled={saving}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingFile(file.name)
                        setEditContent(file.content)
                      }}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              </div>

              {editingFile === file.name ? (
                <div className="px-5 pb-4">
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="min-h-[300px] text-sm font-mono leading-relaxed"
                  />
                </div>
              ) : (
                <div className="px-5 pb-4">
                  <div className="rounded-lg border border-border/60 bg-muted/10 p-3 max-h-60 overflow-y-auto custom-scrollbar">
                    <pre className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap font-sans">
                      {file.content}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Site Actions (re-crawl / re-sync) ── */

function SiteActions({ siteUrl }: { siteUrl: string }) {
  const [crawling, setCrawling] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [analyzingStyle, setAnalyzingStyle] = useState(false)
  const [styleMessage, setStyleMessage] = useState('')

  async function handleRecrawl() {
    if (!siteUrl) return
    setCrawling(true)
    try {
      await fetch('/api/crawl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl }),
      })
    } catch {
      // ignore
    }
    setCrawling(false)
  }

  async function handleResync() {
    setSyncing(true)
    try {
      await fetch('/api/gsc/sync', { method: 'POST' })
    } catch {
      // ignore
    }
    setSyncing(false)
  }

  async function handleAnalyzeStyle() {
    setAnalyzingStyle(true)
    setStyleMessage('')
    try {
      const res = await fetch('/api/writing-style', { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setStyleMessage(`Style generated from ${data.pagesAnalyzed} pages`)
      } else {
        setStyleMessage(data.error || 'Analysis failed')
      }
    } catch {
      setStyleMessage('Analysis failed')
    }
    setAnalyzingStyle(false)
  }

  return (
    <div className="flex items-center gap-2">
      {/* Style analysis loading modal — portaled to body to escape backdrop-blur containing block */}
      {analyzingStyle && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-lg text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin text-primary">
                <path d="M21 12a9 9 0 11-6.219-8.56" />
              </svg>
            </div>
            <h3 className="text-base font-semibold mb-1">Generating Writing Style</h3>
            <p className="text-sm text-muted-foreground">
              Analyzing your site&apos;s brand voice and generating a style guide. This usually takes 15-30 seconds.
            </p>
          </div>
        </div>,
        document.body
      )}
      {styleMessage && (
        <span className="text-xs text-muted-foreground mr-1">{styleMessage}</span>
      )}
      <Button variant="outline" size="sm" onClick={handleAnalyzeStyle} disabled={analyzingStyle}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        Analyze Style
      </Button>
      <Button variant="outline" size="sm" onClick={handleResync} disabled={syncing}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
          <path d="M3 3v18h18" />
          <path d="M18 9l-5 5-4-4-3 3" />
        </svg>
        {syncing ? 'Syncing...' : 'Sync GSC'}
      </Button>
      <Button variant="outline" size="sm" onClick={handleRecrawl} disabled={crawling}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
          <path d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9" />
        </svg>
        {crawling ? 'Crawling...' : 'Re-crawl'}
      </Button>
    </div>
  )
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
