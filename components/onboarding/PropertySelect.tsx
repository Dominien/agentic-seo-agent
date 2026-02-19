'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface SiteProperty {
  siteUrl: string
  permissionLevel: string
}

export function PropertySelect() {
  const router = useRouter()
  const [properties, setProperties] = useState<SiteProperty[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchProperties() {
      try {
        const res = await fetch('/api/gsc/properties')
        if (!res.ok) throw new Error('Failed to fetch properties')
        const data = await res.json()
        setProperties(data.properties || [])
      } catch {
        setError('Failed to load properties. Make sure Google is connected.')
      } finally {
        setLoading(false)
      }
    }
    fetchProperties()
  }, [])

  async function handleSelect() {
    if (!selected) return
    setSaving(true)
    try {
      // Create a project for the selected property
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl: selected }),
      })
      router.push('/onboarding?step=crawl')
    } catch {
      setError('Failed to save property')
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Your Property</CardTitle>
        <CardDescription>
          Choose the site you want to analyze and optimize.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loading && <p className="text-sm text-muted-foreground">Loading properties...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && properties.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">No properties found. Add a site to Google Search Console first.</p>
        )}

        <div className="flex flex-col gap-2">
          {properties.map((p) => (
            <button
              key={p.siteUrl}
              onClick={() => setSelected(p.siteUrl)}
              className={`rounded-lg border p-4 text-left transition-colors ${
                selected === p.siteUrl
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-muted-foreground/50'
              }`}
            >
              <p className="font-medium text-sm">{p.siteUrl}</p>
              <p className="text-xs text-muted-foreground mt-1">{p.permissionLevel}</p>
            </button>
          ))}
        </div>

        {properties.length > 0 && (
          <Button onClick={handleSelect} disabled={!selected || saving} size="lg" className="w-full">
            {saving ? 'Saving...' : 'Continue'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
