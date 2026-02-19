import type { ChatMessage } from '../types'
import type { BaseProvider } from '../providers/base'
import { listFiles, readMarkdown, writeMarkdown } from '../store'

export async function extractAndSaveMemory(
  messages: ChatMessage[],
  provider: BaseProvider
): Promise<void> {
  if (messages.length < 2) return

  // Take the last few messages for context
  const recentMessages = messages.slice(-10)
  const conversationText = recentMessages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n\n')

  const extractionPrompt = [
    {
      id: 'extract',
      role: 'user' as const,
      content: `Extract key SEO findings and recommendations from this conversation. Focus on:
- Specific keyword opportunities discovered
- Content gaps identified
- Performance issues noted
- Action items recommended

If there are no meaningful findings, respond with "NO_FINDINGS".

Conversation:
${conversationText}

Respond with a concise markdown summary of findings only. No preamble.`,
      timestamp: Date.now(),
    },
  ]

  try {
    const response = await provider.chat(extractionPrompt)
    const content = response.content.trim()

    if (content === 'NO_FINDINGS' || content.length < 20) return

    const date = new Date().toISOString().split('T')[0]
    const timestamp = Date.now()
    const filename = `memory/${date}-${timestamp}.md`

    const memoryContent = `# Session Notes — ${date}\n\n${content}\n`
    await writeMarkdown(filename, memoryContent)
  } catch {
    // Memory extraction is best-effort, don't throw
  }
}

export async function loadRecentMemories(limit: number): Promise<string> {
  const files = await listFiles('memory')
  const mdFiles = files
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse()
    .slice(0, limit)

  if (mdFiles.length === 0) return ''

  const contents: string[] = []
  for (const file of mdFiles) {
    const content = await readMarkdown(`memory/${file}`)
    if (content) contents.push(content)
  }

  return contents.join('\n---\n\n')
}
