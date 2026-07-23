import type { EmbeddingProvider } from './types.js';

/**
 * Ollama embeddings (fully local models). Dimensionality depends on the model;
 * `nomic-embed-text` is 768 and gets zero-padded to the storage dimension.
 */
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'ollama';
  readonly model: string;
  readonly dimensions: number;
  private baseUrl: string;

  constructor(opts: { model?: string; baseUrl?: string; dimensions?: number }) {
    this.model = opts.model ?? 'nomic-embed-text';
    this.baseUrl = opts.baseUrl ?? 'http://localhost:11434';
    this.dimensions = opts.dimensions ?? 768;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const out: number[][] = [];
    // Ollama's /api/embeddings takes a single prompt; batch client-side.
    for (const text of texts) {
      const res = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        signal: AbortSignal.timeout(60_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, prompt: text }),
      });
      if (!res.ok) {
        throw new Error(`Ollama embeddings failed: ${res.status} ${await res.text()}`);
      }
      const json = (await res.json()) as { embedding: number[] };
      out.push(json.embedding);
    }
    return out;
  }

  async embedQuery(text: string): Promise<number[]> {
    const [v] = await this.embed([text]);
    return v ?? [];
  }
}
