# Design

Visual system for the CompanyBrain dashboard (`apps/web`). The landing page
(`landing/`) is a separate brand surface and keeps its own light treatment.

## Theme

**A precision instrument panel at night.** The scene: an engineer at 11:40pm,
room lit only by monitors, checking what the team already decided before writing
the next thing. That forces dark, and it forces legibility over atmosphere.

Deliberately not two things: the saturated "AI product dark mode" (near-black
plus a violet gradient glow, glass cards, shimmering borders), and
terminal-cosplay (monospace body, green-on-black, scanlines). Depth comes from
surfaces that lift in real steps, not from blur.

Color strategy: **restrained**. Tinted dark neutrals carry the surface; iris
appears only on the user's own actions, selection, and focus; amber only on live
machine activity. Neither is decoration.

## Color

All tokens are OKLCH, defined in `apps/web/src/app/globals.css` under `@theme`.
Hue 266 (iris) tints every neutral, so the greys read as the brand's own rather
than as default slate.

| Role | Token | Notes |
| --- | --- | --- |
| Rail | `--color-rail` | Deepest. Navigation reads as chassis. |
| Canvas | `--color-bg` | The work surface. |
| Panel | `--color-surface` | Primary container (`.panel`). |
| Raised | `--color-surface-2`, `--color-surface-hover` | Controls, hover. |
| Line | `--color-border`, `--color-border-strong` | Strong clears 3:1 for control boundaries. |
| Ink | `--color-ink`, `-muted`, `-faint` | Faint is the floor and still clears 4.5:1. |
| Action | `--color-primary` (iris) | Primary buttons, selection, focus ring. |
| Live | `--color-spark` (amber) | Indexing, syncing, streaming. |
| Status | `--color-success/warn/danger/info` | Always paired with a shape or label. |

**Contrast is computed, not assumed.** Every text pair was checked against the
surface it actually sits on (ink/bg 17.0:1, ink-faint/surface 5.76:1,
primary-ink on primary 6.6:1, border-strong/bg 3.3:1). Re-verify when changing a
lightness value.

## Typography

One UI family, `Switzer`, carrying every weight; hierarchy comes from scale and
weight, not from a second face. `JetBrains Mono` is reserved for data: IDs,
scores, counts, timestamps, code, and keyboard hints. **No display face and no
mono on section headings** — this is product UI, where a display font in a label
is noise.

Fixed rem scale (`--text-2xs` through `--text-2xl`, ratio ~1.2), not fluid: users
view a dashboard at consistent DPI, and a heading that shrinks inside a panel
looks worse, not designed. `--font-display` is aliased to the UI family so any
remaining `font-display` markup renders as weight contrast.

## Components

Built on Radix primitives, with `class-variance-authority` for variants and
`tailwind-merge` so a caller's `className` always wins. Every interactive
component ships default, hover, focus, active, and disabled.

- `ui.tsx` — Button, Input, Textarea, Select, Field, Badge, StatusDot, Spinner,
  Skeleton, EmptyState, Tooltip, Switch, Tabs, Separator
- `command-palette.tsx` — cmdk in a Radix Dialog; live memory search ranked above
  navigation
- `icons.tsx` — lucide-react, aliased to semantic `Icon*` names
- `toast.tsx` — sonner, keeping the `toast(kind, message)` call shape

Panels use `.panel` (surface + border + a 1px top bevel, the instrument detail).
Related totals go in a **single instrument strip**, not a row of identical metric
tiles.

## Motion

150–250ms, `--ease-out-quart` / `--ease-out-expo`. Motion conveys state only:
the nav's shared-layout active indicator (motion's `layoutId`), search results
staggering as a set lands, the amber live-dot ping. No page-load choreography.

Every animation has a `prefers-reduced-motion` path, and reveals always enhance
an already-visible default so nothing can ship blank in a headless render.

## Accessibility

WCAG 2.1 AA. One focus treatment app-wide (2px iris, 2px offset). Status is never
hue alone: `StatusDot` varies fill and ring and carries an `sr-only` label.
Standard scrollbars restyled, not reinvented.
