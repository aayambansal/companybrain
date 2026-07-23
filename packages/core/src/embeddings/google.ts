import type { EmbeddingProvider } from './types.js';

/** Google Generative AI embeddings (text-embedding-004, 768 dims). */
export class GoogleEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'google';
  readonly model: string;
  readonly dimensions = 768;
  private apiKey: string;

  constructor(opts: { apiKey: string; model?: string }) {
    if (!opts.apiKey) throw new Error('GOOGLE_API_KEY is required for the google embedding provider.');
    this.apiKey = opts.apiKey;
    this.model = opts.model ?? 'text-embedding-004';
  }

  async embed(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    for (const text of texts) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:embedContent?key=${this.apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        signal: AbortSignal.timeout(30_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${this.model}`,
          content: { parts: [{ text }] },
        }),
      });
      if (!res.ok) {
        throw new Error(`Google embeddings failed: ${res.status} ${await res.text()}`);
      }
      const json = (await res.json()) as { embedding: { values: number[] } };
      out.push(json.embedding.values);
    }
    return out;
  }

  async embedQuery(text: string): Promise<number[]> {
    const [v] = await this.embed([text]);
    return v ?? [];
  }
}
