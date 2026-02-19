'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Project {
  id: string
  name: string
  siteUrl: string
}

export function ProjectSwitcher() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/projects')
        const data = await res.json()
        setProjects(data.projects || [])
        setActiveId(data.activeProjectId || '')
      } catch {
        // ignore
      }
    }
    load()
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function switchProject(projectId: string) {
    setOpen(false)
    if (projectId === activeId) return
    try {
      await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeProjectId: projectId }),
      })
      setActiveId(projectId)
      // Reload page to reflect new project data
      window.location.reload()
    } catch {
      // ignore
    }
  }

  function handleAddProject() {
    setOpen(false)
    router.push('/onboarding?step=property&addProject=true')
  }

  const active = projects.find(p => p.id === activeId)

  if (projects.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-sidebar-accent"
      >
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-bold">
          {(active?.name || '?')[0].toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight truncate">
            {active?.name || 'Select project'}
          </p>
          <p className="text-[10px] text-sidebar-foreground/50 truncate">
            {active?.siteUrl?.replace('sc-domain:', '') || ''}
          </p>
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`flex-shrink-0 text-sidebar-foreground/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          {projects.map(p => (
            <button
              key={p.id}
              onClick={() => switchProject(p.id)}
              className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-accent ${
                p.id === activeId ? 'bg-accent/50' : ''
              }`}
            >
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary text-[10px] font-bold">
                {p.name[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight truncate">{p.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {p.siteUrl.replace('sc-domain:', '')}
                </p>
              </div>
              {p.id === activeId && (
                <div className="h-2 w-2 flex-shrink-0 rounded-full bg-green-500" />
              )}
            </button>
          ))}

          <div className="border-t border-border">
            <button
              onClick={handleAddProject}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-dashed border-muted-foreground/30 text-muted-foreground/50">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              Add Project
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
