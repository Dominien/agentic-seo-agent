// ── App Configuration ──

export interface ProviderConfig {
  type: 'openai' | 'anthropic' | 'openrouter'
  model: string
  maxTokens?: number
}

export interface GoogleTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expiry_date: number
  scope: string
}

export interface ProjectConfig {
  id: string            // slug like "marc0-dev"
  name: string          // display name like "marc0.dev"
  siteUrl: string       // GSC siteUrl like "sc-domain:marc0.dev"
  createdAt: string
  lastSync?: string
  lastCrawl?: string
}

export interface CrawlConfig {
  maxPages: number
}

export interface AppConfig {
  provider: ProviderConfig
  google: {
    tokens?: GoogleTokens
  }
  activeProjectId?: string
  projects: ProjectConfig[]
  crawl: CrawlConfig
  setupComplete: boolean
}

// ── Chat Types ──

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  timestamp: number
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ToolResult {
  toolCallId: string
  name: string
  content: string
  isError?: boolean
}

export interface LLMResponse {
  content: string
  toolCalls?: ToolCall[]
  usage?: {
    promptTokens: number
    completionTokens: number
  }
}

// ── GSC Data Types ──

export interface GSCQueryRow {
  query: string
  clicks: number
  impressions: number
  ctr: number
  position: number
  page?: string
  date?: string
}

export interface GSCPageRow {
  page: string
  clicks: number
  impressions: number
  ctr: number
  position: number
}

// ── Crawler Types ──

export interface CrawledPage {
  url: string
  title: string
  description: string
  headings: { level: number; text: string }[]
  content: string
  internalLinks: string[]
  wordCount: number
  crawledAt: string
}

export interface SitemapUrl {
  loc: string
  lastmod?: string
}

// ── Tool Definitions ──

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, ToolParameterProperty>
    required?: string[]
  }
}

export interface ToolParameterProperty {
  type: string
  description: string
  enum?: string[]
  items?: { type: string }
  default?: unknown
}

// ── Streaming Types ──

export type StreamChunk =
  | { type: 'text'; content: string }
  | { type: 'tool_call_start'; toolCall: { id: string; name: string } }
  | { type: 'tool_call_delta'; toolCallId: string; args: string }
  | { type: 'tool_call_end'; toolCallId: string }
  | { type: 'done'; usage?: { promptTokens: number; completionTokens: number }; finishReason?: string }

export type AgentStreamEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_calls'; toolCalls: ToolCall[] }
  | { type: 'tool_result'; result: ToolResult }
  | { type: 'tool_error'; error: string; toolCallId: string }
  | { type: 'error'; error: string }
  | { type: 'done' }
