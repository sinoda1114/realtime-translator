# Design — Realtime Translator

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow.

## Context (inferred, stated per Hallmark opt-out protocol)

- **Audience**: two people mid-conversation, one Japanese-speaking, one
  English-speaking, sharing one phone. Often outdoors, in daylight, casual or
  business settings (travel, hospitality, quick errands). One person is only
  glancing at the screen while the other holds it.
- **Use case**: read live streaming subtitles instantly and legibly. The
  primary action is a single start/stop toggle. History and settings are
  secondary utility, visited rarely.
- **Tone**: utilitarian × calm-trustworthy. Legibility and outdoor contrast
  outrank decoration. Warm, human, unintimidating — not corporate-cold, not
  playful/gamified.

## Genre

editorial (silent default — no SaaS/enterprise, no dark-AI-tool, no
consumer-playful signal fires)

## Theme route

**custom (tuned)**. Signal: the brief carries a real functional constraint the
20-theme catalog can't carry — a palette that must read calmly across two
cultures, stay legible in direct sunlight, and work identically right-side-up
and rotated 180°. Vibe: *"fresh cross-cultural trust, daylight-legible, quiet
confidence."* Anchor: ocean blue (the colour of the globe seen from orbit —
reads as international/connective, avoids red's alarm connotation). Revised
2026-07-25 at explicit user request: the original warm clay/terracotta
anchor read as too muted; ocean blue keeps the same daylight-legible,
low-saturation-on-neutral structure while carrying a "global" brand meaning
more literally. Hue nudged further toward blue the same day (200° → 232°)
per follow-up feedback that the first pass still read too teal/green.

## Macrostructure families

The 21 Hallmark macrostructures are landing-page shapes; this is a live app,
not a marketing site. Two families, both adapted rather than templated:

- **App pages** (Translator `/`, Settings `/settings`): **Console Split** —
  a custom app-console structure. Translator: two mirrored subtitle panes
  (top rotated 180°) around a fixed control bar — functionally mandated, not
  a catalog pick. Settings: grouped-section utility form, generous vertical
  rhythm, no marketing chrome.
- **Content pages** (History list `/history`, History detail
  `/history/[id]`): loosely borrows **Index-First** (list) and **Long
  Document** (detail) *typographic rhythm only* — plain list-as-navigation
  for history, continuous readable transcript for detail. No hero, no CTA
  strip, no testimonial/pricing apparatus — none of that applies to a utility
  app.

## Theme

Light is primary (daylight legibility is a hard requirement — dark-on-bright
outdoor glare is a real failure mode for this product). Dark variant ships via
`prefers-color-scheme` for evening/indoor use.

### Light
- `--color-paper`      oklch(96.5% 0.010 232)
- `--color-paper-2`     oklch(93% 0.012 232)
- `--color-paper-3`     oklch(89% 0.014 232)
- `--color-ink`         oklch(22% 0.014 232)
- `--color-ink-2`       oklch(38% 0.012 232)
- `--color-rule`        oklch(78% 0.014 232)
- `--color-rule-2`      oklch(85% 0.012 232)
- `--color-muted`       oklch(50% 0.012 232)
- `--color-accent`      oklch(48% 0.160 232)   /* #0068a7 — 5.93:1 vs accent-ink text, 5.37:1 vs paper (both exceed AA) */
- `--color-accent-ink`  oklch(98% 0.010 232)   /* text on accent fill */
- `--color-focus`       oklch(50% 0.200 232)
- `--color-danger`      oklch(52% 0.180 25)
- `--color-danger-ink`  oklch(98% 0.010 25)

