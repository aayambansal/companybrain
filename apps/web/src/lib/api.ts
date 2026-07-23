'use client';

/**
 * Browser API client for the dashboard. Talks to the CompanyBrain API directly
 * with cookie credentials (the API sets an httpOnly `cb_session` cookie on
 * login/register and allows the dashboard origin with credentials).
 */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(API_URL + path, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? safeJson(text) : undefined;
  if (!res.ok) {
    const e = (data ?? {}) as { error?: string; message?: string };
    throw new ApiError(e.message ?? e.error ?? `Request failed (${res.status})`, res.status, e.error);
  }
  return data as T;
}

function safeJson(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

export const api = {
  get: <T,>(p: string) => request<T>('GET', p),
  post: <T,>(p: string, b?: unknown) => request<T>('POST', p, b),
  patch: <T,>(p: string, b?: unknown) => request<T>('PATCH', p, b),
  del: <T,>(p: string) => request<T>('DELETE', p),
};

// ── Types (mirror the API) ─────────────────────────────────────────────────
export interface Me {
  org: { id: string; name: string; slug: string } | null;
  user: { id: string; email: string; name: string | null; role: string; avatarUrl: string | null } | null;
  via: string;
}
export interface Memory {
  id: string;
  spaceId: string;
  title: string | null;
  content: string | null;
  summary: string | null;
  connector: string;
  sourceType: string | null;
  sourceUrl: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  status: 'pending' | 'processing' | 'indexed' | 'failed';
  createdAt: string;
  updatedAt: string;
}
export interface SearchHit {
  chunkId: string;
  documentId: string;
  score: number;
  scores: { vector?: number; keyword?: number; fused: number };
  content: string;
  chunkIndex: number;
  document: { id: string; title: string | null; sourceUrl: string | null; connector: string; tags: string[] };
}
export interface SearchResponse {
  query: string;
  mode: string;
  hits: SearchHit[];
  tookMs: number;
}
export interface Space {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  isDefault: boolean;
  documentCount?: number;
  createdAt: string;
}
export interface Citation {
  index: number;
  chunkId: string;
  documentId: string;
  title: string | null;
  sourceUrl: string | null;
  snippet: string;
}
export interface Status {
  name: string;
  version: string;
  embedding: { provider: string; model: string };
  llm: { provider: string; model: string; available: boolean };
  org?: string;
  counts?: { documents: number; chunks: number; spaces: number };
}
export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}
