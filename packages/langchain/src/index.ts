/**
 * LangChain retriever backed by CompanyBrain hybrid search.
 *
 *   import { CompanyBrain } from '@companybrain/sdk';
 *   import { CompanyBrainRetriever } from '@companybrain/langchain';
 *
 *   const retriever = new CompanyBrainRetriever({
 *     client: new CompanyBrain({ apiKey: process.env.COMPANYBRAIN_API_KEY }),
 *     k: 6,
 *   });
 *   const docs = await retriever.invoke('how do we release?');
 */
import { BaseRetriever, type BaseRetrieverInput } from '@langchain/core/retrievers';
import { Document } from '@langchain/core/documents';
import type { CompanyBrain, SearchMode } from '@companybrain/sdk';

export interface CompanyBrainRetrieverFields extends BaseRetrieverInput {
  client: CompanyBrain;
  /** Number of passages to return. Default 6. */
  k?: number;
  /** Restrict to a space (slug). */
  space?: string;
  /** Search mode. Default 'hybrid'. */
  mode?: SearchMode;
  /** Reorder with the server's LLM. */
  rerank?: boolean;
}

export class CompanyBrainRetriever extends BaseRetriever {
  lc_namespace = ['companybrain', 'retrievers'];
  private client: CompanyBrain;
  private k: number;
  private space?: string;
  private mode: SearchMode;
  private rerank?: boolean;

  constructor(fields: CompanyBrainRetrieverFields) {
    super(fields);
    this.client = fields.client;
    this.k = fields.k ?? 6;
    this.space = fields.space;
    this.mode = fields.mode ?? 'hybrid';
    this.rerank = fields.rerank;
  }

  override async _getRelevantDocuments(query: string): Promise<Document[]> {
    const { hits } = await this.client.search({
      q: query,
      limit: this.k,
      space: this.space,
      mode: this.mode,
      rerank: this.rerank,
    });
    return hits.map(
      (h) =>
        new Document({
          pageContent: h.content,
          metadata: {
            documentId: h.documentId,
            chunkId: h.chunkId,
            score: h.score,
            title: h.document.title,
            source: h.document.sourceUrl,
            connector: h.document.connector,
          },
        }),
    );
  }
}
