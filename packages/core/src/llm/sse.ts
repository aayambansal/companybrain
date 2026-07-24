/**
 * Split a byte stream into SSE event lines, reassembling lines that arrive
 * split across network chunks. Shared by the streaming LLM providers.
 */
export async function* sseLines(body: ReadableStream<Uint8Array>): AsyncIterable<string> {
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

/**
 * Pure: parse one OpenAI chat-completions stream line into its text delta, or
 * null for a non-data line, a keep-alive, the `[DONE]` sentinel, or a frame
 * that carries no content (e.g. the initial role delta or a finish chunk).
 */
export function parseOpenAiDelta(line: string): string | null {
  if (!line.startsWith('data:')) return null;
  const data = line.slice(5).trim();
  if (!data || data === '[DONE]') return null;
  try {
    const parsed = JSON.parse(data) as { choices?: { delta?: { content?: string } }[] };
    return parsed.choices?.[0]?.delta?.content ?? null;
  } catch {
    return null;
  }
}

/**
 * Pure: parse one Ollama chat NDJSON line into its content chunk, or null for a
 * `done` marker, an empty chunk, or a non-json line. (Ollama streams raw JSON
 * objects, one per line, rather than SSE `data:` frames.)
 */
export function parseOllamaLine(line: string): string | null {
  try {
    const parsed = JSON.parse(line) as { message?: { content?: string } };
    return parsed.message?.content || null;
  } catch {
    return null;
  }
}
