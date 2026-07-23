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

export interface ImageInput {
  /** Base64-encoded image bytes (no data-URL prefix). */
  base64: string;
  /** e.g. 'image/png', 'image/jpeg'. */
  mediaType: string;
}

export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  /** Whether this provider can actually generate (false for the `none` stub). */
  readonly available: boolean;
  complete(opts: CompleteOptions): Promise<string>;
  /** Optional token streaming; providers may fall back to a single chunk. */
  stream?(opts: CompleteOptions): AsyncIterable<string>;
  /** Whether this provider can read images (vision). */
  readonly supportsVision?: boolean;
  /** Extract text and a description from an image (OCR + caption). */
  describeImage?(image: ImageInput, prompt?: string): Promise<string>;
  /** Whether this provider can transcribe audio. */
  readonly supportsAudio?: boolean;
  /** Transcribe audio bytes to text. */
  transcribeAudio?(audio: ImageInput): Promise<string>;
}
