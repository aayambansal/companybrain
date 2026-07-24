# Product

## Register

product

## Users

Engineers, founders, and operators at small teams who self-host CompanyBrain on
their own infrastructure. They arrive with a question about something the company
already decided, wrote, or shipped, and they need the answer plus its source. The
typical session is short and interruptive: a question between two other tasks,
often late, often with the editor still open on the other monitor.

The job: recall what the company already knows without reading through Slack,
Notion, and a year of documents. Secondary jobs: connect a new source, check that
indexing is healthy, and hand the same memory to an AI agent over MCP.

## Product Purpose

A self-hosted memory layer over a company's own knowledge. It ingests documents,
chats, and docs from 40+ connectors, indexes them with hybrid retrieval (vector
plus full-text), and answers questions with citations. It exists so a team's
knowledge stays searchable on infrastructure they control, with their own model
keys, instead of inside a vendor's index.

Success: a question typed into search or chat returns the passage that answers it,
with a link to the source, fast enough that the user doesn't switch back to
grepping Slack.

## Brand Personality

Precise, self-hosted, unhurried. Voice is plain and specific: it names the thing
that happened ("indexed 412 chunks", "sync failed: token expired") rather than
narrating it. Never chirpy, never salesy. The interface should read as
instrumentation for your own data, closer to a well-built internal tool than to a
consumer AI product.

Emotional goal: the confidence of seeing your own knowledge laid out and under
your control.

## Anti-references

- The saturated "AI product dark mode": near-black plus a violet-to-blue gradient
  glow, floating glass cards, a shimmering border on everything. Currently the
  default output of every AI tool and every AI generating one.
- Terminal-cosplay: monospace body copy, green-on-black, fake CRT scanlines. Being
  a developer tool does not mean pretending to be a TTY.
- Chat-first products where the answer arrives with no visible source and no way to
  audit it. Citations are the point here, not a footnote.
- Dashboard-as-casino: hero metric tiles, sparklines, and percentage deltas that
  the user never asked for and cannot act on.

## Design Principles

1. **Show the source, always.** Every generated answer carries the passages it came
   from, one click from the original. An uncited answer is a bug.
2. **Summary before detail, on every surface.** The user is mid-interruption. Lead
   with the answer or the state; put the supporting rows underneath.
3. **State is encoded in form, not just color.** Indexing, failed, synced, and
   pending must be distinguishable without relying on hue alone.
4. **Earned familiarity over invention.** Standard affordances (command palette,
   side nav, tabs, dialogs) built on real accessible primitives. Novelty is spent
   on the retrieval experience, not on re-inventing a select.
5. **Self-hosted means legible.** Surface what the instance is actually doing:
   which model, which embedder, what synced, what failed. No hidden machinery.

## Accessibility & Inclusion

- Target WCAG 2.1 AA. Body text at least 4.5:1, large text and UI boundaries at
  least 3:1, verified against the dark ground rather than assumed.
- Full keyboard operation, including the command palette, navigation, and every
  dialog. Visible focus ring on every interactive element, one consistent
  treatment app-wide.
- Status never communicated by color alone; pair with a shape, icon, or label.
- Honor `prefers-reduced-motion` with a crossfade or instant alternative for every
  animation.
- Interface targets at least 36px in the primary navigation and action areas.
