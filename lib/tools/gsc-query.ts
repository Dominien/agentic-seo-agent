import type { ToolDefinition, GSCQueryRow } from '../types'
import { readProjectJSON, getActiveProjectId } from '../store'

export const definition: ToolDefinition = {
  name: 'gsc_query',
  description:
    'Query cached Google Search Console data. Supports keyword filtering, sorting, and trend analysis. Use type "overview" for aggregated data, "trends" for position/click changes over time, or "declining" to find keywords losing position.',
  parameters: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        description: 'Query type',
        enum: ['overview', 'trends', 'declining', 'growing', 'opportunities'],
      },
      keywordPattern: {
        type: 'string',
        description: 'Regex pattern to filter keywords (e.g. "blog|article" or "^how to")',
      },
      pageFilter: {
        type: 'string',
        description: 'Filter results to URLs containing this string',
      },
      sortBy: {
        type: 'string',
        description: 'Field to sort results by',
        enum: ['clicks', 'impressions', 'ctr', 'position'],
      },
      sortOrder: {
        type: 'string',
        description: 'Sort direction',
        enum: ['asc', 'desc'],
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default 20)',
        default: 20,
      },
      minImpressions: {
        type: 'number',
        description: 'Minimum impressions threshold to include a row',
      },
    },
  },
}

interface GSCData {
  queries: GSCQueryRow[]
  dateQueries?: GSCQueryRow[]
  pages: { page: string; clicks: number; impressions: number; ctr: number; position: number }[]
  syncedAt?: string
  dateRange?: { startDate: string; endDate: string }
}

export async function execute(args: Record<string, unknown>): Promise<string> {
  const type = (args.type as string) || 'overview'
  const keywordPattern = args.keywordPattern as string | undefined
  const pageFilter = args.pageFilter as string | undefined
  const sortBy = (args.sortBy as string) || 'impressions'
  const sortOrder = (args.sortOrder as string) || 'desc'
  const limit = (args.limit as number) || 20
  const minImpressions = args.minImpressions as number | undefined

  let data: GSCData
  try {
    const projectId = await getActiveProjectId()
    data = await readProjectJSON<GSCData>(projectId, 'gsc-data.json')
  } catch {
    return 'No GSC data available. Please sync Google Search Console data first.'
  }

  if (!data.queries || data.queries.length === 0) {
    return 'No GSC query data available. Please sync Google Search Console data first.'
  }

  switch (type) {
    case 'declining':
      return analyzeTrend(data, 'declining', keywordPattern, minImpressions, limit)
    case 'growing':
      return analyzeTrend(data, 'growing', keywordPattern, minImpressions, limit)
    case 'opportunities':
      return findOpportunities(data, keywordPattern, limit)
    case 'trends':
      return showTrends(data, keywordPattern, limit)
    case 'overview':
    default:
      return queryOverview(data, keywordPattern, pageFilter, sortBy, sortOrder, limit, minImpressions)
  }
}

function applyKeywordFilter(rows: GSCQueryRow[], pattern?: string): GSCQueryRow[] {
  if (!pattern) return rows
  try {
    const regex = new RegExp(pattern, 'i')
    return rows.filter(r => regex.test(r.query))
  } catch {
    return rows
  }
}

/* ── Overview (original behavior) ── */

function queryOverview(
  data: GSCData,
  keywordPattern?: string,
  pageFilter?: string,
  sortBy = 'impressions',
  sortOrder = 'desc',
  limit = 20,
  minImpressions?: number,
): string {
  let rows = applyKeywordFilter([...data.queries], keywordPattern)

  if (pageFilter) {
    rows = rows.filter(r => r.page && r.page.includes(pageFilter))
  }
  if (minImpressions !== undefined) {
    rows = rows.filter(r => r.impressions >= minImpressions)
  }

  const sortField = sortBy as keyof GSCQueryRow
  rows.sort((a, b) => {
    const aVal = (a[sortField] as number) ?? 0
    const bVal = (b[sortField] as number) ?? 0
    return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
  })

  rows = rows.slice(0, limit)

  if (rows.length === 0) return 'No results match the specified filters.'

  const lines: string[] = [
    `**GSC Data** (${rows.length} results, synced: ${data.syncedAt || 'unknown'}, range: ${data.dateRange?.startDate || '?'} to ${data.dateRange?.endDate || '?'})`,
    '',
    '| Keyword | Clicks | Impressions | CTR | Avg Position |',
    '|---------|--------|-------------|-----|-------------|',
  ]

  for (const row of rows) {
    lines.push(
      `| ${row.query} | ${row.clicks} | ${row.impressions} | ${(row.ctr * 100).toFixed(1)}% | ${row.position.toFixed(1)} |`
    )
  }

  return lines.join('\n')
}

