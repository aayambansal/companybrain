/** ASCII banner printed on API startup. */

/**
 * The CompanyBrain wordmark: solid block letterforms under a vertical amber
 * gradient, bright at the top and deepening toward the baseline. 71 columns
 * wide, so it still fits an 80-column terminal.
 */
const WORDMARK: readonly (readonly [number, string])[] = [
  [226, '█████ █████ █   █ █████ █████ █   █ █   █ ████  █████ █████ █████ █   █'],
  [220, '█     █   █ ██ ██ █   █ █   █ ██  █  █ █  █   █ █   █ █   █   █   ██  █'],
  [214, '█     █   █ █ █ █ █████ █████ █ █ █   █   ████  █████ █████   █   █ █ █'],
  [208, '█     █   █ █   █ █     █   █ █  ██   █   █   █ █  █  █   █   █   █  ██'],
  [172, '█████ █████ █   █ █     █   █ █   █   █   ████  █   █ █   █ █████ █   █'],
];

/**
 * Colour is dropped when stdout is not a TTY (a log file, a pipe, a CI job), so
 * captured output stays readable instead of filling with escape codes.
 */
export function wordmark(color: boolean): string {
  return WORDMARK.map(([tone, row]) =>
    color ? `  \x1b[38;5;${tone}m${row}\x1b[0m` : `  ${row}`,
  ).join('\n');
}

export function banner(opts: {
  version: string;
  port: number;
  embedding: string;
  llm: string;
  color?: boolean;
}): string {
  const color = opts.color ?? process.stdout.isTTY === true;
  const dim = (s: string) => (color ? `\x1b[2m${s}\x1b[0m` : s);
  const row = (k: string, v: string) => `  ${dim(k.padEnd(12))}${v}`;
  return `
${wordmark(color)}

  ${dim(`the open-source memory layer for your company · v${opts.version}`)}

${row('listening', `http://localhost:${opts.port}`)}
${row('docs', `http://localhost:${opts.port}/docs`)}
${row('embeddings', opts.embedding)}
${row('llm', opts.llm)}
`;
}
