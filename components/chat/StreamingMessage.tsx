'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import type { ToolCall, ToolResult } from '@/lib/types'
import type { ComponentPropsWithoutRef } from 'react'

interface StreamingMessageProps {
  content: string
  toolCalls: ToolCall[]
  toolResults: ToolResult[]
}

const toolLabels: Record<string, string> = {
  gsc_query: 'Querying Search Console',
  site_context: 'Analyzing site content',
  brief_generator: 'Generating content brief',
  link_suggester: 'Finding link opportunities',
  code_sandbox: 'Running data analysis',
}

const streamComponents = {
  // Make table wrapper scrollable
  table: ({ children, ...props }: ComponentPropsWithoutRef<'table'>) => (
    <div className="overflow-x-auto custom-scrollbar rounded-lg">
      <table {...props}>{children}</table>
    </div>
  ),
}

export function StreamingMessage({ content, toolCalls, toolResults }: StreamingMessageProps) {
  const isThinking = !content && toolCalls.length === 0
  const hasActiveTool = toolCalls.length > toolResults.length

  return (
    <div className="mb-6 animate-fade-in-up">
      {/* Avatar + name */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
            <path d="M12 20V10M18 20V4M6 20v-4" />
          </svg>
        </div>
        <span className="text-xs font-medium text-muted-foreground">Agentic SEO</span>
        {(isThinking || hasActiveTool) && (
          <span className="flex items-center gap-1.5 text-[11px] text-primary/70">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary/70" />
            </span>
            {isThinking ? 'Thinking...' : 'Working...'}
          </span>
        )}
      </div>

      <div className="pl-8">
        {/* Tool call indicators */}
        {toolCalls.length > 0 && (
          <div className="mb-3 space-y-1.5">
            {toolCalls.map((tc) => {
              const hasResult = toolResults.some((r) => r.toolCallId === tc.id)
              const isActive = !hasResult
              return (
                <div
                  key={tc.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-all ${
                    isActive
                      ? 'border-primary/20 bg-primary/5 tool-pulse'
                      : 'border-border bg-card/30'
                  }`}
                >
                  {isActive ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary animate-spin">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-500">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  )}
                  <span className={isActive ? 'text-foreground/80' : 'text-muted-foreground'}>
                    {toolLabels[tc.name] || tc.name}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Thinking skeleton */}
        {isThinking && (
          <div className="space-y-2.5 py-1">
            <div className="h-3 w-3/4 rounded-md bg-muted/60 animate-pulse" />
            <div className="h-3 w-1/2 rounded-md bg-muted/40 animate-pulse" />
            <div className="h-3 w-2/3 rounded-md bg-muted/50 animate-pulse" />
          </div>
        )}

        {/* Streaming content */}
        {content && (
          <div className="prose-chat">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={streamComponents}
            >
              {content}
            </ReactMarkdown>
            <span className="typing-cursor inline-block h-4 w-0.5 bg-primary ml-0.5 align-middle rounded-full" />
          </div>
        )}
      </div>
    </div>
  )
}
