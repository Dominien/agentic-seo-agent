'use client'

import { useState, type ComponentPropsWithoutRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import type { ChatMessage } from '@/lib/types'

interface MessageBubbleProps {
  message: ChatMessage
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className="animate-fade-in-up">
      {isUser ? (
        <UserMessage content={message.content} />
      ) : (
        <AssistantMessage message={message} />
      )}
    </div>
  )
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end mb-4">
      <div className="max-w-[80%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-primary-foreground shadow-sm">
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    </div>
  )
}

function AssistantMessage({ message }: { message: ChatMessage }) {
  return (
    <div className="mb-6">
      {/* Avatar + name */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
            <path d="M12 20V10M18 20V4M6 20v-4" />
          </svg>
        </div>
        <span className="text-xs font-medium text-muted-foreground">Agentic SEO</span>
      </div>

      {/* Content */}
      <div className="pl-8">
        {message.content && (
          <div className="prose-chat">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={markdownComponents}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Tool results */}
        {message.toolResults && message.toolResults.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.toolResults.map((result) => (
              <ToolResultCard
                key={result.toolCallId}
                name={result.name}
                content={result.content}
                isError={result.isError}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Custom markdown components ── */

function CodeBlock({ children, className, ...props }: ComponentPropsWithoutRef<'code'>) {
  const [copied, setCopied] = useState(false)
  const isInline = !className && typeof children === 'string' && !children.includes('\n')

  if (isInline) {
    return <code className={className} {...props}>{children}</code>
  }

  const lang = className?.replace('hljs language-', '')?.replace('language-', '') || ''

  function handleCopy() {
    const text = typeof children === 'string' ? children : ''
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="group relative">
      {/* Language label + copy button */}
      <div className="flex items-center justify-between px-4 py-1.5 text-[11px] border-b border-white/[0.04]"
        style={{ background: 'oklch(0.12 0 0)' }}>
        <span className="uppercase tracking-wider text-white/25 font-medium">{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-white/30 hover:text-white/60 transition-colors"
        >
          {copied ? (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <span>Copied</span>
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" />
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <code className={className} {...props}>
        {children}
      </code>
    </div>
  )
}

const markdownComponents = {
  code: CodeBlock,
  // Make table wrapper scrollable
  table: ({ children, ...props }: ComponentPropsWithoutRef<'table'>) => (
    <div className="overflow-x-auto custom-scrollbar rounded-lg">
      <table {...props}>{children}</table>
    </div>
  ),
}

/* ── Tool Result Card ── */

function ToolResultCard({
  name,
  content,
  isError,
}: {
  name: string
  content: string
  isError?: boolean
}) {
  const [open, setOpen] = useState(false)

  const toolLabels: Record<string, { label: string; icon: string }> = {
    gsc_query: { label: 'Search Console Data', icon: 'M3 3v18h18' },
    site_context: { label: 'Site Analysis', icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9' },
    brief_generator: { label: 'Content Brief', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
    link_suggester: { label: 'Link Suggestions', icon: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71' },
    code_sandbox: { label: 'Data Analysis', icon: 'M4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.58 4 8 4s8-1.79 8-4M4 7c0-2.21 3.58-4 8-4s8 1.79 8 4' },
  }

  const tool = toolLabels[name] || { label: name, icon: 'M13 10V3L4 14h7v7l9-11h-7' }

  return (
    <div className={`rounded-lg border overflow-hidden transition-colors ${
      isError ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-card/50'
    }`}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-xs hover:bg-muted/30 transition-colors"
      >
        <span className={`flex h-5 w-5 items-center justify-center rounded ${
          isError ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
        }`}>
          {isError ? (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d={tool.icon} />
            </svg>
          )}
        </span>
        <span className="font-medium text-foreground/80">{tool.label}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`ml-auto text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="border-t border-border/50 bg-muted/10 p-3 max-h-80 overflow-auto custom-scrollbar">
          <div className="prose-chat">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={markdownComponents}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}
