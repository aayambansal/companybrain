import type { LlmProvider, CompleteOptions } from './types.js';

/** Ollama chat (fully local generation). */
export class OllamaProvider implements LlmProvider {
  readonly name = 'ollama';
  readonly model: string;
  readonly available = true;
  private baseUrl: string;

  constructor(opts: { model?: string; baseUrl?: string }) {
    this.model = opts.model ?? 'llama3.1';
    this.baseUrl = opts.baseUrl ?? 'http://localhost:11434';
  }

  async complete(opts: CompleteOptions): Promise<string> {
    const messages = opts.system
      ? [{ role: 'system', content: opts.system }, ...opts.messages]
      : opts.messages;
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        options: { temperature: opts.temperature ?? 0.2 },
        messages,
      }),
    });
    if (!res.ok) throw new Error(`Ollama completion failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { message?: { content: string } };
    return json.message?.content ?? '';
  }
}
