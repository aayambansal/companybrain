import { CompanyBrain } from '@companybrain/sdk';

const cb = new CompanyBrain({
  apiUrl: process.env.COMPANYBRAIN_API_URL,
  apiKey: process.env.COMPANYBRAIN_API_KEY,
});

async function main(): Promise<void> {
  // 1. Add a few memories.
  await cb.memories.add({
    content: 'We deploy to production every Thursday at 2pm.',
    title: 'Deploy schedule',
    tags: ['ops'],
  });
  await cb.memories.add({
    content: 'The on-call engineer owns an incident until it is resolved or handed off.',
    title: 'On-call policy',
    tags: ['ops'],
  });
  await cb.memories.add({
    content: 'Expense reports are due on the last business day of each month.',
    title: 'Expenses',
    tags: ['finance'],
  });

  // 2. Run a hybrid search.
  const { hits } = await cb.search({ q: 'when do we deploy', mode: 'hybrid', limit: 5 });
  console.log(`search hits (${hits.length}):`);
  for (const hit of hits) {
    console.log(`  ${hit.score.toFixed(3)}  ${hit.document.title ?? 'Untitled'}`);
  }

  // 3. Ask a question and print the answer with its citations.
  const { message, citations } = await cb.chat({ message: 'When do we deploy to production?' });
  console.log(`\nanswer: ${message}`);
  if (citations.length > 0) {
    console.log('citations:');
    for (const c of citations) {
      console.log(`  [${c.index}] ${c.title ?? 'Untitled'}${c.sourceUrl ? ` (${c.sourceUrl})` : ''}`);
    }
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
