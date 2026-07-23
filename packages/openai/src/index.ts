/**
 * OpenAI function-calling tools for CompanyBrain. Works with the OpenAI Agents
 * SDK, the Assistants API, and raw chat-completions function calling.
 *
 *   import OpenAI from 'openai';
 *   import { CompanyBrain } from '@companybrain/sdk';
 *   import { companyBrainOpenAITools, runCompanyBrainTool } from '@companybrain/openai';
 *
 *   const cb = new CompanyBrain({ apiKey: process.env.COMPANYBRAIN_API_KEY });
 *   const openai = new OpenAI();
 *   const res = await openai.chat.completions.create({
 *     model: 'gpt-4o',
 *     tools: companyBrainOpenAITools(),
 *     messages: [{ role: 'user', content: 'What did we decide about releases?' }],
 *   });
 *   // then, for each tool_call:
 *   const output = await runCompanyBrainTool(cb, call.function.name, JSON.parse(call.function.arguments));
 */
import type { CompanyBrain } from '@companybrain/sdk';

export interface OpenAIFunctionTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** The tool definitions to pass as `tools` in an OpenAI request. */
export function companyBrainOpenAITools(): OpenAIFunctionTool[] {
  return [
    {
      type: 'function',
      function: {
        name: 'search_memory',
        description: 'Search the company knowledge base for passages relevant to a query. Returns ranked snippets with sources.',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'What to search for' },
            limit: { type: 'integer', description: 'Number of passages (default 6)' },
            space: { type: 'string', description: 'Optional space slug to scope to' },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'ask_memory',
        description: 'Ask the company knowledge base a question and get a grounded answer with citations.',
        parameters: {
          type: 'object',
          properties: {
            question: { type: 'string', description: 'The question to answer from memory' },
            space: { type: 'string' },
          },
          required: ['question'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'add_memory',
        description: 'Store a new fact, decision, or note in the company knowledge base.',
        parameters: {
          type: 'object',
          properties: {
            content: { type: 'string', description: 'The text to remember' },
            title: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            space: { type: 'string' },
          },
          required: ['content'],
        },
      },
    },
  ];
}

/** The tool names this package handles. */
export const COMPANYBRAIN_TOOL_NAMES = ['search_memory', 'ask_memory', 'add_memory'] as const;

/** Execute one CompanyBrain tool call and return a JSON-serializable result. */
export async function runCompanyBrainTool(
  client: CompanyBrain,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'search_memory': {
      const { hits } = await client.search({
        q: String(args.query ?? ''),
        limit: typeof args.limit === 'number' ? args.limit : 6,
        space: args.space ? String(args.space) : undefined,
        mode: 'hybrid',
      });
      return hits.map((h) => ({ title: h.document.title, content: h.content, score: Number(h.score.toFixed(3)), source: h.document.sourceUrl }));
    }
    case 'ask_memory': {
      const res = await client.chat({ message: String(args.question ?? ''), space: args.space ? String(args.space) : undefined });
      return { answer: res.message, citations: res.citations.map((c) => ({ title: c.title, source: c.sourceUrl })) };
    }
    case 'add_memory': {
      const memory = await client.memories.add({
        content: String(args.content ?? ''),
        title: args.title ? String(args.title) : undefined,
        tags: Array.isArray(args.tags) ? args.tags.map(String) : undefined,
        space: args.space ? String(args.space) : undefined,
      });
      return { id: memory.id, status: memory.status };
    }
    default:
      throw new Error(`Unknown CompanyBrain tool: ${name}`);
  }
}
