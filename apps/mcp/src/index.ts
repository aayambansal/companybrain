#!/usr/bin/env node
/**
 * CompanyBrain MCP server.
 *
 * Exposes the company brain over the Model Context Protocol (stdio transport)
 * so Claude Desktop, Cursor, and other MCP clients can search, write, and ask
 * questions against it.
 *
 * Config (env):
 *   COMPANYBRAIN_API_URL  base URL of the API (default http://localhost:3333)
 *   COMPANYBRAIN_API_KEY  API key (cb_...). Required to make calls; if unset the
 *                         server still starts and every tool returns a clear error.
 *
 * stdout is the MCP channel — all diagnostics go to stderr.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { CompanyBrain, CompanyBrainError } from '@companybrain/sdk';
import type { Citation, SearchHit, Space } from '@companybrain/sdk';
import { z } from 'zod';

const API_URL = process.env.COMPANYBRAIN_API_URL ?? 'http://localhost:3333';
const API_KEY = process.env.COMPANYBRAIN_API_KEY;

const client = new CompanyBrain({ apiUrl: API_URL, apiKey: API_KEY });

function log(...args: unknown[]): void {
  console.error('[companybrain-mcp]', ...args);
}

function textResult(text: string, structuredContent?: Record<string, unknown>): CallToolResult {
  return { content: [{ type: 'text', text }], ...(structuredContent ? { structuredContent } : {}) };
}

function errorResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true };
}

/** Runs a tool body, turning SDK failures into tool errors. */
async function run(fn: () => Promise<CallToolResult>): Promise<CallToolResult> {
  // No key required: CompanyBrain in single-user mode (the default self-host)
  // accepts requests with no auth. A key is only needed in multi-user mode,
  // where a missing/invalid key surfaces below as a clean 401 tool error.
  try {
    return await fn();
  } catch (err) {
    if (err instanceof CompanyBrainError) {
      log('CompanyBrainError', err.status, err.message);
      return errorResult(`CompanyBrain API error (${err.status}): ${err.message}`);
    }
    log('Unexpected error', err);
    return errorResult(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
  }
}

function truncate(text: string, max = 280): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max)}…` : clean;
}

function formatHit(hit: SearchHit, i: number): string {
  const title = hit.document.title ?? 'Untitled';
  const lines = [`${i + 1}. ${title}  (score ${hit.score.toFixed(3)})`, `   ${truncate(hit.content)}`];
  if (hit.document.sourceUrl) lines.push(`   ${hit.document.sourceUrl}`);
  return lines.join('\n');
}

const server = new McpServer(
  { name: 'companybrain', version: '0.1.0' },
  { instructions: 'Search, write, and ask questions against your CompanyBrain memory layer.' },
);

server.registerTool(
  'search_memory',
  {
    title: 'Search memory',
    description:
      'Search the company brain and return the most relevant memories. Use for recall of facts, docs, and past context.',
    inputSchema: {
      query: z.string().describe('Natural-language search query.'),
      mode: z.enum(['hybrid', 'semantic', 'keyword']).optional().describe('Retrieval mode. Defaults to hybrid.'),
      limit: z.number().int().positive().max(50).optional().describe('Max hits to return (default 10).'),
      space: z.string().optional().describe('Restrict to a space (id or slug).'),
    },
  },
  ({ query, mode, limit, space }) =>
    run(async () => {
      const res = await client.search({ q: query, mode, limit, space });
      if (res.hits.length === 0) {
        return textResult(`No results for "${query}".`, { query, mode: res.mode, hits: [] });
      }
      const body = res.hits.map(formatHit).join('\n\n');
      const text = `${res.hits.length} result(s) for "${query}" (${res.mode}, ${res.tookMs}ms):\n\n${body}`;
      const hits = res.hits.map((h) => ({
        title: h.document.title,
        score: h.score,
        snippet: truncate(h.content),
        sourceUrl: h.document.sourceUrl,
        documentId: h.documentId,
        chunkId: h.chunkId,
      }));
      return textResult(text, { query, mode: res.mode, hits });
    }),
);

server.registerTool(
  'add_memory',
  {
    title: 'Add memory',
    description: 'Write a new memory into the company brain so it can be recalled later.',
    inputSchema: {
      content: z.string().describe('The text to remember.'),
      title: z.string().optional().describe('Optional title.'),
      space: z.string().optional().describe('Space to file it under (id or slug).'),
      tags: z.array(z.string()).optional().describe('Optional tags.'),
      sourceUrl: z.string().optional().describe('Optional source URL.'),
    },
  },
  ({ content, title, space, tags, sourceUrl }) =>
    run(async () => {
      const memory = await client.memories.add({ content, title, space, tags, sourceUrl });
      return textResult(`Added memory ${memory.id} (status: ${memory.status}).`, {
        id: memory.id,
        status: memory.status,
        spaceId: memory.spaceId,
      });
    }),
);

server.registerTool(
  'ask_memory',
  {
    title: 'Ask memory',
    description: 'Ask a question and get a RAG answer grounded in the company brain, with cited sources.',
    inputSchema: {
      question: z.string().describe('The question to answer from memory.'),
      space: z.string().optional().describe('Restrict retrieval to a space (id or slug).'),
    },
  },
  ({ question, space }) =>
    run(async () => {
      const res = await client.chat({ message: question, space });
      let text = res.message;
      if (res.citations.length > 0) {
        const sources = res.citations
          .map((c: Citation) => `[${c.index}] ${c.title ?? 'Untitled'}${c.sourceUrl ? ` — ${c.sourceUrl}` : ''}`)
          .join('\n');
        text += `\n\nSources:\n${sources}`;
      }
      return textResult(text, { answer: res.message, citations: res.citations });
    }),
);

server.registerTool(
  'list_spaces',
  {
    title: 'List spaces',
    description: 'List the spaces (memory partitions) available in the company brain.',
    inputSchema: {},
  },
  () =>
    run(async () => {
      const spaces = await client.spaces.list();
      if (spaces.length === 0) return textResult('No spaces found.', { spaces: [] });
      const text = spaces
        .map((s: Space) => `- ${s.name} (${s.slug})${s.isDefault ? ' [default]' : ''}${s.description ? ` — ${s.description}` : ''}`)
        .join('\n');
      return textResult(`Spaces:\n${text}`, { spaces });
    }),
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log(`ready. API ${API_URL}${API_KEY ? ' (authed)' : ' (no key: works in single-user mode)'}`);
}

main().catch((err) => {
  log('fatal', err);
  process.exit(1);
});
