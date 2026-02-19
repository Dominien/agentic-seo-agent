'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { GoogleConnect } from '@/components/onboarding/GoogleConnect'
import { PropertySelect } from '@/components/onboarding/PropertySelect'
import { CrawlProgress } from '@/components/onboarding/CrawlProgress'
import { ReadyScreen } from '@/components/onboarding/ReadyScreen'

function OnboardingContent() {
  const searchParams = useSearchParams()
  const step = searchParams.get('step') || 'connect'
  const addProject = searchParams.get('addProject') === 'true'

  // When adding a project, skip Google connect (already authed)
  const effectiveStep = addProject && step === 'connect' ? 'property' : step

  const steps = addProject
    ? ['property', 'crawl', 'ready']
    : ['connect', 'property', 'crawl', 'ready']

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">
            {addProject ? 'Add Project' : 'Agentic SEO'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {addProject ? 'Connect a new site to your workspace' : 'AI-powered SEO content strategy'}
          </p>
        </div>

        <div className="mb-6 flex items-center justify-center gap-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  s === effectiveStep
                    ? 'bg-primary'
                    : steps.indexOf(s) < steps.indexOf(effectiveStep)
                    ? 'bg-primary/50'
                    : 'bg-muted'
                }`}
              />
              {i < steps.length - 1 && <div className="h-px w-8 bg-border" />}
            </div>
          ))}
        </div>

        {effectiveStep === 'connect' && <GoogleConnect />}
        {effectiveStep === 'property' && <PropertySelect />}
        {effectiveStep === 'crawl' && <CrawlProgress />}
        {effectiveStep === 'ready' && <ReadyScreen />}
      </div>
    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  )
}
