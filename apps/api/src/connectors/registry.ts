import type { MemoryEngine, Connector } from '@companybrain/core';
import type { Connection, SyncRun } from '@companybrain/db';

/** A function that syncs one connection, updating the sync run + connection state. */
export type ConnectorRunner = (
  engine: MemoryEngine,
  connection: Connection,
  syncRun: SyncRun,
) => Promise<void>;

export interface ConnectorInfo {
  id: string;
  displayName: string;
  description: string;
  category?: string;
  auth?: string;
  configSchema: unknown[];
}

/**
 * A registry the `@companybrain/connectors` package populates at startup. Keeping
 * it here as a seam avoids a hard dependency from the API onto every connector.
 */
class ConnectorRegistry {
  private connectors = new Map<string, Connector>();
  private runner: ConnectorRunner | null = null;

  register(connector: Connector): void {
    this.connectors.set(connector.id, connector);
  }

  registerRunner(runner: ConnectorRunner): void {
    this.runner = runner;
  }

  get(id: string): Connector | undefined {
    return this.connectors.get(id);
  }

  getRunner(): ConnectorRunner | null {
    return this.runner;
  }

  list(): ConnectorInfo[] {
    return Array.from(this.connectors.values()).map((c) => ({
      id: c.id,
      displayName: c.displayName,
      description: c.description,
      category: c.category,
      auth: c.auth,
      configSchema: c.configSchema,
    }));
  }
}

const registry = new ConnectorRegistry();

export function getConnectorRegistry(): ConnectorRegistry {
  return registry;
}
