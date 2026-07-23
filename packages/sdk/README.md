# @companybrain/sdk

Official TypeScript SDK for CompanyBrain. Zero dependencies, works in Node and the browser.

```sh
npm install @companybrain/sdk
```

```ts
import { CompanyBrain } from '@companybrain/sdk';

const cb = new CompanyBrain({
  apiUrl: 'http://localhost:3333',      // or COMPANYBRAIN_API_URL
  apiKey: process.env.COMPANYBRAIN_API_KEY,
});

// Add
await cb.memories.add({ title: 'Release process', content: 'We ship on Thursdays.' });

// Search
const { hits } = await cb.search({ q: 'when do we ship', mode: 'hybrid', limit: 5 });

// Ask, with citations
const answer = await cb.chat({ message: 'How often do we release?' });
console.log(answer.message, answer.citations);

// Stream the answer
for await (const frame of cb.chatStream({ message: 'Summarize our release process' })) {
  if (frame.event === 'token') process.stdout.write(frame.data);
}
```

## Resources

- `cb.memories` — `add`, `list`, `get`, `update`, `delete`
- `cb.spaces` — `list`, `create`, `delete`
- `cb.connections` — `available`, `list`, `create`, `sync`
- `cb.apiKeys` — `list`, `create`, `revoke`
- `cb.search(...)`, `cb.chat(...)`, `cb.chatStream(...)`, `cb.status()`

Errors are thrown as `CompanyBrainError` with `status`, `code`, and `details`.
