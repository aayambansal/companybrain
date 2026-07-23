export interface EmbeddingProvider {
  readonly name: string;
  readonly model: string;
  /** Native dimensionality of the model output (before storage padding). */
  readonly dimensions: number;
  /** Embed a batch of documents. */
  embed(texts: string[]): Promise<number[][]>;
  /** Embed a single query (may use a query-specific prompt/prefix). */
  embedQuery(text: string): Promise<number[]>;
}
