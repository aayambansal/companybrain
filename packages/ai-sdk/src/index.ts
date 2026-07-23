/**
 * Vercel AI SDK tools for CompanyBrain. Give any AI SDK agent memory it can
 * search, write, and ask.
 *
 *   import { generateText } from 'ai';
 *   import { openai } from '@ai-sdk/openai';
 *   import { CompanyBrain } from '@companybrain/sdk';
 *   import { companyBrainTools } from '@companybrain/ai-sdk';
 *
 *   const cb = new CompanyBrain({ apiKey: process.env.COMPANYBRAIN_API_KEY });
 *   const { text } = await generateText({
 *     model: openai('gpt-4o'),
 *     tools: companyBrainTools(cb),
 *     maxSteps: 5,
 *     prompt: 'What did we decide about the release process?',
 *   });
 */
import { tool } from 'ai';
import { z } from 'zod';
import type { CompanyBrain } from '@companybrain/sdk';

export interface CompanyBrainToolsOptions {
  /** Default space (slug) to scope tools to. */
  space?: string;
}

export function companyBrainTools(client: CompanyBrain, options: CompanyBrainToolsOptions = {}) {
  return {
    searchMemory: tool({
      description:
        'Search the company knowledge base (documents, notes, chats, docs) for passages relevant to a query. Use this to ground answers in what the company already knows.',
      parameters: z.object({
        query: z.string().describe('What to search for'),
        limit: z.number().int().min(1).max(20).optional().describe('How many passages to return'),
      }),
      execute: async ({ query, limit }) => {
        const { hits } = await client.search({ q: query, limit: limit ?? 6, space: options.space, mode: 'hybrid' });
        return hits.map((h) => ({
          title: h.document.title,
          content: h.content,
          score: Number(h.score.toFixed(3)),
          source: h.document.sourceUrl,
          documentId: h.documentId,
        }));
      },
    }),

    askMemory: tool({
      description: 'Ask the company knowledge base a question and get a grounded answer with citations.',
      parameters: z.object({ question: z.string().describe('The question to answer from company memory') }),
      execute: async ({ question }) => {
        const res = await client.chat({ message: question, space: options.space });
        return {
          answer: res.message,
          citations: res.citations.map((c) => ({ title: c.title, source: c.sourceUrl })),
        };
      },
    }),

    addMemory: tool({
      description: 'Store a new fact, decision, or note in the company knowledge base so it can be recalled later.',
      parameters: z.object({
        content: z.string().describe('The text to remember'),
        title: z.string().optional(),
        tags: z.array(z.string()).optional(),
      }),
      execute: async ({ content, title, tags }) => {
        const memory = await client.memories.add({ content, title, tags, space: options.space });
        return { id: memory.id, status: memory.status };
      },
    }),
  };
}
