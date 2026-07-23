# n8n-nodes-companybrain

An [n8n](https://n8n.io) community node for CompanyBrain. Search, ask, and add to your company
memory from any workflow.

## Install

In n8n: Settings > Community Nodes > Install > `n8n-nodes-companybrain`.

## Credentials

Add a **CompanyBrain API** credential with your API URL (e.g. `http://localhost:3333`) and, if
the server runs in multi-user mode, an API key (`cb_...`). In single-user mode the key is optional.

## Operations

- **Search** — hybrid search, returns ranked passages.
- **Ask** — a grounded answer with citations.
- **Add** — store a new memory.

Scope any operation to a space with the Space field.