/* ── Trend Analysis (declining / growing) ── */

function analyzeTrend(
  data: GSCData,
  direction: 'declining' | 'growing',
  keywordPattern?: string,
  minImpressions?: number,
  limit = 20,
): string {
  if (!data.dateQueries || data.dateQueries.length === 0) {
    return 'No date-level GSC data available. Please re-sync your Search Console data to enable trend analysis.'
  }

  // Group date queries by keyword
  const byKeyword = new Map<string, GSCQueryRow[]>()
  for (const row of data.dateQueries) {
    if (!row.date || !row.query) continue
    const existing = byKeyword.get(row.query) || []
    existing.push(row)
    byKeyword.set(row.query, existing)
  }

  // Compare first half vs second half of the period
  const allDates = [...new Set(data.dateQueries.map(r => r.date!).filter(Boolean))].sort()
  const midpoint = allDates[Math.floor(allDates.length / 2)]

  interface TrendResult {
    keyword: string
    earlyPos: number
    latePos: number
    posChange: number
    earlyClicks: number
    lateClicks: number
    totalImpressions: number
  }

  const trends: TrendResult[] = []

  for (const [keyword, rows] of byKeyword) {
    const early = rows.filter(r => r.date! <= midpoint)
    const late = rows.filter(r => r.date! > midpoint)

    if (early.length < 2 || late.length < 2) continue

    const earlyPos = avg(early.map(r => r.position))
    const latePos = avg(late.map(r => r.position))
    const earlyClicks = sum(early.map(r => r.clicks))
    const lateClicks = sum(late.map(r => r.clicks))
    const totalImpressions = sum(rows.map(r => r.impressions))

    if (minImpressions && totalImpressions < minImpressions) continue

    trends.push({
      keyword,
      earlyPos,
      latePos,
      posChange: latePos - earlyPos,
      earlyClicks,
      lateClicks,
      totalImpressions,
    })
  }

  let filtered = applyKeywordFilterTrends(trends, keywordPattern)

  if (direction === 'declining') {
    // Position increasing = declining (higher number = worse)
    filtered = filtered.filter(t => t.posChange > 0.5)
    filtered.sort((a, b) => b.posChange - a.posChange)
  } else {
    // Position decreasing = growing (lower number = better)
    filtered = filtered.filter(t => t.posChange < -0.5)
    filtered.sort((a, b) => a.posChange - b.posChange)
  }

  filtered = filtered.slice(0, limit)

  if (filtered.length === 0) {
    return `No ${direction} keywords found in the current data.`
  }

  const label = direction === 'declining' ? 'Declining Keywords' : 'Growing Keywords'
  const dateInfo = `First half: ${allDates[0]} to ${midpoint} | Second half: ${midpoint} to ${allDates[allDates.length - 1]}`

  const lines: string[] = [
    `**${label}** (${filtered.length} keywords)`,
    `_${dateInfo}_`,
    '',
    '| Keyword | Early Pos | Recent Pos | Change | Early Clicks | Recent Clicks | Impressions |',
    '|---------|-----------|------------|--------|-------------|---------------|-------------|',
  ]

  for (const t of filtered) {
    const arrow = t.posChange > 0 ? '↓' : '↑'
    lines.push(
      `| ${t.keyword} | ${t.earlyPos.toFixed(1)} | ${t.latePos.toFixed(1)} | ${arrow} ${Math.abs(t.posChange).toFixed(1)} | ${t.earlyClicks} | ${t.lateClicks} | ${t.totalImpressions} |`
    )
  }

  return lines.join('\n')
}

/* ── Show keyword trends over time ── */

