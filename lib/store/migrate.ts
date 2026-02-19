import { promises as fs } from 'fs'
import path from 'path'

const LEGACY_DATA_FILES = ['gsc-data.json', 'site-context.json', 'sitemap.json', 'chat-history.json']

/**
 * Detect legacy flat data layout and migrate into a project directory.
 * Triggers if:
 *   - No projects/ dir exists, AND
 *   - Either any legacy data file exists OR config has old `gsc` field
 */
export async function migrateLegacyData(dataDir: string): Promise<void> {
  const projectsDir = path.join(dataDir, 'projects')

  // Already migrated
  if (await exists(projectsDir)) return

  // Read current config
  const configPath = path.join(dataDir, 'config.json')
  let config: Record<string, unknown>
  try {
    const raw = await fs.readFile(configPath, 'utf-8')
    config = JSON.parse(raw)
  } catch {
    return // No config, nothing to migrate
  }

  // Already in new format
  if (Array.isArray(config.projects)) return

  // Check if there's anything to migrate
  const gsc = config.gsc as { siteUrl?: string; lastSync?: string } | undefined
  const siteUrl = gsc?.siteUrl

  const hasAnyLegacyFile = (await Promise.all(
    LEGACY_DATA_FILES.map(f => exists(path.join(dataDir, f)))
  )).some(Boolean)

  if (!siteUrl && !hasAnyLegacyFile) {
    // No old data at all — just upgrade config format in place
    const newConfig = {
      ...config,
      projects: [],
      activeProjectId: null,
      crawl: { maxPages: (config.crawl as { maxPages?: number })?.maxPages ?? 100 },
    }
    delete (newConfig as Record<string, unknown>).gsc
    await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2), 'utf-8')
    return
  }

  if (!siteUrl) {
    // Have data files but no siteUrl — can't create a proper project.
    // Upgrade config format, data files stay flat (will be orphaned but harmless).
    const newConfig = {
      ...config,
      projects: [],
      activeProjectId: null,
      crawl: { maxPages: (config.crawl as { maxPages?: number })?.maxPages ?? 100 },
    }
    delete (newConfig as Record<string, unknown>).gsc
    await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2), 'utf-8')
    return
  }

  // Full migration: create project from siteUrl and move data files
  const slug = siteUrlToSlug(siteUrl)
  const name = siteUrl.replace('sc-domain:', '').replace(/^https?:\/\//, '').replace(/\/$/, '')

  const projDir = path.join(projectsDir, slug)
  await fs.mkdir(projDir, { recursive: true })

  // Move data files into project directory
  for (const file of LEGACY_DATA_FILES) {
    const src = path.join(dataDir, file)
    const dest = path.join(projDir, file)
    if (await exists(src)) {
      await fs.rename(src, dest)
    }
  }

  // Write project.json
  const projectMeta = {
    id: slug,
    name,
    siteUrl,
    createdAt: new Date().toISOString(),
    lastSync: gsc?.lastSync,
    lastCrawl: (config.crawl as { lastCrawl?: string })?.lastCrawl,
  }
  await fs.writeFile(path.join(projDir, 'project.json'), JSON.stringify(projectMeta, null, 2), 'utf-8')

  // Rewrite config.json to new format
  const newConfig = {
    provider: config.provider,
    google: config.google,
    activeProjectId: slug,
    projects: [projectMeta],
    crawl: { maxPages: (config.crawl as { maxPages?: number })?.maxPages ?? 100 },
    setupComplete: config.setupComplete ?? false,
  }
  await fs.writeFile(configPath, JSON.stringify(newConfig, null, 2), 'utf-8')
}

export function siteUrlToSlug(siteUrl: string): string {
  return siteUrl
    .replace('sc-domain:', '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}
