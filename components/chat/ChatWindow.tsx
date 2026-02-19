'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { StreamingMessage } from '@/components/chat/StreamingMessage'
import type { ChatMessage, AgentStreamEvent, ToolCall, ToolResult } from '@/lib/types'

interface ChatWindowProps {
  pendingMessage: string
  onPendingConsumed: () => void
}

export function ChatWindow({ pendingMessage, onPendingConsumed }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const [streamToolCalls, setStreamToolCalls] = useState<ToolCall[]>([])
  const [streamToolResults, setStreamToolResults] = useState<ToolResult[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamContent, streamToolCalls, scrollToBottom])

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 160) + 'px'
    }
  }, [input])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsStreaming(true)
    setStreamContent('')
    setStreamToolCalls([])
    setStreamToolResults([])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim() }),
      })

      if (!res.ok || !res.body) {
        throw new Error('Failed to send message')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let accContent = ''
      let accToolCalls: ToolCall[] = []
      let accToolResults: ToolResult[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          const trimmed = part.trim()
          if (!trimmed.startsWith('data: ')) continue
          const data = trimmed.slice(6)
          if (!data || data === '[DONE]') continue

          try {
            const event: AgentStreamEvent = JSON.parse(data)

            switch (event.type) {
              case 'text':
                accContent += event.content
                setStreamContent(accContent)
                break
              case 'tool_calls':
                accToolCalls = [...accToolCalls, ...event.toolCalls]
                setStreamToolCalls(accToolCalls)
                break
              case 'tool_result':
                accToolResults = [...accToolResults, event.result]
                setStreamToolResults(accToolResults)
                break
              case 'error':
                accContent += `\n\n**Error:** ${event.error}`
                setStreamContent(accContent)
                break
              case 'done':
                break
            }
          } catch {
            // skip malformed events
          }
        }
      }

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: accContent,
        toolCalls: accToolCalls.length > 0 ? accToolCalls : undefined,
        toolResults: accToolResults.length > 0 ? accToolResults : undefined,
        timestamp: Date.now(),
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: `Something went wrong. ${err instanceof Error ? err.message : 'Please try again.'}`,
        timestamp: Date.now(),
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsStreaming(false)
      setStreamContent('')
      setStreamToolCalls([])
      setStreamToolResults([])
    }
  }, [isStreaming])

  useEffect(() => {
    if (pendingMessage) {
      sendMessage(pendingMessage)
      onPendingConsumed()
    }
  }, [pendingMessage, onPendingConsumed, sendMessage])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const isEmpty = messages.length === 0 && !isStreaming

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {isEmpty && <EmptyState />}

          <div className="space-y-1">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {isStreaming && (
              <StreamingMessage
                content={streamContent}
                toolCalls={streamToolCalls}
                toolResults={streamToolResults}
              />
            )}
          </div>
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 py-3">
          <form onSubmit={handleSubmit} className="relative">
            <div className="flex items-end gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-sm focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isStreaming ? 'Waiting for response...' : 'Ask about your SEO performance...'}
                disabled={isStreaming}
                className="flex-1 resize-none bg-transparent text-sm leading-relaxed placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
                rows={1}
                style={{ maxHeight: '160px' }}
              />
              <button
                type="submit"
                disabled={isStreaming || !input.trim()}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-30 disabled:hover:bg-primary"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </form>
          <p className="mt-2 text-center text-[11px] text-muted-foreground/40">
            Press Enter to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in-up">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary">
          <path d="M12 20V10M18 20V4M6 20v-4" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold mb-2">What can I help you with?</h2>
      <p className="text-muted-foreground text-sm max-w-md leading-relaxed">
        I can analyze your search performance, find content opportunities,
        generate briefs, and suggest optimization strategies. Try a quick action from the sidebar or ask me anything.
      </p>
    </div>
  )
}
