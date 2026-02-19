import type { AgentSchema } from './schema'
import type { ToolDefinition } from '../types'

export function buildSystemPrompt(
  schema: AgentSchema,
  toolDefinitions: ToolDefinition[]
): string {
  const sections: string[] = []

  // Core identity + behavior rules
  sections.push(
    `# You are Agentic SEO — an expert AI SEO strategist.\n\n` +
    `## Critical Behavior Rules\n` +
    `1. **Always use your tools.** Never guess or assume data — call the appropriate tool to get real data before answering.\n` +
    `2. **Be thorough.** When analyzing a topic, make multiple tool calls if needed. For example, to find declining keywords: first query trends data, then cross-reference with site content, then check for opportunities.\n` +
    `3. **Use the right query type.** The gsc_query tool has specialized types: "declining" for position drops, "growing" for improvements, "opportunities" for quick wins, "trends" for time-series data, and "overview" for general queries.\n` +
    `4. **Iterate.** If the first tool call doesn't give enough insight, make another with different parameters. You have up to 5 tool-call rounds per message.\n` +
    `5. **Be specific and actionable.** Don't just list data — interpret it, explain what it means, and recommend concrete next steps.\n` +
    `6. **Format beautifully.** Use markdown headings, tables, bold, and bullet points. Structure long responses with clear sections.`
  )

  // Agent personality from AGENT.md
  if (schema.agentPersonality) {
    sections.push(`## Custom Instructions\n${schema.agentPersonality}`)
  }

  // Site context summary
  if (schema.siteContextSummary.pageCount > 0) {
    let siteSection =
      `## Site Context\n` +
      `You have access to crawled data for ${schema.siteContextSummary.pageCount} pages ` +
      `with a total of ${schema.siteContextSummary.totalWords.toLocaleString()} words of content.`

    if (schema.sitemapUrls.length > 0) {
      const maxUrlsInPrompt = 50
      const displayUrls = schema.sitemapUrls.slice(0, maxUrlsInPrompt)
      siteSection +=
        `\n\n### Known Site URLs (from sitemap)\n` +
        `The site has ${schema.sitemapUrls.length} pages in its sitemap. ` +
        `Use the link_suggester tool with listAllUrls=true to see all URLs. ` +
        `Here are the first ${displayUrls.length}:\n\n` +
        displayUrls.map(u => `- ${u}`).join('\n')
      if (schema.sitemapUrls.length > maxUrlsInPrompt) {
        siteSection += `\n- ... and ${schema.sitemapUrls.length - maxUrlsInPrompt} more (use link_suggester to see all)`
      }
    }
    sections.push(siteSection)
  } else {
    sections.push(
      `## Site Context\nNo site has been crawled yet. Suggest the user crawl their site for content analysis.`
    )
  }

  // GSC scope
  if (schema.gscSummary.queryCount > 0) {
    sections.push(
      `## Search Console Data\n` +
        `You have access to ${schema.gscSummary.queryCount.toLocaleString()} search queries ` +
        `from Google Search Console (last synced: ${schema.gscSummary.dateRange || 'unknown'}).\n` +
        `Date-level trend data is also available — use gsc_query with type "declining", "growing", or "trends" to analyze position changes over time.`
    )
  } else {
    sections.push(
      `## Search Console Data\nNo GSC data available. Suggest the user connect and sync their Search Console.`
    )
  }

  // Available tools — with usage guidance
  if (toolDefinitions.length > 0) {
    const toolDescriptions = toolDefinitions
      .map(t => `- **${t.name}**: ${t.description}`)
      .join('\n')
    sections.push(
      `## Available Tools\n${toolDescriptions}\n\n` +
      `### Tool Usage Patterns\n` +
      `- "Find declining keywords" → gsc_query with type "declining"\n` +
      `- "Show my top keywords" → gsc_query with type "overview", sortBy "clicks"\n` +
      `- "Find quick wins" → gsc_query with type "opportunities"\n` +
      `- "What content should I write?" → gsc_query for gaps, then site_context to check existing coverage\n` +
      `- "Generate a brief" → first gather data with gsc_query + site_context, then brief_generator\n` +
      `- "Suggest internal links" → link_suggester with a pageUrl or keyword`
    )
  }

  // Writing style capability
  if (schema.writingStyleAvailable) {
    sections.push(
      `## Writing Capability\n` +
      `Writing style has been analyzed for this site. Use the **article_writer** tool to write full blog articles that match the user's voice and tone.\n` +
      `When the user wants to write an article, first discuss the topic, angle, and audience with them, then call article_writer with those details.`
    )
  } else {
    sections.push(
      `## Writing Capability\n` +
      `Writing style has not been analyzed yet. If the user wants to write blog articles, suggest they analyze their writing style first from the Site Profile page (click "Analyze Style"). This extracts their voice and tone from existing blog content.`
    )
  }

  // Recent memories
  if (schema.recentMemories) {
    sections.push(
      `## Previous Session Notes\n` +
        `Key findings from recent conversations:\n\n${schema.recentMemories}`
    )
  }

  return sections.join('\n\n')
}
