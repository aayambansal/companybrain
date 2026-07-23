# @companybrain/langchain

A LangChain retriever backed by CompanyBrain hybrid search. Drop your company memory into any
LangChain or LangGraph chain.

```sh
npm install @companybrain/langchain @companybrain/sdk @langchain/core
```

```ts
import { CompanyBrain } from '@companybrain/sdk';
import { CompanyBrainRetriever } from '@companybrain/langchain';

const retriever = new CompanyBrainRetriever({
  client: new CompanyBrain({ apiUrl: 'http://localhost:3333', apiKey: process.env.COMPANYBRAIN_API_KEY }),
  k: 6,
  mode: 'hybrid',
});

const docs = await retriever.invoke('what did we decide about the release process?');
```

Use it anywhere a LangChain `BaseRetriever` fits: RetrievalQA chains, LangGraph nodes, agents.
Each returned `Document` carries `metadata` with the source document id, title, url, connector,
and score.
