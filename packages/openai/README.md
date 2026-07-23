# @companybrain/openai

OpenAI function-calling tools for CompanyBrain. Works with the OpenAI Agents SDK, the Assistants
API, and raw chat-completions function calling.

```sh
npm install @companybrain/openai @companybrain/sdk openai
```

```ts
import OpenAI from 'openai';
import { CompanyBrain } from '@companybrain/sdk';
import { companyBrainOpenAITools, runCompanyBrainTool } from '@companybrain/openai';

const cb = new CompanyBrain({ apiKey: process.env.COMPANYBRAIN_API_KEY });
const openai = new OpenAI();

const res = await openai.chat.completions.create({
  model: 'gpt-4o',
  tools: companyBrainOpenAITools(),
  messages: [{ role: 'user', content: 'What did we decide about the release process?' }],
});

for (const call of res.choices[0].message.tool_calls ?? []) {
  const output = await runCompanyBrainTool(cb, call.function.name, JSON.parse(call.function.arguments));
  // feed `output` back as a tool message and continue the loop
}
```

Tools: `search_memory`, `ask_memory`, `add_memory`.
