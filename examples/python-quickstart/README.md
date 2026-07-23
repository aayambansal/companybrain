# python-quickstart

Adds a memory, runs a hybrid search, then asks a question using the
`companybrain` Python SDK.

## Prerequisites

- A running CompanyBrain API (default `http://localhost:3333`).
- An API key (`cb_...`). See `../curl` to mint one.
- Python 3.9+.

## Install

```bash
pip install companybrain
# or, from this repo, install the local SDK:
pip install -e ../../sdks/python
```

## Run

```bash
export COMPANYBRAIN_API_URL=http://localhost:3333
export COMPANYBRAIN_API_KEY=cb_...
python3 main.py
```
