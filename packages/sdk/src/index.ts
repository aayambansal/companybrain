/**
 * Official TypeScript SDK for CompanyBrain.
 *
 *   import { CompanyBrain } from '@companybrain/sdk';
 *   const cb = new CompanyBrain({ apiKey: process.env.COMPANYBRAIN_API_KEY });
 *   await cb.memories.add({ content: 'We ship on Thursdays.' });
 *   const { hits } = await cb.search({ q: 'when do we ship' });
 */
export * from './types.js';
import type {
  AddMemoryInput,
  ApiKey,
  ChatInput,
  ChatResponse,
  ConnectorInfo,
  Memory,
  PlaybookInput,
  PlaybookResponse,
  SearchInput,
  SearchResponse,
  Space,
  TopicGroup,
  TopicsInput,
} from './types.js';

export interface CompanyBrainOptions {
  /** Base URL of the API. Defaults to COMPANYBRAIN_API_URL or http://localhost:3333. */
  apiUrl?: string;
  /** API key (cb_...). Defaults to COMPANYBRAIN_API_KEY. */
  apiKey?: string;
  /** Extra headers merged into every request. */
  headers?: Record<string, string>;
  /** Custom fetch implementation (for tests / non-standard runtimes). */
  fetch?: typeof fetch;
}

export class CompanyBrainError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;
  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'CompanyBrainError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function envVar(name: string): string | undefined {
  return typeof process !== 'undefined' && process.env ? process.env[name] : undefined;
}

export class CompanyBrain {
  readonly apiUrl: string;
  private apiKey?: string;
  private headers: Record<string, string>;
  private fetchImpl: typeof fetch;

  readonly memories: MemoriesResource;
  readonly spaces: SpacesResource;
  readonly connections: ConnectionsResource;
  readonly apiKeys: ApiKeysResource;

  constructor(options: CompanyBrainOptions = {}) {
    this.apiUrl = (options.apiUrl ?? envVar('COMPANYBRAIN_API_URL') ?? 'http://localhost:3333').replace(/\/$/, '');
    this.apiKey = options.apiKey ?? envVar('COMPANYBRAIN_API_KEY');
    this.headers = options.headers ?? {};
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    if (!this.fetchImpl) {
      throw new Error('No fetch implementation available. Pass one via options.fetch.');
    }
    this.memories = new MemoriesResource(this);
    this.spaces = new SpacesResource(this);
    this.connections = new ConnectionsResource(this);
    this.apiKeys = new ApiKeysResource(this);
  }

  /** Low-level request helper. */
  async request<T>(method: string, path: string, opts: { query?: Record<string, unknown>; body?: unknown } = {}): Promise<T> {
    const url = new URL(this.apiUrl + path);
    if (opts.query) {
      for (const [k, v] of Object.entries(opts.query)) {
        if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
      }
    }
    const headers: Record<string, string> = { ...this.headers };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';

    const res = await this.fetchImpl(url.toString(), {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });

    const text = await res.text();
    const data = text ? safeJson(text) : undefined;
    if (!res.ok) {
      const err = (data ?? {}) as { error?: string; message?: string; issues?: unknown };
      throw new CompanyBrainError(err.message ?? err.error ?? `Request failed (${res.status})`, res.status, err.error, err.issues);
    }
    return data as T;
  }

  // Convenience top-level methods.
  search(input: SearchInput): Promise<SearchResponse> {
    return this.request<SearchResponse>('POST', '/v1/search', { body: input });
  }

  chat(input: ChatInput): Promise<ChatResponse> {
    return this.request<ChatResponse>('POST', '/v1/chat', { body: input });
  }

  /** Synthesize a cited playbook from the memories on a topic. */
  playbook(input: PlaybookInput): Promise<PlaybookResponse> {
    return this.request<PlaybookResponse>('POST', '/v1/playbooks', { body: input });
  }

  /** Group memories by tag to surface projects, people, and themes. */
  topics(opts: TopicsInput = {}): Promise<{ topics: TopicGroup[] }> {
    return this.request<{ topics: TopicGroup[] }>('GET', '/v1/topics', {
      query: opts as Record<string, unknown>,
    });
  }

