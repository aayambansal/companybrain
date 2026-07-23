import type { EngineConfig } from '../config.js';
import type { LlmProvider, CompleteOptions } from './types.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';
import { OllamaProvider } from './ollama.js';

export * from './types.js';
export { AnthropicProvider, OpenAIProvider, OllamaProvider };

/** A stub used when no LLM is configured. Chat degrades to extractive answers. */
export class NoopLlmProvider implements LlmProvider {
  readonly name = 'none';
  readonly model = 'none';
  readonly available = false;
  async complete(_opts: CompleteOptions): Promise<string> {
    throw new Error('No LLM provider configured. Set LLM_PROVIDER to anthropic, openai, or ollama.');
  }
}

export function createLlmProvider(config: EngineConfig): LlmProvider {
  const l = config.llm;
  switch (l.provider) {
    case 'anthropic':
      return new AnthropicProvider({ apiKey: l.anthropicApiKey, model: l.model });
    case 'openai':
      return new OpenAIProvider({ apiKey: l.openaiApiKey, model: l.model });
    case 'ollama':
      return new OllamaProvider({ model: l.model, baseUrl: l.ollamaBaseUrl });
    case 'none':
    default:
      return new NoopLlmProvider();
  }
}