### Dark
- `--color-paper`      oklch(16% 0.014 232)
- `--color-paper-2`     oklch(20% 0.014 232)
- `--color-paper-3`     oklch(25% 0.014 232)
- `--color-ink`         oklch(94% 0.010 232)
- `--color-ink-2`       oklch(78% 0.012 232)
- `--color-rule`        oklch(32% 0.014 232)
- `--color-rule-2`      oklch(26% 0.014 232)
- `--color-muted`       oklch(62% 0.012 232)
- `--color-accent`      oklch(68% 0.160 232)   /* 6.99:1 vs dark paper */
- `--color-accent-ink`  oklch(16% 0.014 232)
- `--color-focus`       oklch(70% 0.200 232)
- `--color-danger`      oklch(66% 0.170 25)
- `--color-danger-ink`  oklch(16% 0.014 25)

Accent footprint stays ≤5% of any viewport — the active-language pill, the
session button, focus rings, and small status dots only. Subtitle text is
always ink-on-paper, never accent-on-paper (accent must never compete with
legibility of the thing the whole app exists to show).

## Typography

The product's primary content is live bilingual text (Japanese + English)
read at a glance. A foundry display face with no CJK glyphs would force a
visual seam between the two languages — wrong for this product. One family
carries both scripts; a mono face carries technical/status chrome.

- **Primary (content + UI)**: Noto Sans JP — weights 400 / 500 / 700.
  Harmonized Latin+CJK glyphs at the same optical size; this *is* the
  design decision, not a fallback.
- **Technical (timestamps, status, mono chrome)**: Geist Mono (already
  wired via `next/font` — kept, not replaced).
- Display tracking: 0em (Noto Sans JP tracks tightly enough already;
  loosening it hurts CJK legibility).
- Subtitle scale anchor: `--text-subtitle` = clamp(1.375rem, 1rem + 2.4vw, 2.25rem)
  at `medium` size preset; the existing 4-step size preset (small/medium/
  large/extra-large) scales this clamp, not a fixed px value.

## Spacing

4-point named scale, semantic tokens (`--space-3xs` … `--space-3xl`). Values
in `tokens.css`. Components use named tokens only, never raw px/rem.

## Motion

- Easings: `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`,
  `--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)`.
- Durations: `--dur-fast: 120ms`, `--dur-short: 220ms`, `--dur-medium: 400ms`.
- Reveal pattern: none on subtitle text (it must feel instantaneous — this is
  a latency-sensitive product). Micro-motion only on control affordances
  (button press, switch toggle, connection-state pulse).
- `prefers-reduced-motion: reduce` → all motion collapses to opacity-only,
  ≤150ms, no transform.

## Microinteractions stance

- Silent success on save (no toast for every saved utterance — that would be
  constant noise in a live-streaming UI). Errors are visible and persistent
  until resolved, never auto-dismissed.
- Session button: `:active` gives immediate tactile feedback (scale 0.97,
  120ms). Busy/connecting state uses a calm pulse, not a spinner (spinners
  read as "broken" at a glance; this app must read as "working" at a glance).
- Focus rings appear instantly, never animated in.

## CTA voice

- Primary (session start/stop): full accent fill, pill shape, 56px min
  height (exceeds the 44px a11y floor — this is the one button used with
  visual attention split across a conversation).
- Secondary (language select, settings options): outline / ghost, same pill
  radius, ink-coloured.
- Destructive (delete): filled danger colour, requires the existing native
  confirm (kept from the functional implementation).

## Per-page allowances

- Translator page: zero enrichment, zero marketing chrome. Function only.
- History / Settings: typographic rhythm only, no imagery, no enrichment.

## What pages MUST share

- The wordmark treatment (text-only, no invented logo mark).
- Accent colour, its ≤5% footprint rule, and the pill button shape.
- Noto Sans JP + Geist Mono.
- The 44px+ tap-target floor and visible focus rings everywhere.

## What pages MAY differ on

- Console Split (app pages) vs. list/document rhythm (content pages).
- Card vs. inline-list treatment for history entries (implementation detail,
  not a system fork).

## Exports

### tokens.css
See `/tokens.css` at project root — generated alongside this file, contains
every `--color-*`, `--font-*`, `--space-*`, `--text-*`, `--ease-*`, `--dur-*`,
`--radius-*` token in both light and dark variants.
