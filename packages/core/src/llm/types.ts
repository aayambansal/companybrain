export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompleteOptions {
  system?: string;
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  /** Whether this provider can actually generate (false for the `none` stub). */
  readonly available: boolean;
  complete(opts: CompleteOptions): Promise<string>;
  /** Optional token streaming; providers may fall back to a single chunk. */
  stream?(opts: CompleteOptions): AsyncIterable<string>;
}
