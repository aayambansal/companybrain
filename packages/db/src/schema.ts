/**
 * CompanyBrain database schema (Drizzle ORM, Postgres + pgvector).
 *
 * Tenancy: everything is scoped to an `organization`. A `space` is a named
 * collection of memories within an org. Documents belong to a space and are
 * split into retrievable `chunks` that carry both a vector embedding and a
 * full-text `tsvector`.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  jsonb,
  vector,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql, relations } from 'drizzle-orm';

/**
 * Embedding dimensionality. Must match the configured embedding provider.
 * 1536 matches OpenAI `text-embedding-3-small` and the bundled zero-config
 * local embedder. Changing this requires a migration + re-embedding.
 */
export const EMBEDDING_DIMENSIONS = 1536;

// ── Enums ────────────────────────────────────────────────────────────────
export const userRole = pgEnum('user_role', ['owner', 'admin', 'member', 'viewer']);
export const documentStatus = pgEnum('document_status', [
  'pending',
  'processing',
  'indexed',
  'failed',
]);
export const connectionStatus = pgEnum('connection_status', [
  'active',
  'paused',
  'error',
  'disconnected',
]);
export const syncStatus = pgEnum('sync_status', ['running', 'success', 'error', 'partial']);

// ── Organizations ────────────────────────────────────────────────────────
export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: varchar('slug', { length: 128 }).notNull(),
    settings: jsonb('settings').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex('organizations_slug_idx').on(t.slug),
  }),
);

// ── Users ────────────────────────────────────────────────────────────────
export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 320 }).notNull(),
    name: text('name'),
    passwordHash: text('password_hash'),
    avatarUrl: text('avatar_url'),
    role: userRole('role').default('member').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    emailIdx: uniqueIndex('users_email_idx').on(t.email),
    orgIdx: index('users_org_idx').on(t.orgId),
  }),
);

// ── API keys ─────────────────────────────────────────────────────────────
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    // We store only a hash of the key; the prefix is shown in the UI for identification.
    keyHash: text('key_hash').notNull(),
    prefix: varchar('prefix', { length: 16 }).notNull(),
    scopes: jsonb('scopes').$type<string[]>().default(['*']).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    hashIdx: uniqueIndex('api_keys_hash_idx').on(t.keyHash),
    orgIdx: index('api_keys_org_idx').on(t.orgId),
  }),
);

// ── Spaces ───────────────────────────────────────────────────────────────
export const spaces = pgTable(
  'spaces',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: varchar('slug', { length: 128 }).notNull(),
    description: text('description'),
    icon: varchar('icon', { length: 64 }),
    color: varchar('color', { length: 16 }),
    isDefault: boolean('is_default').default(false).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex('spaces_org_slug_idx').on(t.orgId, t.slug),
    orgIdx: index('spaces_org_idx').on(t.orgId),
  }),
);

// ── Connections (configured connector instances) ─────────────────────────
export const connections = pgTable(
  'connections',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    spaceId: uuid('space_id').references(() => spaces.id, { onDelete: 'set null' }),
    connector: varchar('connector', { length: 64 }).notNull(), // e.g. 'obsidian', 'slack'
    name: text('name').notNull(),
    config: jsonb('config').$type<Record<string, unknown>>().default({}).notNull(),
    // Credentials are encrypted at rest by the app layer before storage.
    credentials: jsonb('credentials').$type<Record<string, unknown>>().default({}).notNull(),
    status: connectionStatus('status').default('active').notNull(),
    cursor: text('cursor'), // opaque sync cursor for incremental syncs
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('connections_org_idx').on(t.orgId),
    connectorIdx: index('connections_connector_idx').on(t.connector),
  }),
);

// ── Documents ────────────────────────────────────────────────────────────
export const documents = pgTable(
  'documents',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    connectionId: uuid('connection_id').references(() => connections.id, {
      onDelete: 'set null',
    }),
    connector: varchar('connector', { length: 64 }).default('api').notNull(),
    sourceType: varchar('source_type', { length: 64 }), // 'markdown', 'pdf', 'slack_message', ...
    sourceId: text('source_id'), // stable id in the source system (for dedupe/upsert)
    sourceUrl: text('source_url'),
    title: text('title'),
    content: text('content'), // normalized full text
    summary: text('summary'),
    contentHash: varchar('content_hash', { length: 64 }), // for change detection
    tags: jsonb('tags').$type<string[]>().default([]).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    status: documentStatus('status').default('pending').notNull(),
    error: text('error'),
    tokenCount: integer('token_count'),
    sourceCreatedAt: timestamp('source_created_at', { withTimezone: true }),
    sourceUpdatedAt: timestamp('source_updated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('documents_org_idx').on(t.orgId),
    spaceIdx: index('documents_space_idx').on(t.spaceId),
    statusIdx: index('documents_status_idx').on(t.status),
    // Dedupe/upsert key per connection + source id.
    sourceIdx: uniqueIndex('documents_source_idx').on(t.connectionId, t.sourceId),
    connectorIdx: index('documents_connector_idx').on(t.connector),
  }),
);

