import type {
  AgentStreamEvent,
  ChatMessage,
  ToolCall,
  ToolResult,
  ToolDefinition,
  StreamChunk,
} from '../types'
import { writeJSON, writeProjectJSON, getActiveProjectId } from '../store'
import { createProvider } from '../providers/factory'
import { buildSchema } from './schema'
import { buildSystemPrompt } from './prompts'
import { extractAndSaveMemory } from './memory'

import * as gscQuery from '../tools/gsc-query'
import * as siteContext from '../tools/site-context'
import * as briefGenerator from '../tools/brief-generator'
import * as linkSuggester from '../tools/link-suggester'
import * as codeSandbox from '../tools/code-sandbox'
import * as articleWriter from '../tools/article-writer'

// Tool registry
const toolRegistry = new Map<
  string,
  { definition: ToolDefinition; execute: (args: Record<string, unknown>) => Promise<string> }
>([
  ['gsc_query', gscQuery],
  ['site_context', siteContext],
  ['brief_generator', briefGenerator],
  ['link_suggester', linkSuggester],
  ['code_sandbox', codeSandbox],
  ['article_writer', articleWriter],
])

const MAX_ITERATIONS = 5
const MAX_HISTORY = 20
const MAX_TOOL_RESULT_CHARS = 3000

export async function* runAgent(userMessage: string): AsyncGenerator<AgentStreamEvent> {
  try {
    // Load schema and build prompt
    const schema = await buildSchema()
    const toolDefinitions = [...toolRegistry.values()].map(t => t.definition)
    const systemPrompt = buildSystemPrompt(schema, toolDefinitions)

    // Create provider
    const provider = createProvider(schema.config.provider)

    // Load and update chat history
    const history: ChatMessage[] = schema.chatHistory

    // Add user message
    history.push({
      id: generateId(),
      role: 'user',
      content: userMessage,
      timestamp: Date.now(),
    })

    // Agent loop — stream LLM, execute tool calls, repeat
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      // Collect full response from stream
      let assistantContent = ''
      const toolCalls: ToolCall[] = []
      const pendingToolCalls = new Map<string, { id: string; name: string; args: string }>()
      let finishReason: string | undefined

      const stream = provider.stream(history, toolDefinitions, systemPrompt)

      for await (const chunk of stream as AsyncGenerator<StreamChunk>) {
        switch (chunk.type) {
          case 'text':
            assistantContent += chunk.content
            yield { type: 'text', content: chunk.content }
            break

          case 'tool_call_start':
            pendingToolCalls.set(chunk.toolCall.id, {
              id: chunk.toolCall.id,
              name: chunk.toolCall.name,
              args: '',
            })
            break

          case 'tool_call_delta': {
            const pending = pendingToolCalls.get(chunk.toolCallId)
            if (pending) {
              pending.args += chunk.args
            }
            break
          }

          case 'tool_call_end': {
            const completed = pendingToolCalls.get(chunk.toolCallId)
            if (completed) {
              let parsedArgs: Record<string, unknown> = {}
              try {
                parsedArgs = completed.args ? JSON.parse(completed.args) : {}
              } catch {
                // Invalid JSON args
              }
              toolCalls.push({
                id: completed.id,
                name: completed.name,
                arguments: parsedArgs,
              })
              pendingToolCalls.delete(chunk.toolCallId)
            }
            break
          }

          case 'done':
            finishReason = chunk.finishReason
            break
        }
      }

      // Save assistant message to history
      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: assistantContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        timestamp: Date.now(),
      }
      history.push(assistantMsg)

      // If no tool calls, we're done
      if (toolCalls.length === 0) {
        if (finishReason === 'length') {
          // Model hit token limit — warn user
          yield { type: 'text', content: '\n\n---\n*Response was cut short because the model reached its output token limit. Try asking a more focused question, or switch to a model with a larger context window.*' }
        } else if (iteration === 0 && !assistantContent.trim()) {
          yield { type: 'text', content: 'The model returned an empty response. This can happen with some providers — please try again or switch models.' }
        }
        break
      }

      // If tool calls were made but finish_reason is 'length', the model was cut off mid-generation.
      // The tool calls may be incomplete, but we'll try to proceed anyway.

      // Execute tool calls
      yield { type: 'tool_calls', toolCalls }

      const toolResults: ToolResult[] = []
      for (const tc of toolCalls) {
        const tool = toolRegistry.get(tc.name)
        if (!tool) {
          const errorResult: ToolResult = {
            toolCallId: tc.id,
            name: tc.name,
            content: `Unknown tool: ${tc.name}`,
            isError: true,
          }
          toolResults.push(errorResult)
          yield { type: 'tool_error', error: errorResult.content, toolCallId: tc.id }
          continue
        }

        try {
          const result = await tool.execute(tc.arguments)
          const toolResult: ToolResult = {
            toolCallId: tc.id,
            name: tc.name,
            content: result,
          }
          toolResults.push(toolResult)
          yield { type: 'tool_result', result: toolResult }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Tool execution failed'
          const errorResult: ToolResult = {
            toolCallId: tc.id,
            name: tc.name,
            content: errorMsg,
            isError: true,
          }
          toolResults.push(errorResult)
          yield { type: 'tool_error', error: errorMsg, toolCallId: tc.id }
        }
      }

      // Add tool results to history (truncated to prevent context explosion)
      const truncatedResults = toolResults.map(r => ({
        ...r,
        content: r.content.length > MAX_TOOL_RESULT_CHARS
          ? r.content.slice(0, MAX_TOOL_RESULT_CHARS) + '\n\n... [truncated — data continues beyond this point]'
          : r.content,
      }))
      history.push({
        id: generateId(),
        role: 'tool',
        content: truncatedResults.map(r => `[${r.name}]: ${r.content}`).join('\n\n'),
        toolResults: truncatedResults,
        timestamp: Date.now(),
      })

      // Loop back to LLM with tool results
    }

    // Save chat history (cap at last N messages)
    const trimmedHistory = history.slice(-MAX_HISTORY)
    try {
      const projectId = await getActiveProjectId()
      await writeProjectJSON(projectId, 'chat-history.json', trimmedHistory)
    } catch {
      // Fallback: no active project, skip saving
    }

    // Fire-and-forget: extract memory from conversation
    const provider2 = createProvider(schema.config.provider)
    extractAndSaveMemory(trimmedHistory, provider2).catch(() => {
      // Best-effort, ignore errors
    })

    yield { type: 'done' }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred'
    yield { type: 'error', error: errorMsg }
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
