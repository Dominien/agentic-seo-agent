import type { ToolDefinition, GSCQueryRow } from '../types'
import { readProjectJSON, getActiveProjectId } from '../store'

export const definition: ToolDefinition = {
  name: 'code_sandbox',
  description:
    'Perform safe numerical analysis on GSC data. Supports sum, avg, min, max, count, and group operations on keyword metrics.',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'The operation to perform',
        enum: ['sum', 'avg', 'min', 'max', 'count', 'group'],
      },
      field: {
        type: 'string',
        description: 'The field to operate on (clicks, impressions, ctr, position)',
      },
      filter: {
        type: 'object',
        description: 'Optional filter with field, operator (eq, gt, lt, gte, lte, contains), and value',
      },
      groupBy: {
        type: 'string',
        description: 'Field to group results by (for group operation)',
      },
    },
    required: ['operation', 'field'],
  },
}

interface GSCData {
  queries: GSCQueryRow[]
  pages: { page: string; clicks: number; impressions: number; ctr: number; position: number }[]
  lastSync: string | null
}

const ALLOWED_FIELDS = new Set(['clicks', 'impressions', 'ctr', 'position', 'query', 'page'])

export async function execute(args: Record<string, unknown>): Promise<string> {
  const operation = args.operation as string
  const field = args.field as string
  const filter = args.filter as { field: string; operator: string; value: unknown } | undefined
  const groupBy = args.groupBy as string | undefined

  if (!ALLOWED_FIELDS.has(field)) {
    return `Invalid field: "${field}". Allowed fields: ${[...ALLOWED_FIELDS].join(', ')}`
  }

  let data: GSCData
  try {
    const projectId = await getActiveProjectId()
    data = await readProjectJSON<GSCData>(projectId, 'gsc-data.json')
  } catch {
    return 'No GSC data available. Please sync Google Search Console data first.'
  }

  if (!data.queries || data.queries.length === 0) {
    return 'No GSC query data available.'
  }

  let rows: GSCQueryRow[] = [...data.queries]

  // Apply filter
  if (filter && filter.field && filter.operator && filter.value !== undefined) {
    if (!ALLOWED_FIELDS.has(filter.field)) {
      return `Invalid filter field: "${filter.field}"`
    }
    rows = rows.filter(row => applyFilter(row, filter.field, filter.operator, filter.value))
  }

  if (rows.length === 0) {
    return 'No data matches the specified filter.'
  }

  if (operation === 'group') {
    return performGroup(rows, field, groupBy)
  }

  const values = rows.map(r => {
    const val = r[field as keyof GSCQueryRow]
    return typeof val === 'number' ? val : 0
  })

  let result: number
  switch (operation) {
    case 'sum':
      result = values.reduce((a, b) => a + b, 0)
      break
    case 'avg':
      result = values.reduce((a, b) => a + b, 0) / values.length
      break
    case 'min':
      result = Math.min(...values)
      break
    case 'max':
      result = Math.max(...values)
      break
    case 'count':
      result = rows.length
      break
    default:
      return `Unknown operation: "${operation}"`
  }

  return `**${operation.toUpperCase()}(${field}):** ${formatNumber(result)} (across ${rows.length} rows)`
}

function applyFilter(
  row: GSCQueryRow,
  field: string,
  operator: string,
  value: unknown
): boolean {
  const rowVal = row[field as keyof GSCQueryRow]

  switch (operator) {
    case 'eq':
      return rowVal === value
    case 'gt':
      return typeof rowVal === 'number' && rowVal > (value as number)
    case 'lt':
      return typeof rowVal === 'number' && rowVal < (value as number)
    case 'gte':
      return typeof rowVal === 'number' && rowVal >= (value as number)
    case 'lte':
      return typeof rowVal === 'number' && rowVal <= (value as number)
    case 'contains':
      return typeof rowVal === 'string' && rowVal.toLowerCase().includes(String(value).toLowerCase())
    default:
      return true
  }
}

function performGroup(rows: GSCQueryRow[], field: string, groupBy?: string): string {
  if (!groupBy) {
    return 'The "group" operation requires a groupBy parameter.'
  }
  if (!ALLOWED_FIELDS.has(groupBy)) {
    return `Invalid groupBy field: "${groupBy}"`
  }

  const groups = new Map<string, number[]>()
  for (const row of rows) {
    const groupKey = String(row[groupBy as keyof GSCQueryRow] ?? 'unknown')
    const val = row[field as keyof GSCQueryRow]
    if (typeof val !== 'number') continue

    if (!groups.has(groupKey)) {
      groups.set(groupKey, [])
    }
    groups.get(groupKey)!.push(val)
  }

  // Compute sum for each group and sort descending
  const results = [...groups.entries()]
    .map(([key, values]) => ({
      key,
      sum: values.reduce((a, b) => a + b, 0),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      count: values.length,
    }))
    .sort((a, b) => b.sum - a.sum)
    .slice(0, 20)

  const lines: string[] = [
    `**${field} grouped by ${groupBy}** (top ${results.length} groups)`,
    '',
    `| ${groupBy} | Sum | Avg | Count |`,
    '|------|-----|-----|-------|',
  ]

  for (const r of results) {
    lines.push(`| ${r.key} | ${formatNumber(r.sum)} | ${formatNumber(r.avg)} | ${r.count} |`)
  }

  return lines.join('\n')
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toLocaleString()
  return n.toFixed(2)
}
