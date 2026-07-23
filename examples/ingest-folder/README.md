# ingest-folder

Reads every `.md` and `.txt` file in a folder and adds each as a memory. The
filename becomes the title; `.md` files are ingested as markdown, `.txt` as
plain text. A summary is printed at the end.

## Prerequisites

- A running CompanyBrain API (default `http://localhost:3333`).
- An API key (`cb_...`). See `../curl` to mint one.

## Run

From the repo root:

```bash
pnpm install
export COMPANYBRAIN_API_URL=http://localhost:3333
export COMPANYBRAIN_API_KEY=cb_...
pnpm --filter @companybrain/example-ingest-folder start ./examples/ingest-folder/sample
```

Replace the path with any folder of `.md` / `.txt` files. A small `sample/`
folder is included so you can try it immediately.
