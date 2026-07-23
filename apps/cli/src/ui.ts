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

/** The CompanyBrain brain motif, shared with the API startup banner. */
export function brain(): string {
  return [
    '       _---~~(~~-_.',
    '     _{        )   )',
    "   ,   ) -~~- ( ,-' )_",
    "  (  `-,_..`., )-- '_,)",
    ' ( ` _)  (  -~( -_ `,  }',
    " (_-  _  ~_-~~~~`,  ,' )",
    '   `~ -^(    __;-,((()))',
    '         ~~~~ {_ -_(())',
    '                `\\  }',
    '                  { }',
  ].join('\n');
}

/** Collapse whitespace and truncate to a single-line snippet. */
export function snip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max - 1) + '…' : clean;
}
