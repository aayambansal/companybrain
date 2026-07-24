/**
 * Tracks keys with a long-running background operation in progress so a second
 * start for the same key is rejected instead of running concurrently. Single
 * instance only (in-memory), which suits the self-host default; it just avoids
 * an expensive operation (e.g. a full reindex) overlapping itself.
 */
export class SingleFlight {
  private readonly active = new Set<string>();

  /** Mark the key active and return true, or return false if already active. */
  tryStart(key: string): boolean {
    if (this.active.has(key)) return false;
    this.active.add(key);
    return true;
  }

  /** Release the key so it can start again. */
  finish(key: string): void {
    this.active.delete(key);
  }

  isActive(key: string): boolean {
    return this.active.has(key);
  }
}