  /** Stream a chat answer over SSE. Yields `{ event, data }` frames. */
  async *chatStream(input: ChatInput): AsyncGenerator<{ event: string; data: string }> {
    const url = this.apiUrl + '/v1/chat/stream';
    const headers: Record<string, string> = { ...this.headers, 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;
    const res = await this.fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(input) });
    if (!res.ok || !res.body) throw new CompanyBrainError(`chat stream failed (${res.status})`, res.status);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let event = 'message';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';
      for (const frame of frames) {
        event = 'message';
        let data = '';
        for (const line of frame.split('\n')) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          else if (line.startsWith('data:')) data += line.slice(5).trim();
        }
        if (data) yield { event, data };
      }
    }
  }

  status(): Promise<Record<string, unknown>> {
    return this.request('GET', '/v1/status');
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

class MemoriesResource {
  constructor(private cb: CompanyBrain) {}
  async add(input: AddMemoryInput): Promise<Memory> {
    const { memory } = await this.cb.request<{ memory: Memory }>('POST', '/v1/memories', { body: input });
    return memory;
  }
  async list(opts: { limit?: number; offset?: number; spaceId?: string; connector?: string } = {}): Promise<{ memories: Memory[]; total: number }> {
    return this.cb.request('GET', '/v1/memories', { query: opts });
  }
  async get(id: string): Promise<Memory> {
    const { memory } = await this.cb.request<{ memory: Memory }>('GET', `/v1/memories/${id}`);
    return memory;
  }
  async update(id: string, patch: Partial<AddMemoryInput> & { spaceId?: string }): Promise<Memory> {
    const { memory } = await this.cb.request<{ memory: Memory }>('PATCH', `/v1/memories/${id}`, { body: patch });
    return memory;
  }
  async delete(id: string): Promise<boolean> {
    const { deleted } = await this.cb.request<{ deleted: boolean }>('DELETE', `/v1/memories/${id}`);
    return deleted;
  }
}

class SpacesResource {
  constructor(private cb: CompanyBrain) {}
  async list(): Promise<Space[]> {
    const { spaces } = await this.cb.request<{ spaces: Space[] }>('GET', '/v1/spaces');
    return spaces;
  }
  async create(input: { name: string; slug?: string; description?: string; icon?: string; color?: string }): Promise<Space> {
    const { space } = await this.cb.request<{ space: Space }>('POST', '/v1/spaces', { body: input });
    return space;
  }
  async delete(id: string): Promise<boolean> {
    const { deleted } = await this.cb.request<{ deleted: boolean }>('DELETE', `/v1/spaces/${id}`);
    return deleted;
  }
}

class ConnectionsResource {
  constructor(private cb: CompanyBrain) {}
  available(): Promise<{ connectors: ConnectorInfo[] }> {
    return this.cb.request('GET', '/v1/connections/available');
  }
  list(): Promise<{ connections: unknown[] }> {
    return this.cb.request('GET', '/v1/connections');
  }
  create(input: { connector: string; name: string; spaceId?: string; config?: Record<string, unknown>; credentials?: Record<string, unknown> }): Promise<{ connection: unknown }> {
    return this.cb.request('POST', '/v1/connections', { body: input });
  }
  sync(id: string): Promise<{ started: boolean; syncRunId: string }> {
    return this.cb.request('POST', `/v1/connections/${id}/sync`);
  }
}

class ApiKeysResource {
  constructor(private cb: CompanyBrain) {}
  async list(): Promise<ApiKey[]> {
    const { keys } = await this.cb.request<{ keys: ApiKey[] }>('GET', '/v1/api-keys');
    return keys;
  }
  async create(name: string): Promise<ApiKey & { secret: string }> {
    const { key } = await this.cb.request<{ key: ApiKey & { secret: string } }>('POST', '/v1/api-keys', { body: { name } });
    return key;
  }
  async revoke(id: string): Promise<boolean> {
    const { revoked } = await this.cb.request<{ revoked: boolean }>('DELETE', `/v1/api-keys/${id}`);
    return revoked;
  }
}
