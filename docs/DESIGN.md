# Smart Finance — Design Direction (Taste Skill)

UI is built under the **Taste Skill** (`design-taste-frontend`, installed at `.zcode/skills/design-taste-frontend/`, dealt sheets in `.taste-skill/`). House rules in force: no gradients, no shadows at rest, no glass, no violet/indigo, no icon-tinted KPI tiles, no sparklines on KPIs, no zebra tables, right-aligned tabular figures, honest zeros, sentence case everywhere.

## App screens — style `pastel-consumer` (dealt, seed 1612464558)

Chosen because the library deals it for **wallets and budgeting** products: pale same-hue category tiles, one large radius, quiet money polarity.

| Token | Value |
| --- | --- |
| ground / surface / raised | `#f3f5f7` / `#ffffff` / `#f2f8fd` |
| border / rule / control | `#e6e6e6` / `#f4f4f4` / `#d6d9dd` |
| text / muted | `#1b1d1f` / `#5c6064` |
| accent (+ soft, ink) | `#1d5fd6` (`#dcf1ff`, `#0a3a80`) — on data and one control only |
| positive / negative / warning | `#2f7a45` / `#c41c29` / `#92400e` (+ pale pill pairs) |
| chart hues | `#1d5fd6` `#b45309` `#2a8798` — one hue per chart |
| radius card / control | 20px / 10px |
| title / section / KPI / body / small | 28 / 20 / 32 / 16 / 14 px |
| gap / control height | 24px / 40px |

**Typeface: Manrope** (variable, weights 400–600), self-hosted via `@fontsource-variable/manrope`, `tabular-nums` on every figure.
**Face chosen:** the money itself is the face — balances at 30–32px semibold with the decimals smaller and grey.
**Signature element:** the month **plan ring** with its safe-to-spend line (dashboard) and pale **goal pots** (goals page).
**Shell:** icon rail (56px, product mark on top, tooltips + aria-labels, utilities at the bottom) → on phones a labelled bottom bar. The rail sits on the page ground; never dark.

## Landing page — direction `quiet-instrument` (dealt, seed 556324314)

Radical understatement, shared palette/typeface with the app.

- **Idea sentence:** "On this page, *the app's own money arithmetic* becomes *the quiet instrument's small exact demonstration*."
- **Hero:** "Navigation on the midline" — full-viewport photograph, a 64px rail across the vertical centre carrying the h1, docks into the page header on scroll. Second full-bleed photo beneath.
- **Sections:** features as a *real product panel* (`data-ui`) with margin notes → how-it-works as a run-in column with column-width evidence fragments → cta as one plain sentence + one action → footer as a single quiet line.
- **The one live thing:** a 50/30/20 budget calculator — type your monthly take-home, read your real split (plain-static fallback numbers when JS is off).

## Imagery (downloaded into `client/public/img/`, credited in the landing footer)

Dealt "Water" set (Unsplash licence, served via picsum.photos) — atmosphere, never presented as the product:

| File | Picture | Photographer |
| --- | --- | --- |
| `hero-a.jpg` | Small red boat on clear turquoise water, from above (id 124) | Anton Sulsky |
| `hero-b.jpg` | Silhouetted pier on a hazy blue lake (id 293) | Paul E. Harrer |
| `hero-c.jpg` | Two people paddling a canoe on a misty green lake (id 469) | Matthew Clark |
| `detail.jpg` | Small red boat on dark rippling sea (id 1038) | Marcelo Quinan |

## Sample data that must be replaced before launch

The landing page's product fragments (dashboard panel, evidence rows) use **illustrative sample data** so the design is seen at full density. It adds up (totals are computed from rows) and is confined to `client/src/landing/fragments.tsx`. Replace with real screenshots or live demo data before public launch. No invented customers, quotes, reviews, press or business statistics appear anywhere.
