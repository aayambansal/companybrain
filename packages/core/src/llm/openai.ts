import type { LlmProvider, CompleteOptions, ImageInput } from './types.js';

const IMAGE_PROMPT =
  'Extract all text from this image verbatim (OCR). Then, on a new line starting with "Description:", briefly describe what the image shows. If there is no text, just give the description.';

/** OpenAI chat completions (no SDK dependency). */
export class OpenAIProvider implements LlmProvider {
  readonly name = 'openai';
  readonly model: string;
  readonly available: boolean;
  readonly supportsVision = true;
  readonly supportsAudio = true;
  private apiKey: string;
  private baseUrl: string;

  constructor(opts: { apiKey?: string; model?: string; baseUrl?: string }) {
    this.apiKey = opts.apiKey ?? '';
    this.model = opts.model ?? 'gpt-4o-mini';
    this.baseUrl = opts.baseUrl ?? 'https://api.openai.com/v1';
    this.available = Boolean(this.apiKey);
  }

  async describeImage(image: ImageInput, prompt?: string): Promise<string> {
    if (!this.available) throw new Error('OPENAI_API_KEY is not set; cannot read images.');
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt ?? IMAGE_PROMPT },
              { type: 'image_url', image_url: { url: `data:${image.mediaType};base64,${image.base64}` } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`OpenAI vision failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    return json.choices[0]?.message.content ?? '';
  }

  async transcribeAudio(audio: ImageInput): Promise<string> {
    if (!this.available) throw new Error('OPENAI_API_KEY is not set; cannot transcribe audio.');
    const bytes = Buffer.from(audio.base64, 'base64');
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: audio.mediaType }), 'audio');
    form.append('model', 'whisper-1');
    const res = await fetch(`${this.baseUrl}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });
    if (!res.ok) throw new Error(`OpenAI transcription failed: ${res.status} ${await res.text()}`);
    const json = (await res.json()) as { text: string };
    return json.text ?? '';
  }

  async complete(opts: CompleteOptions): Promise<string> {
    if (!this.available) throw new Error('OPENAI_API_KEY is not set; cannot generate.');
    const messages = opts.system
      ? [{ role: 'system', content: opts.system }, ...opts.messages]
      : opts.messages;
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: AbortSignal.timeout(90_000),
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
