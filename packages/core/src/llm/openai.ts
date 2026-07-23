import type { LlmProvider, CompleteOptions } from './types.js';

/** OpenAI chat completions (no SDK dependency). */
export class OpenAIProvider implements LlmProvider {
  readonly name = 'openai';
  readonly model: string;
  readonly available: boolean;
  private apiKey: string;
  private baseUrl: string;

  constructor(opts: { apiKey?: string; model?: string; baseUrl?: string }) {
    this.apiKey = opts.apiKey ?? '';
    this.model = opts.model ?? 'gpt-4o-mini';
    this.baseUrl = opts.baseUrl ?? 'https://api.openai.com/v1';
    this.available = Boolean(this.apiKey);
  }

  async complete(opts: CompleteOptions): Promise<string> {
    if (!this.available) throw new Error('OPENAI_API_KEY is not set; cannot generate.');
    const messages = opts.system
      ? [{ role: 'system', content: opts.system }, ...opts.messages]
      : opts.messages;
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 1024,
        messages,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI completion failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    return json.choices[0]?.message.content ?? '';
  }
}
