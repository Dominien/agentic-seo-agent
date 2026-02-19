import { NextResponse } from 'next/server'
import { readProjectJSON, writeMarkdown, getActiveProjectId, projectPath } from '@/lib/store'
import { createProvider } from '@/lib/providers/factory'
import { readJSON } from '@/lib/store'
import type { AppConfig, CrawledPage, ChatMessage } from '@/lib/types'

export async function POST() {
  const t0 = Date.now()
  const log = (step: string, detail?: string) =>
    console.log(`[writing-style] ${step}${detail ? ` — ${detail}` : ''} (${Date.now() - t0}ms)`)

  try {
    log('start')
    const projectId = await getActiveProjectId()
    const config = await readJSON<AppConfig>('config.json')
    log('config loaded', `project=${projectId}, provider=${config.provider.type}/${config.provider.model}`)

    // Load crawled pages
    let pages: CrawledPage[] = []
    try {
      pages = await readProjectJSON<CrawledPage[]>(projectId, 'site-context.json')
    } catch (err) {
      log('error', `failed to load site-context.json: ${err instanceof Error ? err.message : err}`)
      return NextResponse.json(
        { error: 'No crawled pages found. Crawl your site first.' },
        { status: 400 }
      )
    }

    if (!Array.isArray(pages) || pages.length === 0) {
      log('error', 'site-context.json is empty or not an array')
      return NextResponse.json(
        { error: 'No crawled pages found. Crawl your site first.' },
        { status: 400 }
      )
    }

    log('pages loaded', `${pages.length} pages, ${pages.reduce((s, p) => s + p.wordCount, 0)} total words`)

    // Pick homepage + a diverse mix of page types to understand the brand voice
    // 1. Find homepage flexibly (/, /de, /en, or shortest pathname)
    const homepage = pages
      .slice()
      .sort((a, b) => {
        try {
          const pa = new URL(a.url).pathname.replace(/\/+$/, '') || '/'
          const pb = new URL(b.url).pathname.replace(/\/+$/, '') || '/'
          return pa.length - pb.length
        } catch { return 0 }
      })
      .find((p) => {
        try {
          const path = new URL(p.url).pathname.replace(/\/+$/, '') || '/'
          return path === '/' || /^\/[a-z]{2}$/.test(path) // /, /de, /en, etc.
        } catch { return false }
      })

    if (homepage) log('homepage found', homepage.url)
    else log('homepage not found', 'no homepage detected in crawled pages')

    const contextPages = homepage ? [homepage] : []

    if (contextPages.length === 0) {
      log('error', 'no homepage found — cannot generate style')
      return NextResponse.json(
        { error: 'Homepage not found in crawled pages. Make sure your homepage is crawled.' },
        { status: 400 }
      )
    }

    log('pages selected', contextPages.map(p => p.url).join(', '))

    // Build brand context — truncate each page to 3000 chars to keep prompt reasonable
    const MAX_CONTENT_CHARS = 3000
    const brandContext = contextPages
      .map(
        (p, i) => {
          const truncated = p.content.length > MAX_CONTENT_CHARS
            ? p.content.slice(0, MAX_CONTENT_CHARS) + '\n[... content truncated ...]'
            : p.content
          return (
            `--- PAGE ${i + 1}: ${p.title} (${p.url}) ---\n` +
            `Headings: ${p.headings.map((h) => `${'#'.repeat(h.level)} ${h.text}`).join(' | ')}\n\n` +
            truncated
          )
        }
      )
      .join('\n\n')

    const promptCharCount = brandContext.length
    log('prompt built', `${promptCharCount} chars of brand context (${contextPages.length} pages, max ${MAX_CONTENT_CHARS}/page)`)

    const generationPrompt = `You are a writing style strategist. Based on the following website pages, **generate** a comprehensive writing style guide for this brand's blog content. You are NOT extracting style from existing blog posts — you are creating a style guide from scratch based on the brand's identity, tone of copy, products, and audience.

${brandContext}

Return a JSON object with these exact keys. Each value should be detailed markdown content:

1. "ANTI_WORDS" — Words and phrases that should be banned from this brand's blog content. Include this hardcoded AI slop list that should ALWAYS be banned:
   - Words: leverage, delve, tapestry, moreover, furthermore, additionally, consequently, nevertheless, notwithstanding, facilitate, utilize, optimize, streamline, synergy, paradigm, holistic, robust, scalable, innovative, cutting-edge, game-changer, unlock, empower, elevate, harness, navigate, foster, spearhead, revolutionize, supercharge, skyrocket, comprehensive, groundbreaking, seamless, pivotal
   - Phrases: "in conclusion", "it's worth noting", "in today's digital landscape", "in today's world", "at the end of the day", "when it comes to", "it goes without saying", "needless to say", "without further ado", "let's dive in", "let's dive deep", "the landscape of", "in the realm of", "it's important to note", "as we all know", "first and foremost", "last but not least", "take it to the next level", "a game changer", "move the needle"
   - Transitions to avoid: "Moreover,", "Furthermore,", "Additionally,", "In addition,", "Consequently,", "As a result,", "That being said,", "With that in mind,", "Having said that,"
   Also add brand-appropriate anti-words — words that don't fit this specific brand's voice.
   Format: List them as bullet points under clear categories.

2. "TONE" — Formality level (1-10 scale), humor style, personality traits, reading level, specific do's and don'ts. Inferred from the brand's website copy and positioning.

3. "STRUCTURE" — How blog articles should open (note: never start with "In today's..."), heading patterns, paragraph length norms, CTA patterns, how articles should close, any anti-patterns to avoid.

4. "EXAMPLES" — Generate 2-3 example snippets (2-3 paragraphs each) showing how blog content should sound for this brand. These are NOT extracted from the site — they are original examples you write to demonstrate the ideal voice. For each, include the snippet and a note about what makes it on-brand.

5. "CONTEXT" — What the brand/site does, who they write for, products/services mentioned, expertise areas, industry.

6. "SENTENCE_STYLE" — Recommended sentence length variation, first/second/third person usage, question usage, punctuation style, no hedging patterns (avoid "might", "could potentially", "it seems like"), and any other sentence-level guidelines.

Respond with ONLY valid JSON. No markdown code fences. The JSON object should have exactly these 6 string keys: ANTI_WORDS, TONE, STRUCTURE, EXAMPLES, CONTEXT, SENTENCE_STYLE.`

    const provider = createProvider(config.provider)
    const messages: ChatMessage[] = [
      {
        id: 'style-gen-1',
        role: 'user',
        content: generationPrompt,
        timestamp: Date.now(),
      },
    ]

    log('llm call start', `model=${config.provider.model}, maxTokens=${config.provider.maxTokens || 'default'}`)

    let response
    try {
      response = await provider.chat(messages, [], 'You are a writing style strategist. Return only valid JSON.')
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      log('llm call FAILED', errMsg)
      return NextResponse.json(
        { error: `LLM call failed: ${errMsg}` },
        { status: 502 }
      )
    }

    log('llm call done', `response=${response.content.length} chars, usage=${JSON.stringify(response.usage || {})}`)

    // Parse the JSON response
    let styleData: Record<string, string>
    try {
      // Strip markdown code fences if present
      let content = response.content.trim()
      if (content.startsWith('```')) {
        content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }
      styleData = JSON.parse(content)
    } catch (parseErr) {
      const preview = response.content.slice(0, 300)
      log('json parse FAILED', `first 300 chars: ${preview}`)
      return NextResponse.json(
        { error: `Failed to parse LLM response as JSON. Response starts with: ${preview.slice(0, 100)}...` },
        { status: 500 }
      )
    }

    const keys = Object.keys(styleData)
    log('json parsed', `keys: ${keys.join(', ')}`)

    // Save each file
    const fileMap: Record<string, string> = {
      ANTI_WORDS: 'ANTI_WORDS.md',
      TONE: 'TONE.md',
      STRUCTURE: 'STRUCTURE.md',
      EXAMPLES: 'EXAMPLES.md',
      CONTEXT: 'CONTEXT.md',
      SENTENCE_STYLE: 'SENTENCE_STYLE.md',
    }

    const savedFiles: string[] = []
    for (const [key, filename] of Object.entries(fileMap)) {
      if (styleData[key]) {
        const filePath = projectPath(projectId, `writing/${filename}`)
        await writeMarkdown(filePath, styleData[key])
        savedFiles.push(filename)
        log('file saved', `${filename} (${styleData[key].length} chars)`)
      } else {
        log('file MISSING', `key "${key}" not in LLM response`)
      }
    }

    log('done', `${savedFiles.length} files saved, ${contextPages.length} pages analyzed`)

    return NextResponse.json({
      success: true,
      pagesAnalyzed: contextPages.length,
      files: savedFiles,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Writing style analysis failed'
    const stack = err instanceof Error ? err.stack : undefined
    console.error(`[writing-style] UNHANDLED ERROR (${Date.now() - t0}ms):`, message)
    if (stack) console.error(stack)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
