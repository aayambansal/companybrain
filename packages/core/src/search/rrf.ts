/**
 * Reciprocal Rank Fusion. Combines several ranked lists into one, rewarding
 * items that rank highly across lists without needing score calibration.
 *
 *   score(item) = sum_over_lists( weight_l / (k + rank_l(item)) )
 */
export interface RankedList<T> {
  items: T[];
  weight?: number;
}

export function reciprocalRankFusion<T>(
  lists: RankedList<T>[],
  key: (item: T) => string,
  k = 60,
): { item: T; score: number; components: Record<number, number> }[] {
  const scores = new Map<string, { item: T; score: number; components: Record<number, number> }>();

  lists.forEach((list, listIdx) => {
    const weight = list.weight ?? 1;
    list.items.forEach((item, rank) => {
      const id = key(item);
      const contribution = weight / (k + rank + 1);
      const existing = scores.get(id);
      if (existing) {
        existing.score += contribution;
        existing.components[listIdx] = contribution;
      } else {
        scores.set(id, { item, score: contribution, components: { [listIdx]: contribution } });
      }
    });
  });

  return Array.from(scores.values()).sort((a, b) => b.score - a.score);
}
