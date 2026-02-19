import type { AppConfig, ChatMessage, GSCQueryRow, CrawledPage, SitemapUrl } from '../types'
import { readJSON, readMarkdown, readProjectJSON, getActiveProjectId, fileExists, projectPath } from '../store'
import { loadRecentMemories } from './memory'

export interface AgentSchema {
  config: AppConfig
  agentPersonality: string
  siteContextSummary: { pageCount: number; totalWords: number; sitemapUrls: number }
  gscSummary: { queryCount: number; dateRange: string | null }
  chatHistory: ChatMessage[]
  recentMemories: string
  sitemapUrls: string[]
  writingStyleAvailable: boolean
}

export async function buildSchema(): Promise<AgentSchema> {
  // Load config
  let config: AppConfig
  try {
    config = await readJSON<AppConfig>('config.json')
  } catch {
    throw new Error('Configuration not found. Please complete setup first.')
  }

  // Load AGENT.md personality
  const agentPersonality = await readMarkdown('AGENT.md')

  // Get active project ID
  let projectId: string | undefined
  try {
    projectId = await getActiveProjectId()
  } catch {
    // No active project
  }

  // Load sitemap URLs
  let sitemapUrls: string[] = []
  if (projectId) {
    try {
      const sitemap = await readProjectJSON<SitemapUrl[]>(projectId, 'sitemap.json')
      if (Array.isArray(sitemap)) {
        sitemapUrls = sitemap.map(u => u.loc)
      }
    } catch {
      // No sitemap
    }
  }

  // Load site context summary — file is a flat array of CrawledPage[]
  let siteContextSummary = { pageCount: 0, totalWords: 0, sitemapUrls: sitemapUrls.length }
  if (projectId) {
    try {
      const pages = await readProjectJSON<CrawledPage[]>(projectId, 'site-context.json')
      if (Array.isArray(pages) && pages.length > 0) {
        siteContextSummary = {
          pageCount: pages.length,
          totalWords: pages.reduce((sum, p) => sum + p.wordCount, 0),
          sitemapUrls: sitemapUrls.length,
        }
      }
    } catch {
      // No site context
    }
  }

  // Load GSC data summary
  let gscSummary: { queryCount: number; dateRange: string | null } = {
    queryCount: 0,
    dateRange: null,
  }
  if (projectId) {
    try {
      const gscData = await readProjectJSON<{
        queries: GSCQueryRow[]
        lastSync: string | null
      }>(projectId, 'gsc-data.json')
      if (gscData.queries && gscData.queries.length > 0) {
        gscSummary = {
          queryCount: gscData.queries.length,
          dateRange: gscData.lastSync,
        }
      }
    } catch {
      // No GSC data
    }
  }

  // Load chat history
  let chatHistory: ChatMessage[] = []
  if (projectId) {
    try {
      chatHistory = await readProjectJSON<ChatMessage[]>(projectId, 'chat-history.json')
    } catch {
      // No history yet
    }
  }

  // Load recent memories
  const recentMemories = await loadRecentMemories(10)

  // Check if writing style has been analyzed
  let writingStyleAvailable = false
  if (projectId) {
    writingStyleAvailable = await fileExists(projectPath(projectId, 'writing/TONE.md'))
  }

  return {
    config,
    agentPersonality,
    siteContextSummary,
    gscSummary,
    chatHistory,
    recentMemories,
    sitemapUrls,
    writingStyleAvailable,
  }
}
