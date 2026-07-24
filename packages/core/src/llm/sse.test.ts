import { describe, it, expect } from 'vitest';
import { sseLines, parseOpenAiDelta, parseOllamaLine } from './sse.js';

/** A ReadableStream that emits the given string chunks as UTF-8 bytes. */
function streamOf(chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(enc.encode(chunks[i++]!));
      else controller.close();
    },
  });
}

describe('parseOpenAiDelta', () => {
  it('extracts the content delta from a data line', () => {
    expect(parseOpenAiDelta('data: {"choices":[{"delta":{"content":"Hello"}}]}')).toBe('Hello');
  });

  it('returns null for [DONE], non-data lines, and content-less frames', () => {
    expect(parseOpenAiDelta('data: [DONE]')).toBeNull();
    expect(parseOpenAiDelta(': keep-alive')).toBeNull();
    expect(parseOpenAiDelta('data: {"choices":[{"delta":{"role":"assistant"}}]}')).toBeNull();
    expect(parseOpenAiDelta('data: not json')).toBeNull();
  });
});

describe('parseOllamaLine', () => {
  it('extracts the content chunk from an Ollama NDJSON line', () => {
    expect(parseOllamaLine('{"message":{"content":"Hi"},"done":false}')).toBe('Hi');
  });

  it('returns null for a done marker, empty content, or non-json', () => {
    expect(parseOllamaLine('{"done":true}')).toBeNull();
    expect(parseOllamaLine('{"message":{"content":""}}')).toBeNull();
    expect(parseOllamaLine('not json')).toBeNull();
  });
});

describe('sseLines', () => {
  it('yields trimmed non-empty lines', async () => {
    const out: string[] = [];
    for await (const line of sseLines(streamOf(['data: a\n\ndata: b\n']))) out.push(line);
    expect(out).toEqual(['data: a', 'data: b']);
  });

  it('reassembles a line split across two chunks', async () => {
    const out: string[] = [];
    for await (const line of sseLines(streamOf(['data: hel', 'lo\n']))) out.push(line);
    expect(out).toEqual(['data: hello']);
  });

  it('flushes a trailing line with no final newline', async () => {
    const out: string[] = [];
    for await (const line of sseLines(streamOf(['data: last']))) out.push(line);
    expect(out).toEqual(['data: last']);
  });
});
