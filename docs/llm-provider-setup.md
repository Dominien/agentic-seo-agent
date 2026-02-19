# LLM Provider Setup Guide

Agentic SEO supports multiple LLM providers. You need at least one configured to use the chat agent.

## OpenAI

### Getting an API Key

1. Go to [platform.openai.com](https://platform.openai.com/)
2. Sign in or create an account
3. Go to **API keys** → **Create new secret key**
4. Copy the key (starts with `sk-`)

### Available Models

| Model | Best For | Notes |
|-------|----------|-------|
| `gpt-4o` | General use (recommended) | Fast, capable, good tool use |
| `gpt-4o-mini` | Budget-friendly | Cheaper, slightly less capable |
| `gpt-4-turbo` | Complex analysis | Higher quality, slower |
| `o3-mini` | Reasoning tasks | Good for complex SEO analysis |

### Configuration

In the app UI (onboarding or Settings page):
1. Select **OpenAI** as provider
2. Paste your API key
3. Choose a model from the dropdown

## Anthropic

### Getting an API Key

1. Go to [console.anthropic.com](https://console.anthropic.com/)
2. Sign in or create an account
3. Go to **API Keys** → **Create Key**
4. Copy the key (starts with `sk-ant-`)

### Available Models

| Model | Best For | Notes |
|-------|----------|-------|
| `claude-sonnet-4-20250514` | General use (recommended) | Fast, great tool use |
| `claude-sonnet-4-6` | Latest Sonnet | Newest version |
| `claude-opus-4-6` | Complex analysis | Most capable, slower |
| `claude-haiku-4-5-20251001` | Budget-friendly | Fastest, cheapest |

### Configuration

In the app UI (onboarding or Settings page):
1. Select **Anthropic** as provider
2. Paste your API key
3. Choose a model from the dropdown

## Changing Providers

You can switch providers at any time in **Settings** → **Provider** tab. Your chat history is preserved when switching — only new messages will use the new provider.

## API Key Security

- API keys are stored in `data/config.json` on your local machine
- Keys are never sent to any server other than the respective LLM provider
- The `/api/config` GET endpoint redacts API keys (shows `***`)
- Keep your `.env.local` and `data/` directory out of version control (both are in `.gitignore`)
