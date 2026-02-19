import type { ProviderConfig } from '../types'
import { BaseProvider } from './base'
import { OpenAIProvider } from './openai'
import { AnthropicProvider } from './anthropic'
import { OpenRouterProvider } from './openrouter'

function getApiKey(providerType: string): string {
  const envMap: Record<string, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
  }
  const envVar = envMap[providerType]
  if (!envVar) throw new Error(`Unknown provider type: ${providerType}`)

  const key = process.env[envVar]
  if (!key) {
    throw new Error(`${envVar} is not set. Add it to your .env.local file.`)
  }
  return key
}

export function createProvider(config: ProviderConfig): BaseProvider {
  const apiKey = getApiKey(config.type)

  switch (config.type) {
    case 'openai':
      return new OpenAIProvider(apiKey, config.model, undefined, config.maxTokens)
    case 'anthropic':
      return new AnthropicProvider(apiKey, config.model, undefined, config.maxTokens)
    case 'openrouter':
      return new OpenRouterProvider(apiKey, config.model, config.maxTokens)
    default:
      throw new Error(`Unknown provider type: ${(config as { type: string }).type}`)
  }
}
