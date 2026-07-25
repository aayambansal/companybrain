const colorEnabled =
  !!process.stdout.isTTY && process.env.NO_COLOR === undefined && process.env.TERM !== 'dumb';

function paint(code: string): (s: string) => string {
  return (s) => (colorEnabled ? `\x1b[${code}m${s}\x1b[0m` : s);
}

export const bold = paint('1');
export const dim = paint('2');
export const red = paint('31');
export const green = paint('32');
export const yellow = paint('33');
export const blue = paint('34');
export const magenta = paint('35');
export const cyan = paint('36');

/**
 * The CompanyBrain wordmark, matching the API startup banner: block letterforms
 * under a vertical amber gradient, bright at the top and deepening toward the
 * baseline. 71 columns wide, so it still fits an 80-column terminal.
 *
 * It carries its own colour rather than taking a paint() wrapper, since the
 * point of the gradient is that each row differs.
 */
const WORDMARK: readonly (readonly [number, string])[] = [
  [226, '█████ █████ █   █ █████ █████ █   █ █   █ ████  █████ █████ █████ █   █'],
  [220, '█     █   █ ██ ██ █   █ █   █ ██  █  █ █  █   █ █   █ █   █   █   ██  █'],
  [214, '█     █   █ █ █ █ █████ █████ █ █ █   █   ████  █████ █████   █   █ █ █'],
  [208, '█     █   █ █   █ █     █   █ █  ██   █   █   █ █  █  █   █   █   █  ██'],
  [172, '█████ █████ █   █ █     █   █ █   █   █   ████  █   █ █   █ █████ █   █'],
];

export function wordmark(): string {
  return WORDMARK.map(([tone, row]) =>
    colorEnabled ? `  \x1b[38;5;${tone}m${row}\x1b[0m` : `  ${row}`,
  ).join('\n');
}

/** Collapse whitespace and truncate to a single-line snippet. */
export function snip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean;
}
