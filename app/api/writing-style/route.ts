import { NextResponse } from 'next/server'
import { readProjectJSON, writeMarkdown, getActiveProjectId, projectPath } from '@/lib/store'
import { createProvider } from '@/lib/providers/factory'
import { readJSON } from '@/lib/store'
import type { AppConfig, CrawledPage, ChatMessage } from '@/lib/types'

export async function POST() {
  try {
    const projectId = await getActiveProjectId()
    const config = await readJSON<AppConfig>('config.json')

    // Load crawled pages
    let pages: CrawledPage[] = []
    try {
      pages = await readProjectJSON<CrawledPage[]>(projectId, 'site-context.json')
    } catch {
      return NextResponse.json(
        { error: 'No crawled pages found. Crawl your site first.' },
        { status: 400 }
      )
    }

    if (!Array.isArray(pages) || pages.length === 0) {
      return NextResponse.json(
        { error: 'No crawled pages found. Crawl your site first.' },
        { status: 400 }
      )
    }

    // Pick homepage + top 3-5 most important pages by word count and heading structure
    const homepage = pages.find((p) => {
      try { return new URL(p.url).pathname === '/' } catch { return false }
    })
    const otherPages = pages
      .filter((p) => p !== homepage)
      .sort((a, b) => {
        const aScore = a.wordCount + a.headings.length * 100
        const bScore = b.wordCount + b.headings.length * 100
        return bScore - aScore
      })
      .slice(0, homepage ? 4 : 5)
    const contextPages = homepage ? [homepage, ...otherPages] : otherPages

    // Build brand context from crawled pages
    const brandContext = contextPages
      .map(
        (p, i) =>
          `--- PAGE ${i + 1}: ${p.title} (${p.url}) ---\n` +
          `Headings: ${p.headings.map((h) => `${'#'.repeat(h.level)} ${h.text}`).join(' | ')}\n\n` +
          `${p.content}`
      )
      .join('\n\n')

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

    const response = await provider.chat(messages, [], 'You are a writing style strategist. Return only valid JSON.')

    // Parse the JSON response
    let styleData: Record<string, string>
    try {
      // Strip markdown code fences if present
      let content = response.content.trim()
      if (content.startsWith('```')) {
        content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
      }
      styleData = JSON.parse(content)
    } catch {
      return NextResponse.json(
        { error: 'Failed to parse writing style analysis. Try again.' },
        { status: 500 }
      )
    }

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
      }
    }

    return NextResponse.json({
      success: true,
      pagesAnalyzed: contextPages.length,
      files: savedFiles,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Writing style analysis failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
