# Goal log: make the UI shippable

Focus: `apps/web` (dashboard) first, then `landing/`.
Bar: sits in a tab next to Linear / Stripe without embarrassing itself.

## Harness

- `scripts/ui-audit.mjs [iter]` — Playwright, captures every route at 390 / 768 / 1440
  into `.goal/shots/iter-<n>/<width>/<route>.png`, and reports automated findings
  (horizontal overflow, sub-36px tap targets, console errors).
- App is **dark only** (`globals.css` pins `color-scheme: dark`), so there is no
  light variant to shoot.
- **Serve from this repo, not `~/.companybrain/app`.** That clone is pinned to an
  older commit; iteration 1 was wasted auditing a stale light-theme build.
- **Audit against `localhost:3000`, not `127.0.0.1:3000`.** `CORS_ORIGINS` allows
  `localhost`, so the other origin blocks every API call and every page hangs on
  the auth gate.
- Seeded 8 realistic memories plus one deliberate unbreakable-token record, so
  density and overflow are actually exercised.

## Routes (14 captures)

overview, search, search-empty, chat, playbooks, memories, memory-detail, topics,
spaces, connections, analytics, settings, login, register.

Note: in single-user mode `/login` and `/register` redirect into the app, so those
two captures show the dashboard. Auth screens need `AUTH_MODE=multi` to audit.

## Iterations

| iter | findings | note |
| --- | --- | --- |
| 1 | 117 | first real audit (after fixing harness origin + stale server) |
| 2 | 64 | nav tap targets + first min-w-0 pass |
| 3 | 60 | grid tracks -> minmax(0,1fr) |
| 4 | 54 | overflow-wrap: anywhere + min-w-0 on text holders |
| 5 | 52 | content block + shouted labels; **zero overflow findings** |
| 8 | 0 | 44px targets via Button cva + shared Chip/Tab |
| 9 | 0 | real loading skeleton + API-unreachable state |
| 11 | 0 | skip link, space-count bug, copy |
| 12 | 0 | connector filter |
| final-a / final-b | 0 | **two consecutive clean audits** |

## Closed

- **[blocker] Horizontal overflow on 6 routes at 3 widths.** Root causes, all fixed:
  1. Grid tracks default to `min-width: auto`, so one unbreakable string widened
     the whole page. Now `minmax(0,1fr)` in overview, analytics, topics, shell.
  2. `overflow-wrap: break-word` does not shrink an element's *min-content* size,
     so flex children still demanded max-content. Switched the global rule to
     `overflow-wrap: anywhere`.
  3. `truncate` inside a flex row without `min-w-0` refuses to shrink. Added
     `min-w-0` at every truncation point (overview, memories, memory-detail,
     search, topics, webhooks, command palette).
  4. Memory detail's content block is a `div` (not covered by the element rule);
     given `[overflow-wrap:anywhere]` explicitly.
- **[bad] Mobile nav / logo / search targets at 20-34px.** Now `min-h-11` / `size-11`.
- **[bad] Shouted `CONTENT` / `RELATED` / playbook labels.** Sentence case now.

- **[bad] Tap targets under 44px.** Fixed in the component layer: Button's cva
  sizes carry `min-h-11` and relax from `sm` up; new shared `Chip` and `Tab`
  replaced four ad-hoc copies whose padding had already drifted. List rows that
  were text-height are now padded blocks.
- **[blocker] App shell gated every route behind a lonely centred spinner.** Now
  renders the real frame (navigation does not depend on the request) with
  skeletons only where data goes.
- **[blocker] An unreachable API was treated as "logged out"**, bouncing to a
  login that could not work either. Now classified: 401/403 -> sign in, anything
  else -> a screen naming the URL that did not answer, the three usual causes,
  and a retry.
- **[blocker] Spaces reported "General 0"** with nine memories in that space. The
  correlated subquery built from an interpolated table returned 0 for every
  space; replaced with leftJoin + groupBy.
- **[bad] No way to find a connector** among 44 identical cards. Name filter plus
  category tabs derived from what the server registers.
- **[bad] Copy:** "local embeddings, no llm" was lowercase and named our
  subsystem. Now says what search runs on and where answers come from.
- **[bad] Keyboard:** ten nav items preceded content on every page. Added a skip
  link as the first tab stop.
- **[blocker] CI red since iteration 5.** A local `next build` rewrites
  `next-env.d.ts` and `tsconfig.json`; those rewrites were committed and prettier
  disagreed. Both are prettierignored now, so building cannot break the check.

## Verified

- Keyboard: tab order logical, focus ring on every stop, Cmd-K opens and
  autofocuses the palette, Escape closes, `/` jumps to search focused.
- Forced states: API-down and loading skeleton both captured by aborting or
  delaying `/v1/` requests (`.goal/states/`).
- CI green: typecheck / test / format, python sdk, db migrate + api smoke, and
  both Docker image builds.

## Open

- **[todo] `landing/`** not audited in this loop; it is a separate brand surface
  and still on its own light theme, verified at Lighthouse 100 earlier.
- **[note] Auth screens** cannot be audited in single-user mode (`/login` and
  `/register` redirect into the app). They need `AUTH_MODE=multi`.
