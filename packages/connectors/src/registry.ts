import type { Connector } from '@companybrain/core';
import { connectors } from './connectors/index.js';
import { runConnectorSync, type RunConnectorSync } from './runner.js';

/**
 * Minimal registry surface the host (e.g. the API) implements. The connectors
 * package never imports from apps; instead the host passes in something that
 * satisfies this interface and calls `registerAll`.
 */
export interface ConnectorRegistry {
  register(connector: Connector): void;
  registerRunner(runner: RunConnectorSync): void;
}

/** Register every built-in connector plus the sync runner. */
export function registerAll(registry: ConnectorRegistry): void {
  for (const connector of connectors) registry.register(connector);
  registry.registerRunner(runConnectorSync);
}
