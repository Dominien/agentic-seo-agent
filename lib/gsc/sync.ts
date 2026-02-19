import type { AppConfig, GSCQueryRow, GSCPageRow } from '../types'
import { getValidToken, querySearchAnalytics } from './client'
import { writeJSON, writeProjectJSON } from '../store'

const PAGE_SIZE = 25000

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

async function fetchAllRows(
  accessToken: string,
  siteUrl: string,
  startDate: string,
  endDate: string,
  dimensions: string[]
): Promise<GSCQueryRow[]> {
  const allRows: GSCQueryRow[] = []
  let startRow = 0

  while (startRow < PAGE_SIZE) {
    const rows = await querySearchAnalytics(accessToken, siteUrl, {
      startDate,
      endDate,
      dimensions,
      rowLimit: PAGE_SIZE,
      startRow,
    })

    if (rows.length === 0) break
    allRows.push(...rows)

    if (rows.length < PAGE_SIZE) break
    startRow += rows.length
  }

  return allRows
}

export async function syncGSCData(
  config: AppConfig,
  projectId: string,
  siteUrl: string
): Promise<{ queries: GSCQueryRow[]; pages: GSCPageRow[] }> {
  if (!siteUrl) {
    throw new Error('No site URL configured. Please select a property first.')
  }

  const { token } = await getValidToken(config)

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 90)

  const startStr = formatDate(startDate)
  const endStr = formatDate(endDate)

  // Fetch three datasets in parallel:
  // 1. Aggregated queries (no date) — for overall keyword performance
  // 2. Date + query — for trend/decline analysis
  // 3. Aggregated pages — for page-level performance
  const [queries, dateQueries, pageRows] = await Promise.all([
    fetchAllRows(token, siteUrl, startStr, endStr, ['query']),
    fetchAllRows(token, siteUrl, startStr, endStr, ['date', 'query']),
    fetchAllRows(token, siteUrl, startStr, endStr, ['page']),
  ])

  const pages: GSCPageRow[] = pageRows.map((row) => ({
    page: row.page || row.query,
    clicks: row.clicks,
    impressions: row.impressions,
    ctr: row.ctr,
    position: row.position,
  }))

  const gscData = {
    queries,
    dateQueries,
    pages,
    syncedAt: new Date().toISOString(),
    siteUrl,
    dateRange: { startDate: startStr, endDate: endStr },
  }

  await writeProjectJSON(projectId, 'gsc-data.json', gscData)

  // Update project lastSync in config
  const now = new Date().toISOString()
  const project = config.projects?.find(p => p.id === projectId)
  if (project) {
    project.lastSync = now
    await writeJSON('config.json', config)
  }

  return { queries, pages }
}
