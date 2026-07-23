# Examples

Runnable examples for CompanyBrain. Each folder has its own README with
prerequisites and run steps. All of them need a running CompanyBrain API and an
API key (`cb_...`) — start with `curl/` to mint one.

- `quickstart-ts/` — add memories, hybrid search, and chat with `@companybrain/sdk`.
- `rag-chatbot/` — streaming chat REPL that prints sources per answer.
- `ingest-folder/` — bulk-ingest a folder of `.md` / `.txt` files as memories.
- `python-quickstart/` — the same add / search / chat flow with the Python SDK.
- `curl/` — the raw HTTP flow: register, mint a key, add, search, chat.

The TypeScript examples are pnpm workspace packages. Run `pnpm install` at the
repo root, then use the per-example commands in each README.
