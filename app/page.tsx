import { redirect } from 'next/navigation'
import { readJSON, fileExists } from '@/lib/store'
import type { AppConfig } from '@/lib/types'

export default async function Home() {
  const hasConfig = await fileExists('config.json')

  if (hasConfig) {
    try {
      const config = await readJSON<AppConfig>('config.json')
      if (config.setupComplete) {
        redirect('/chat')
      }
    } catch {
      // config exists but is invalid, go to onboarding
    }
  }

  redirect('/onboarding')
}
