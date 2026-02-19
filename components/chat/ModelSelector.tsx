'use client'

import { useEffect, useState, useCallback } from 'react'

interface ModelEntry {
  id: string
  name: string
  description: string
  featured: boolean
}

type ProviderType = 'openai' | 'anthropic' | 'openrouter'

const PROVIDER_META: Record<ProviderType, { label: string; icon: string }> = {
  openai: { label: 'OpenAI', icon: 'O' },
  anthropic: { label: 'Anthropic', icon: 'A' },
  openrouter: { label: 'OpenRouter', icon: 'R' },
}

const DEFAULT_MODELS: Record<ProviderType, string> = {
  openai: 'gpt-5.2',
  anthropic: 'claude-sonnet-4-6',
  openrouter: 'minimax/minimax-m2.5',
}

export function ModelSelector() {
  const [provider, setProvider] = useState<ProviderType>('openai')
  const [model, setModel] = useState('gpt-5.2')
  const [models, setModels] = useState<ModelEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [showMore, setShowMore] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/config')
        const config = await res.json()
        if (config.provider?.type) setProvider(config.provider.type)
        if (config.provider?.model) setModel(config.provider.model)
      } catch {
        // ignore
      }
      setLoaded(true)
    }
    load()
  }, [])

  useEffect(() => {
    async function loadModels() {
      try {
        const res = await fetch(`/api/models?provider=${provider}`)
        const data = await res.json()
        if (data.detailed) setModels(data.detailed)
      } catch {
        // ignore
      }
      setShowMore(false)
    }
    loadModels()
  }, [provider])

  const save = useCallback(async (type: string, mdl: string) => {
    try {
      await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: { type, model: mdl } }),
      })
    } catch {
      // ignore
    }
  }, [])

  function handleProviderChange(newProvider: ProviderType) {
    setProvider(newProvider)
    const defaultModel = DEFAULT_MODELS[newProvider]
    setModel(defaultModel)
    save(newProvider, defaultModel)
  }

  function handleModelSelect(id: string) {
    setModel(id)
    save(provider, id)
  }

  if (!loaded) return null

  const featured = models.filter((m) => m.featured)
  const other = models.filter((m) => !m.featured)
  const selectedModel = models.find((m) => m.id === model)
  const isSelectedInOther = other.some((m) => m.id === model)

  return (
    <div className="flex flex-col gap-2.5">
      {/* Provider toggle */}
      <div className="flex rounded-lg bg-sidebar-accent/50 p-0.5">
        {Object.entries(PROVIDER_META).map(([key, meta]) => (
          <button
            key={key}
            onClick={() => handleProviderChange(key as ProviderType)}
            className={`flex-1 flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all ${
              provider === key
                ? 'bg-sidebar text-sidebar-foreground shadow-sm'
                : 'text-sidebar-foreground/50 hover:text-sidebar-foreground/70'
            }`}
          >
            <span className={`flex h-3.5 w-3.5 items-center justify-center rounded text-[8px] font-bold ${
              provider === key ? 'bg-primary text-primary-foreground' : 'bg-sidebar-accent text-sidebar-foreground/40'
            }`}>
              {meta.icon}
            </span>
            {meta.label}
          </button>
        ))}
      </div>

      {/* Featured models */}
      <div className="flex flex-col gap-1">
        {featured.map((m) => (
          <button
            key={m.id}
            onClick={() => handleModelSelect(m.id)}
            className={`flex items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all ${
              model === m.id
                ? 'bg-primary/10 ring-1 ring-primary/30'
                : 'hover:bg-sidebar-accent/70'
            }`}
          >
            <span className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
              model === m.id
                ? 'border-primary bg-primary'
                : 'border-sidebar-foreground/20'
            }`}>
              {model === m.id && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />
              )}
            </span>
            <div className="min-w-0">
              <p className={`text-xs font-medium leading-tight ${
                model === m.id ? 'text-sidebar-foreground' : 'text-sidebar-foreground/80'
              }`}>
                {m.name}
              </p>
              <p className="text-[10px] text-sidebar-foreground/40 leading-tight mt-0.5 truncate">
                {m.description}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* More models toggle */}
      {other.length > 0 && (
        <div>
          <button
            onClick={() => setShowMore(!showMore)}
            className="flex w-full items-center gap-1.5 px-2.5 py-1 text-[11px] text-sidebar-foreground/40 hover:text-sidebar-foreground/60 transition-colors"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`transition-transform duration-200 ${showMore ? 'rotate-180' : ''}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
            {showMore ? 'Less models' : `${other.length} more models`}
            {isSelectedInOther && !showMore && selectedModel && (
              <span className="ml-auto text-[10px] text-primary/70">{selectedModel.name}</span>
            )}
          </button>

          {showMore && (
            <div className="mt-1 flex flex-col gap-0.5">
              {other.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleModelSelect(m.id)}
                  className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-all ${
                    model === m.id
                      ? 'bg-primary/10'
                      : 'hover:bg-sidebar-accent/50'
                  }`}
                >
                  <span className={`flex h-3 w-3 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
                    model === m.id
                      ? 'border-primary bg-primary'
                      : 'border-sidebar-foreground/15'
                  }`}>
                    {model === m.id && (
                      <span className="h-1 w-1 rounded-full bg-primary-foreground" />
                    )}
                  </span>
                  <div className="flex items-baseline gap-2 min-w-0">
                    <p className={`text-[11px] leading-tight ${
                      model === m.id ? 'text-sidebar-foreground font-medium' : 'text-sidebar-foreground/60'
                    }`}>
                      {m.name}
                    </p>
                    <p className="text-[9px] text-sidebar-foreground/30 truncate">
                      {m.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
