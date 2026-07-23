# companybrain

Official Python SDK for CompanyBrain, the open-source memory layer. One runtime
dependency (`httpx`), sync and async clients, fully typed.

```sh
pip install companybrain
```

## Sync

```python
from companybrain import CompanyBrain

cb = CompanyBrain(
    api_url="http://localhost:3333",   # or COMPANYBRAIN_API_URL
    api_key="cb_...",                  # or COMPANYBRAIN_API_KEY
)

# Add
cb.memories.add(title="Release process", content="We ship on Thursdays.")

# Search
result = cb.search("when do we ship", mode="hybrid", limit=5)
for hit in result["hits"]:
    print(hit["score"], hit["content"])

# Ask, with citations
answer = cb.chat("How often do we release?")
print(answer["message"], answer["citations"])

# Stream the answer
for event, data in cb.chat_stream("Summarize our release process"):
    if event == "token":
        print(data, end="", flush=True)
```

## Async

```python
import asyncio
from companybrain import AsyncCompanyBrain

async def main():
    async with AsyncCompanyBrain(api_key="cb_...") as cb:
        await cb.memories.add(content="We ship on Thursdays.")
        result = await cb.search("when do we ship")
        async for event, data in cb.chat_stream("How often do we release?"):
            if event == "token":
                print(data, end="", flush=True)

asyncio.run(main())
```

## Resources

- `cb.memories` — `add`, `list`, `get`, `update`, `delete`
- `cb.spaces` — `list`, `create`, `delete`
- `cb.connections` — `available`, `list`, `create`, `sync`
- `cb.api_keys` — `list`, `create`, `revoke`
- `cb.search(...)`, `cb.chat(...)`, `cb.chat_stream(...)`, `cb.status()`

Method arguments are snake_case (`space_id`, `source_url`, `min_score`) and map
to the API's camelCase fields. Responses are returned as typed dicts matching
the JSON payloads.

Non-2xx responses raise `CompanyBrainError` with `status`, `code`, `message`,
and `details`.

## Development

```sh
pip install -e '.[dev]'
pytest
```

Tests run against `httpx.MockTransport`; no running API is required.
