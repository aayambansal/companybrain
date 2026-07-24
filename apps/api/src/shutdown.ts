/**
 * Graceful shutdown. On a termination signal, stop background work, let
 * in-flight requests drain, and close the database pool before exiting, with a
 * hard timeout so a stuck request can't block termination forever. Dependencies
 * are injected so the sequence is testable without real signals or a server.
 */
export interface ShutdownDeps {
  /** Stop the connector scheduler, if one is running. */
  stopScheduler: (() => void) | null;
  /** Stop accepting connections and wait for in-flight requests to finish. */
  closeServer: () => Promise<void>;
  /** Close the database pool. */
  closeEngine: () => Promise<void>;
  /** Terminate the process (injected so tests don't actually exit). */
  exit: (code: number) => void;
  log?: (message: string) => void;
  /** Force-exit deadline if the graceful close hangs. */
  forceMs?: number;
}

/**
 * Build a shutdown handler. The returned function is idempotent: a second
 * signal while shutting down is ignored.
 */
export function createShutdown(deps: ShutdownDeps): (signal: string) => Promise<void> {
  let shuttingDown = false;
  return async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    deps.log?.(`[api] ${signal} received, shutting down`);
    deps.stopScheduler?.();
    const force = setTimeout(() => deps.exit(1), deps.forceMs ?? 10_000);
    force.unref?.();
    try {
      await deps.closeServer();
      await deps.closeEngine();
    } catch (err) {
      deps.log?.(`[api] shutdown error: ${String(err)}`);
    }
    clearTimeout(force);
    deps.exit(0);
  };
}
