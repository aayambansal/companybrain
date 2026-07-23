import type { EmbeddingProvider } from './types.js';

const MODEL_DIMS: Record<string, number> = {
  'text-embedding-3-small': 1536,
  'text-embedding-3-large': 3072,
  'text-embedding-ada-002': 1536,
};

/** OpenAI embeddings via the REST API (no SDK dependency). */
export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'openai';
  readonly model: string;
  readonly dimensions: number;
  private apiKey: string;
  private baseUrl: string;

  /** Whether this model supports the `dimensions` param (text-embedding-3-*). */
  private readonly supportsDimensions: boolean;

  constructor(opts: { apiKey: string; model?: string; baseUrl?: string; dimensions?: number }) {
    if (!opts.apiKey)
      throw new Error('OPENAI_API_KEY is required for the openai embedding provider.');
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? 'text-embedding-3-small';
    this.supportsDimensions = this.model.startsWith('text-embedding-3');
    // text-embedding-3-* can emit a shortened (Matryoshka) vector via `dimensions`,
    // so a larger, more accurate model can still fit the fixed storage width.
    const native = MODEL_DIMS[this.model] ?? 1536;
    this.dimensions = this.supportsDimensions ? (opts.dimensions ?? native) : native;
    this.baseUrl = opts.baseUrl ?? 'https://api.openai.com/v1';
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const body: Record<string, unknown> = { model: this.model, input: texts };
    // Request the reduced width directly (a proper re-normalized reduction), rather
    // than truncating a 3072-d vector down to storage width after the fact.
    if (this.supportsDimensions) body.dimensions = this.dimensions;
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`OpenAI embeddings failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { data: { embedding: number[]; index: number }[] };
    return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  }

  async embedQuery(text: string): Promise<number[]> {
    const [v] = await this.embed([text]);
    return v ?? [];
  }
}
