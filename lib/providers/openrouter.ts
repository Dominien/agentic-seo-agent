import { OpenAIProvider } from './openai'

export class OpenRouterProvider extends OpenAIProvider {
  constructor(apiKey: string, model: string, maxTokens?: number) {
    super(apiKey, model, 'https://openrouter.ai/api/v1', maxTokens)
  }

  async listModels(): Promise<string[]> {
    return [
      'minimax/minimax-m2.5',
      'deepseek/deepseek-v3.2',
      'moonshotai/kimi-k2.5',
      'qwen/qwen3.5-plus-02-15',
      'deepseek/deepseek-r1-0528',
      'deepseek/deepseek-v3.2-speciale',
      'moonshotai/kimi-k2-thinking',
      'moonshotai/kimi-k2',
      'minimax/minimax-m2.1',
      'qwen/qwen3-coder',
      'qwen/qwen3-max',
      'google/gemini-2.5-pro',
      'google/gemini-2.5-flash',
      'mistralai/mistral-large-2512',
      'meta-llama/llama-4-maverick',
      'meta-llama/llama-4-scout',
    ]
  }
}
