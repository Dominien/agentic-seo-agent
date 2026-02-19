import type {
  ChatMessage,
  ToolDefinition,
  LLMResponse,
  StreamChunk,
  ToolCall,
} from '../types'
import { BaseProvider } from './base'

const CLAUDE_MODELS = [
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-5-20250929',
  'claude-opus-4-5-20251101',
  'claude-sonnet-4-20250514',
  'claude-opus-4-20250514',
]

export class AnthropicProvider extends BaseProvider {
  constructor(apiKey: string, model: string, baseUrl?: string, maxTokens?: number) {
    super(apiKey, model, baseUrl ?? 'https://api.anthropic.com/v1', maxTokens)
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
    }
  }

  protected formatTools(tools: ToolDefinition[]) {
    return tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }))
  }

  protected formatMessages(messages: ChatMessage[]) {
    const out: Record<string, unknown>[] = []

    for (const msg of messages) {
      if (msg.role === 'tool' && msg.toolResults) {
        out.push({
          role: 'user',
          content: msg.toolResults.map((r) => ({
            type: 'tool_result',
            tool_use_id: r.toolCallId,
            content: r.content,
            ...(r.isError ? { is_error: true } : {}),
          })),
        })
        continue
      }

      if (msg.role === 'assistant' && msg.toolCalls?.length) {
        const content: Record<string, unknown>[] = []
        if (msg.content) {
          content.push({ type: 'text', text: msg.content })
        }
        for (const tc of msg.toolCalls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          })
        }
        out.push({ role: 'assistant', content })
        continue
      }

      out.push({
        role: msg.role === 'tool' ? 'user' : msg.role,
        content: msg.content,
      })
    }

    return out
  }

  async chat(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    systemPrompt?: string,
  ): Promise<LLMResponse> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: this.formatMessages(messages),
      max_tokens: this.maxTokens,
    }

    if (systemPrompt) {
      body.system = systemPrompt
    }

    if (tools?.length) {
      body.tools = this.formatTools(tools)
    }

    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Anthropic API error ${res.status}: ${text}`)
    }

    const data = await res.json()

    let content = ''
    const toolCalls: ToolCall[] = []

    for (const block of data.content ?? []) {
      if (block.type === 'text') {
        content += block.text
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: block.input,
        })
      }
    }

    return {
      content,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      usage: data.usage
        ? {
            promptTokens: data.usage.input_tokens,
            completionTokens: data.usage.output_tokens,
          }
        : undefined,
    }
  }

  async *stream(
    messages: ChatMessage[],
    tools?: ToolDefinition[],
    systemPrompt?: string,
  ): AsyncGenerator<StreamChunk> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: this.formatMessages(messages),
      max_tokens: this.maxTokens,
      stream: true,
    }

    if (systemPrompt) {
      body.system = systemPrompt
    }

    if (tools?.length) {
      body.tools = this.formatTools(tools)
    }

    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Anthropic API error ${res.status}: ${text}`)
    }

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    // Track current tool use block
    let currentToolId = ''
    let currentToolArgs = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop()!

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const payload = trimmed.slice(6)

        let event: Record<string, unknown>
        try {
          event = JSON.parse(payload)
        } catch {
          continue
        }

        const eventType = event.type as string

        switch (eventType) {
          case 'content_block_start': {
            const block = event.content_block as {
              type: string
              id?: string
              name?: string
            }
            if (block?.type === 'tool_use') {
              currentToolId = block.id ?? ''
              currentToolArgs = ''
              yield {
                type: 'tool_call_start',
                toolCall: { id: currentToolId, name: block.name ?? '' },
              }
            }
            break
          }

          case 'content_block_delta': {
            const delta = event.delta as {
              type: string
              text?: string
              partial_json?: string
            }
            if (delta?.type === 'text_delta' && delta.text) {
              yield { type: 'text', content: delta.text }
            } else if (delta?.type === 'input_json_delta' && delta.partial_json) {
              currentToolArgs += delta.partial_json
              yield {
                type: 'tool_call_delta',
                toolCallId: currentToolId,
                args: delta.partial_json,
              }
            }
            break
          }

          case 'content_block_stop': {
            if (currentToolId) {
              yield { type: 'tool_call_end', toolCallId: currentToolId }
              currentToolId = ''
              currentToolArgs = ''
            }
            break
          }

          case 'message_delta': {
            const msgDelta = event.delta as { stop_reason?: string } | undefined
            const usage = (event as { usage?: { input_tokens: number; output_tokens: number } })
              .usage
            const stopReason = msgDelta?.stop_reason
            if (usage || stopReason) {
              yield {
                type: 'done',
                finishReason: stopReason === 'max_tokens' ? 'length' : stopReason,
                ...(usage ? {
                  usage: {
                    promptTokens: usage.input_tokens,
                    completionTokens: usage.output_tokens,
                  },
                } : {}),
              }
              return
            }
            break
          }

          case 'message_stop': {
            yield { type: 'done' }
            return
          }
        }
      }
    }

    yield { type: 'done' }
  }

  async listModels(): Promise<string[]> {
    return [...CLAUDE_MODELS]
  }
}
