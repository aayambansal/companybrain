# @companybrain/cli

Command-line interface for CompanyBrain, the open-source memory layer. Binary
`companybrain` (alias `cb`). Built on `@companybrain/sdk`, no runtime
dependencies beyond it.

## Install

Inside the monorepo:

```sh
pnpm --filter @companybrain/cli build
node apps/cli/dist/index.js help
```

Once published, `companybrain` and `cb` are on your PATH.

## Usage

```sh
companybrain <command> [options]
```

| Command             | Description                                            |
| ------------------- | ------------------------------------------------------ |
| `add <text>`        | Add a memory. Use `-` or pipe stdin to read from stdin |
| `search <query>`    | Search memories, ranked by score                       |
| `ask <question>`    | Ask a question; streams an answer with sources         |
| `spaces`            | List spaces with document counts                       |
| `status`            | Show API status (providers, counts)                    |
| `config`            | Show resolved configuration                            |
| `login`             | Save API URL and key to `~/.companybrain/config.json`  |
| `help`              | Show help                                              |

### add

```sh
companybrain add "We ship on Thursdays." --title "Release process" --tags release,process
cat notes.md | companybrain add -
```

Options: `--title`, `--space`, `--tags a,b`, `--url`. Prints the created memory id.

### search

```sh
companybrain search "when do we ship" --mode hybrid --limit 5
```

Options: `--mode hybrid|semantic|keyword` (default `hybrid`), `--limit`, `--space`.

### ask

```sh
companybrain ask "How often do we release?"
```

Streams tokens when attached to a TTY, then prints a `Sources:` list. Option: `--space`.

## Configuration

Precedence: environment variables > config file > defaults.

- `COMPANYBRAIN_API_URL` (default `http://localhost:3333`)
- `COMPANYBRAIN_API_KEY`
- `~/.companybrain/config.json` (written by `login`, mode `600`)

```sh
companybrain login    # interactive prompt for URL + key
companybrain config   # show what is resolved and from where
```

## Development

```sh
pnpm --filter @companybrain/cli dev search "hello"   # tsx, no build
pnpm --filter @companybrain/cli typecheck
pnpm --filter @companybrain/cli build
```
