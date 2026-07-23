/**
 * Background organization. Every memory is enriched on ingest with topical tags,
 * and meeting/chat connectors add people as tags; grouping memories by those
 * tags surfaces the projects, people, and themes running through the brain
 * without anyone filing anything. This is the pure shaping layer over the
 * aggregate query.
 */

export interface Topic {
  /** The tag the memories share. */
  topic: string;
  /** How many memories carry it. */
  count: number;
  /** A few representative memories, newest first. */
  sample: { id: string; title: string | null }[];
}

/** A raw aggregate row: a tag, its count, and parallel sample id/title arrays. */
export interface TopicRow {
  tag: string;
  count: number;
  sample_ids: string[] | null;
  sample_titles: string[] | null;
}

/** Pure: zip the parallel sample arrays into one topic object. */
export function buildTopic(row: TopicRow): Topic {
  const ids = row.sample_ids ?? [];
  const titles = row.sample_titles ?? [];
  const sample = ids.map((id, i) => ({
    id,
    title: (titles[i] ?? '').trim() || null,
  }));
  return { topic: row.tag, count: Number(row.count) || 0, sample };
}

/** Pure: map + drop noise (empty tags, single-use tags when asked). */
export function buildTopics(rows: TopicRow[], opts: { minCount?: number } = {}): Topic[] {
  const min = opts.minCount ?? 1;
  return rows
    .filter((r) => r.tag && r.tag.trim().length > 0 && (Number(r.count) || 0) >= min)
    .map(buildTopic);
}
