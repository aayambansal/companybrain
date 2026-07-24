# @companybrain/ai-sdk

Vercel AI SDK tools for CompanyBrain. Give any AI SDK agent memory it can search, ask, and write.

```sh
npm install @companybrain/ai-sdk @companybrain/sdk ai
```

```ts
import { generateText, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';
import { CompanyBrain } from '@companybrain/sdk';
import { companyBrainTools } from '@companybrain/ai-sdk';

const cb = new CompanyBrain({ apiKey: process.env.COMPANYBRAIN_API_KEY });

const { text } = await generateText({
  model: openai('gpt-4o'),
  tools: companyBrainTools(cb),
  stopWhen: stepCountIs(5),
  prompt: 'What did we decide about the release process, and note that we moved it to Fridays.',
});
```

Provides three tools: `searchMemory`, `askMemory` (grounded answer + citations), and `addMemory`.
Scope them to a space with `companyBrainTools(cb, { space: 'engineering' })`.
