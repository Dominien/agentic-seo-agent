import type { ToolCall, ToolResult } from '../types'

type ToolExecutor = (args: Record<string, unknown>) => Promise<string>

export async function triangulateResults(
  toolCalls: ToolCall[],
  results: ToolResult[],
  toolRegistry: Map<string, { execute: ToolExecutor }>
): Promise<'high' | 'medium' | 'low'> {
  if (toolCalls.length === 0) return 'high'

  let matchCount = 0
  let totalChecked = 0

  for (let i = 0; i < toolCalls.length; i++) {
    const call = toolCalls[i]
    const originalResult = results[i]
    if (!originalResult || originalResult.isError) continue

    const tool = toolRegistry.get(call.name)
    if (!tool) continue

    totalChecked++
    try {
      const reResult = await tool.execute(call.arguments)
      if (reResult === originalResult.content) {
        matchCount++
      } else {
        // Check for approximate match (same length within 10%)
        const lenDiff = Math.abs(reResult.length - originalResult.content.length)
        const maxLen = Math.max(reResult.length, originalResult.content.length)
        if (maxLen > 0 && lenDiff / maxLen < 0.1) {
          matchCount += 0.5
        }
      }
    } catch {
      // Re-execution failed — counts as mismatch
    }
  }

  if (totalChecked === 0) return 'medium'

  const ratio = matchCount / totalChecked
  if (ratio >= 0.9) return 'high'
  if (ratio >= 0.5) return 'medium'
  return 'low'
}
