import type { LlmProvider, CompleteOptions, ImageInput } from './types.js';

const IMAGE_PROMPT =
  'Extract all text from this image verbatim (OCR). Then, on a new line starting with "Description:", briefly describe what the image shows. If there is no text, just give the description.';

/** Anthropic Claude via the Messages API (no SDK dependency). */
export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';
  readonly model: string;
  readonly available: boolean;
  readonly supportsVision = true;
  private apiKey: string;
  private baseUrl = 'https://api.anthropic.com/v1';

  constructor(opts: { apiKey?: string; model?: string }) {
    this.apiKey = opts.apiKey ?? '';
    this.model = opts.model ?? 'claude-sonnet-5';
    this.available = Boolean(this.apiKey);
  }

  async describeImage(image: ImageInput, prompt?: string): Promise<string> {
    this.assert();
    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } },
              { type: 'text', text: prompt ?? IMAGE_PROMPT },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic vision failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { content: { type: string; text?: string }[] };
    return json.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('');
  }

  async complete(opts: CompleteOptions): Promise<string> {
    this.assert();
    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.2,
        system: opts.system,
        messages: opts.messages.map((m) => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content })),
      }),
    });
    if (!res.ok) throw new Error(`Anthropic completion failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { content: { type: string; text?: string }[] };
    return json.content
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('');
  }

  async *stream(opts: CompleteOptions): AsyncIterable<string> {
    this.assert();
    const res = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.2,
        system: opts.system,
        stream: true,
        messages: opts.messages.map((m) => ({ role: m.role === 'system' ? 'user' : m.role, content: m.content })),
      }),
    });
    if (!res.ok || !res.body) throw new Error(`Anthropic stream failed: ${res.status}`);
    for await (const evt of sseLines(res.body)) {
      if (!evt.startsWith('data:')) continue;
      const data = evt.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data) as {
          type: string;
          delta?: { type: string; text?: string };
        };
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          yield parsed.delta.text;
        }
      } catch {
        // ignore keep-alive / non-json lines
      }
    }
  }

  private assert() {
    if (!this.available) throw new Error('ANTHROPIC_API_KEY is not set; cannot generate.');
  }
}

/** Split a byte stream into SSE event lines. */
async function* sseLines(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line) yield line;
    }
  }
  if (buffer.trim()) yield buffer.trim();
}