function showTrends(data: GSCData, keywordPattern?: string, limit = 10): string {
  if (!data.dateQueries || data.dateQueries.length === 0) {
    return 'No date-level GSC data available. Please re-sync your Search Console data to enable trend analysis.'
  }

  if (!keywordPattern) {
    return 'Please provide a keywordPattern to see trends for specific keywords.'
  }

  let rows: GSCQueryRow[]
  try {
    const regex = new RegExp(keywordPattern, 'i')
    rows = data.dateQueries.filter(r => regex.test(r.query))
  } catch {
    return `Invalid regex: "${keywordPattern}"`
  }

  if (rows.length === 0) {
    return `No date-level data found for "${keywordPattern}".`
  }

  // Group by keyword, then sort dates
  const byKeyword = new Map<string, GSCQueryRow[]>()
  for (const row of rows) {
    if (!row.date) continue
    const existing = byKeyword.get(row.query) || []
    existing.push(row)
    byKeyword.set(row.query, existing)
  }

  const keywords = [...byKeyword.keys()].slice(0, limit)
  const lines: string[] = [`**Keyword Trends** for "${keywordPattern}" (${keywords.length} keywords)`]

  for (const kw of keywords) {
    const kwRows = byKeyword.get(kw)!.sort((a, b) => (a.date! > b.date! ? 1 : -1))
    lines.push('', `### ${kw}`, '', '| Date | Clicks | Impressions | Position |', '|------|--------|-------------|----------|')
    // Show weekly aggregates to keep output manageable
    const weekly = aggregateWeekly(kwRows)
    for (const w of weekly) {
      lines.push(`| ${w.week} | ${w.clicks} | ${w.impressions} | ${w.position.toFixed(1)} |`)
    }
  }

  return lines.join('\n')
}

/* ── Quick wins / opportunities ── */

function findOpportunities(data: GSCData, keywordPattern?: string, limit = 20): string {
  let rows = applyKeywordFilter([...data.queries], keywordPattern)

  // Quick wins: position 5-20 with decent impressions (close to page 1 or top of page 2)
  rows = rows
    .filter(r => r.position >= 5 && r.position <= 20 && r.impressions >= 3)
    .sort((a, b) => {
      // Score: lower position + higher impressions = better opportunity
      const scoreA = (20 - a.position) * Math.log(a.impressions + 1)
      const scoreB = (20 - b.position) * Math.log(b.impressions + 1)
      return scoreB - scoreA
    })
    .slice(0, limit)

  if (rows.length === 0) return 'No quick-win opportunities found.'

  const lines: string[] = [
    `**Quick Win Opportunities** (${rows.length} keywords at position 5-20 with impressions)`,
    '_These keywords are close to page 1 — small improvements could yield big traffic gains._',
    '',
    '| Keyword | Position | Impressions | Clicks | CTR |',
    '|---------|----------|-------------|--------|-----|',
  ]

  for (const row of rows) {
    lines.push(
      `| ${row.query} | ${row.position.toFixed(1)} | ${row.impressions} | ${row.clicks} | ${(row.ctr * 100).toFixed(1)}% |`
    )
  }

  return lines.join('\n')
}

/* ── Helpers ── */

function sum(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0)
}

function avg(nums: number[]): number {
  return nums.length ? sum(nums) / nums.length : 0
}

interface WeeklyRow {
  week: string
  clicks: number
  impressions: number
  position: number
}

function aggregateWeekly(rows: GSCQueryRow[]): WeeklyRow[] {
  const weeks = new Map<string, GSCQueryRow[]>()
  for (const r of rows) {
    if (!r.date) continue
    // Get ISO week start (Monday)
    const d = new Date(r.date)
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    d.setDate(diff)
    const weekKey = d.toISOString().split('T')[0]
    const existing = weeks.get(weekKey) || []
    existing.push(r)
    weeks.set(weekKey, existing)
  }

  return [...weeks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, wRows]) => ({
      week,
      clicks: sum(wRows.map(r => r.clicks)),
      impressions: sum(wRows.map(r => r.impressions)),
      position: avg(wRows.map(r => r.position)),
    }))
}

interface TrendResult {
  keyword: string
  posChange: number
}

function applyKeywordFilterTrends<T extends TrendResult>(trends: T[], pattern?: string): T[] {
  if (!pattern) return trends
  try {
    const regex = new RegExp(pattern, 'i')
    return trends.filter(t => regex.test(t.keyword))
  } catch {
    return trends
  }
}
