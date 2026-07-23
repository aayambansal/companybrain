import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_API_URL = 'http://localhost:3333';

export type ConfigSource = 'env' | 'config file' | 'default' | 'unset';

export interface FileConfig {
  apiUrl?: string;
  apiKey?: string;
}

export interface ResolvedConfig {
  apiUrl: string;
  apiKey?: string;
  sources: {
    apiUrl: ConfigSource;
    apiKey: ConfigSource;
  };
}

export function configDir(): string {
  return join(homedir(), '.companybrain');
}

export function configPath(): string {
  return join(configDir(), 'config.json');
}

export function readFileConfig(): FileConfig {
  try {
    const raw = readFileSync(configPath(), 'utf8');
    const parsed = JSON.parse(raw) as FileConfig;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/** Resolve config with precedence: env > config file > defaults. */
export function resolveConfig(): ResolvedConfig {
  const file = readFileConfig();
  const envUrl = process.env.COMPANYBRAIN_API_URL;
  const envKey = process.env.COMPANYBRAIN_API_KEY;

  let apiUrl = DEFAULT_API_URL;
  let apiUrlSource: ConfigSource = 'default';
  if (file.apiUrl) {
    apiUrl = file.apiUrl;
    apiUrlSource = 'config file';
  }
  if (envUrl) {
    apiUrl = envUrl;
    apiUrlSource = 'env';
  }

  let apiKey: string | undefined;
  let apiKeySource: ConfigSource = 'unset';
  if (file.apiKey) {
    apiKey = file.apiKey;
    apiKeySource = 'config file';
  }
  if (envKey) {
    apiKey = envKey;
    apiKeySource = 'env';
  }

  return {
    apiUrl: apiUrl.replace(/\/$/, ''),
    apiKey,
    sources: { apiUrl: apiUrlSource, apiKey: apiKeySource },
  };
}

/** Persist config to ~/.companybrain/config.json with 600 permissions. */
export function saveConfig(cfg: FileConfig): string {
  const dir = configDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const path = configPath();
  writeFileSync(path, JSON.stringify(cfg, null, 2) + '\n', { mode: 0o600 });
  chmodSync(path, 0o600);
  return path;
}
