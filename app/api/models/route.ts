import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

interface ModelEntry {
  id: string
  name: string
  description: string
  featured: boolean
}

const MODELS: Record<string, ModelEntry[]> = {
  openai: [
    { id: 'gpt-5.2', name: 'GPT-5.2', description: 'Flagship — best for complex tasks', featured: true },
    { id: 'gpt-5.2-pro', name: 'GPT-5.2 Pro', description: 'Smarter, more precise responses', featured: true },
    { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Great balance of speed & quality', featured: true },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', description: 'Fast & affordable', featured: false },
    { id: 'gpt-4.1-nano', name: 'GPT-4.1 Nano', description: 'Fastest, lowest cost', featured: false },
    { id: 'o3-mini', name: 'o3-mini', description: 'Reasoning model for math & science', featured: false },
    { id: 'gpt-4o', name: 'GPT-4o', description: 'Legacy multimodal model', featured: false },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Legacy fast model', featured: false },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: 'Fast & intelligent — best value', featured: true },
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', description: 'Most capable — complex reasoning', featured: true },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: 'Fastest, near-frontier intelligence', featured: true },
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', description: 'Previous gen Sonnet', featured: false },
    { id: 'claude-opus-4-5-20251101', name: 'Claude Opus 4.5', description: 'Previous gen Opus', featured: false },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', description: 'Legacy Sonnet', featured: false },
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: 'Legacy Opus', featured: false },
  ],
  openrouter: [
    { id: 'minimax/minimax-m2.5', name: 'MiniMax M2.5', description: 'Frontier reasoning — $0.30/M in', featured: true },
    { id: 'deepseek/deepseek-v3.2', name: 'DeepSeek V3.2', description: 'Cheapest frontier model', featured: true },
    { id: 'moonshotai/kimi-k2.5', name: 'Kimi K2.5', description: 'Multimodal agentic, 256K ctx', featured: true },
    { id: 'qwen/qwen3.5-plus-02-15', name: 'Qwen 3.5 Plus', description: 'Alibaba latest flagship', featured: true },
    { id: 'deepseek/deepseek-r1-0528', name: 'DeepSeek R1', description: 'Deep reasoning with chain-of-thought', featured: false },
    { id: 'deepseek/deepseek-v3.2-speciale', name: 'DeepSeek V3.2 Speciale', description: 'Enhanced V3.2 variant', featured: false },
    { id: 'moonshotai/kimi-k2-thinking', name: 'Kimi K2 Thinking', description: 'Reasoning mode, 1T MoE', featured: false },
    { id: 'moonshotai/kimi-k2', name: 'Kimi K2', description: '1T params MoE, 128K ctx', featured: false },
    { id: 'minimax/minimax-m2.1', name: 'MiniMax M2.1', description: 'Previous gen MiniMax', featured: false },
    { id: 'qwen/qwen3-coder', name: 'Qwen3 Coder 480B', description: 'Best for code tasks', featured: false },
    { id: 'qwen/qwen3-max', name: 'Qwen3 Max', description: 'Alibaba largest model', featured: false },
    { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Google flagship', featured: false },
    { id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast Google model', featured: false },
    { id: 'mistralai/mistral-large-2512', name: 'Mistral Large 3', description: 'Strong European model', featured: false },
    { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick', description: 'Meta open-weight flagship', featured: false },
    { id: 'meta-llama/llama-4-scout', name: 'Llama 4 Scout', description: 'Meta fast open model', featured: false },
  ],
}

export async function GET(request: NextRequest) {
  const providerType = request.nextUrl.searchParams.get('provider')

  if (!providerType || !MODELS[providerType]) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }

  const models = MODELS[providerType]
  return NextResponse.json({
    models: models.map(m => m.id),
    detailed: models,
  })
}
