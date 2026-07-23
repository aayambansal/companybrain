import { createInterface } from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { CompanyBrain } from '@companybrain/sdk';

interface Source {
  index: number;
  documentId: string;
  title: string | null;
  sourceUrl: string | null;
}

const cb = new CompanyBrain({
  apiUrl: process.env.COMPANYBRAIN_API_URL,
  apiKey: process.env.COMPANYBRAIN_API_KEY,
});

const rl = createInterface({ input, output });
rl.on('SIGINT', () => rl.close());

console.log('CompanyBrain chat. Ask a question, or press Ctrl+C / Ctrl+D to exit.');
output.write('you > ');

for await (const line of rl) {
  const message = line.trim();
  if (message) {
    let sources: Source[] = [];
    output.write('bot > ');
    try {
      for await (const { event, data } of cb.chatStream({ message })) {
        if (event === 'token') output.write(JSON.parse(data) as string);
        else if (event === 'citations') sources = JSON.parse(data) as Source[];
      }
      output.write('\n');
      if (sources.length > 0) {
        console.log('Sources:');
        for (const s of sources) {
          console.log(
            `  [${s.index}] ${s.title ?? 'Untitled'}${s.sourceUrl ? ` (${s.sourceUrl})` : ''}`,
          );
        }
      }
    } catch (err) {
      output.write(`\n[error] ${err instanceof Error ? err.message : String(err)}\n`);
    }
  }
  output.write('you > ');
}

console.log('\nbye');