// ── Chunks (retrievable passages) ────────────────────────────────────────
export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    chunkIndex: integer('chunk_index').notNull(),
    content: text('content').notNull(),
    tokenCount: integer('token_count'),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    // NOTE: a generated `tsv tsvector` column + its GIN index, and the HNSW
    // vector index, are added via raw SQL in migrations (Drizzle can't express
    // generated tsvector columns / vector index opclasses natively yet).
  },
  (t) => ({
    docIdx: index('chunks_document_idx').on(t.documentId),
    spaceIdx: index('chunks_space_idx').on(t.spaceId),
    orgIdx: index('chunks_org_idx').on(t.orgId),
    docChunkIdx: uniqueIndex('chunks_doc_chunk_idx').on(t.documentId, t.chunkIndex),
  }),
);

// ── Sync runs (connector sync history) ───────────────────────────────────
export const syncRuns = pgTable(
  'sync_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    connectionId: uuid('connection_id')
      .notNull()
      .references(() => connections.id, { onDelete: 'cascade' }),
    status: syncStatus('status').default('running').notNull(),
    stats: jsonb('stats')
      .$type<{ documents?: number; chunks?: number; skipped?: number; failed?: number }>()
      .default({})
      .notNull(),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => ({
    connIdx: index('sync_runs_connection_idx').on(t.connectionId),
  }),
);

// ── Chat sessions & messages (RAG chat history) ──────────────────────────
export const chatSessions = pgTable(
  'chat_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    spaceId: uuid('space_id').references(() => spaces.id, { onDelete: 'set null' }),
    title: text('title'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('chat_sessions_org_idx').on(t.orgId),
  }),
);

// ── Webhooks (outbound events) ───────────────────────────────────────────
export const webhooks = pgTable(
  'webhooks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    secret: text('secret'),
    events: jsonb('events').$type<string[]>().default(['memory.created']).notNull(),
    active: boolean('active').default(true).notNull(),
    lastStatus: integer('last_status'),
    lastDeliveredAt: timestamp('last_delivered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index('webhooks_org_idx').on(t.orgId),
  }),
);

export const chatMessages = pgTable(
  'chat_messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => chatSessions.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 16 }).notNull(), // 'user' | 'assistant' | 'system'
    content: text('content').notNull(),
    citations: jsonb('citations').$type<unknown[]>().default([]).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    sessionIdx: index('chat_messages_session_idx').on(t.sessionId),
  }),
);

// ── Relations ────────────────────────────────────────────────────────────
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  spaces: many(spaces),
  apiKeys: many(apiKeys),
  connections: many(connections),
  documents: many(documents),
}));

export const spacesRelations = relations(spaces, ({ one, many }) => ({
  organization: one(organizations, { fields: [spaces.orgId], references: [organizations.id] }),
  documents: many(documents),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  organization: one(organizations, { fields: [documents.orgId], references: [organizations.id] }),
  space: one(spaces, { fields: [documents.spaceId], references: [spaces.id] }),
  connection: one(connections, {
    fields: [documents.connectionId],
    references: [connections.id],
  }),
  chunks: many(chunks),
}));

export const chunksRelations = relations(chunks, ({ one }) => ({
  document: one(documents, { fields: [chunks.documentId], references: [documents.id] }),
  space: one(spaces, { fields: [chunks.spaceId], references: [spaces.id] }),
}));

export const connectionsRelations = relations(connections, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [connections.orgId],
    references: [organizations.id],
  }),
  space: one(spaces, { fields: [connections.spaceId], references: [spaces.id] }),
  syncRuns: many(syncRuns),
  documents: many(documents),
}));

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [chatSessions.orgId],
    references: [organizations.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, { fields: [chatMessages.sessionId], references: [chatSessions.id] }),
}));

// ── Convenience marker to keep `sql`/`primaryKey` imports used across builds ─
export const __schemaVersion = sql`1`;
export { primaryKey };

// ── Inferred types ───────────────────────────────────────────────────────
export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type Space = typeof spaces.$inferSelect;
export type NewSpace = typeof spaces.$inferInsert;
export type Connection = typeof connections.$inferSelect;
export type NewConnection = typeof connections.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
export type SyncRun = typeof syncRuns.$inferSelect;
export type NewSyncRun = typeof syncRuns.$inferInsert;
export type ChatSession = typeof chatSessions.$inferSelect;
export type NewChatSession = typeof chatSessions.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type NewChatMessage = typeof chatMessages.$inferInsert;
export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
