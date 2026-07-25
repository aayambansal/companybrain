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

## Open

- **[bad] Tap targets under 44px on mobile** (~52 findings): Button `sm` is 32px
  and `md` 38px; filter chips and mode tabs 30-32px; inline list links 16-23px.
  Fix at the component level (Button cva + a shared chip), not per page.
- **[todo] Forced states** not yet audited: loading, error, api-down, 10k items.
  The app-shell auth gate is a full-page lonely spinner, which the rubric bans;
  needs a real shell + skeleton.
- **[todo] Keyboard pass** on the core flows.
- **[todo] `landing/`** not yet audited.
