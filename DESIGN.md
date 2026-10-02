# SurfSurf design system

## Overview

SurfSurf is a single-page interface for the SurfToken/BuyGateHook experiment on Sepolia. Its primary tasks are understanding the current pool state, reviewing a trade, depositing voting tokens, and voting on the next sell window. The design takes the brief’s TokenWorks reference as an editorial, type-led starting point; the original wave illustration, warm paper surface, and lime controls give this project its own surf identity.

The page hierarchy is introduction and trade, four live metrics, vote and personal balance panels, rules, then session activity. Wide layouts align to a common container. The mobile DOM order preserves that priority. Fictional practice state is separated by a persistent explanatory banner and transaction labels.

## Colors

The canonical palette and semantic aliases are in `src/styles.css:15`. Primitive values feed role tokens; components mainly consume the aliases. This implementation has one light theme.

| Role token | Exact value | Use |
| --- | --- | --- |
| `--color-page` | `#f6f5ef` | Paper background and inset fields |
| `--color-surface` | `#fffefa` | Trade/vote cards, selected controls, dialog, illustration labels |
| `--color-subtle` | `#eceee5` | Segmented controls, empty vote/progress tracks |
| `--color-border` | `#daddd2` | Structural separators and field/card borders |
| `--color-text` | `#22271f` | Primary text, headings, icons |
| `--color-muted` | `#64695e` | Secondary text and metadata |
| `--color-accent` | `#c2ed8b` | Primary trade/confirmation action and yes-vote proportion |
| `--color-accent-hover` | `#afd975` | Primary action hover |
| `--color-accent-soft` | `#e9f4d7` | Practice banner, yes choice, voting badge |
| `--color-positive` | `#355a40` | Status text, dots, quorum progress |
| `--color-positive-soft` | `#dcebdd` | Illustration panel and readable caption background |
| `--color-opposition` | `#efc3a7` | No-vote proportion; also named in text |
| `--color-error` / `--color-error-soft` | `#94331f` / `#fff0e8` | Inline errors and connection-error surface |
| `--color-focus` | `#245bd6` | 3px keyboard focus outline, offset 4px |

The personal panel uses a local `#edf0e5` surface; its border controls use `#9da98d`. The SVG in `src/WaveScene.tsx` uses `#a9d6bb`, `#82b496`, and `#4e8568` for waves, `#273c2e`/`#263e31` for linework, and `#f4ce67` for the sun. These are decorative artwork colors, not extra interaction statuses.

Measured rendered text pairs at 1440px: primary/page **13.95:1**, muted/page **5.16:1**, primary/lime button **11.45:1**, muted/personal panel **4.89:1**, status/badge **6.84:1**. Illustration labels have opaque backgrounds; measured caption contrast is **12.32:1**. Exact computed pairs and loaded fonts are in `artifacts/contrast-and-fonts.json`. Disabled-control opacity is a disabled state, not a body-text color.

## Typography

Two Latin WOFF2 variable fonts are bundled in `src/assets/fonts/`: **Space Grotesk** (`space-grotesk.woff2`) for branding, headings, large numbers and amounts; **DM Sans** (`dm-sans.woff2`) for body/UI text. Both declare weights **400–700**, normal style, and `font-display: swap`; Arial and sans-serif are fallbacks. Both fonts were reported loaded in the inspected production page. No italic face is requested. Font licenses ship in `public/licenses/` and `dist/licenses/`.

The root is 16px, with antialiasing and `font-synthesis: none`. H1 is `clamp(46px, 4.65vw, 68px)`, 1.04 line height, -3.7px tracking, with explicit breakpoint adjustments (70px above 1500px; 53px at 1100px; 45px at 850px; fluid 46–62px below 660px; 43px below 360px). Section headings use 23–35px and weight 500; rule headings use 18–21px. Body copy is 17px in the wide hero, 14–15px at narrow widths, and 13–14px in supporting explanations. Utility text is at least 12px.

Large amount inputs use 31px/35px; staking inputs and the mobile slippage selector use 16px. Number metrics are 22–29px with tabular numerals. Headings use balanced wrapping; paragraphs use pretty wrapping and 1.6 line height. Rule descriptions are capped at 36ch (45ch on mobile). Full transaction amounts wrap in the review rather than truncate. Shortened connected addresses can be inspected in the wallet; all fixed contract addresses have explorer links.

## Layout

`src/styles.css` defines `.wrap` at a maximum 1240px with 48px wide-screen side margins; these become 32px at 1100px, 20px at 850px, and 16px below 360px. Spacing uses repeated 4, 8, 12, 16, 24, 32, 48 and 64px steps, with component-specific optical adjustments.

- `.hero`: a 1.52fr/1fr grid, 64px gap, trade column minimum 345px; gaps and minima reduce as the available width shrinks. It becomes one column below 660px. The trade card stays in normal document flow.
- `.metrics-grid`: four columns; two columns at 850px. Separators reset appropriately for the second row.
- `.community-grid`: vote and personal panels at 1.2fr/1fr, 24px gap; one column below 660px.
- `.rules-grid`: three columns; one column below 660px, with each illustration in a 48px side column.
- Header: desktop logo/navigation/wallet row; navigation wraps to its own row below 660px.
- Footer and notifications wrap rather than push the page horizontally.

Additional breakpoints at 1100px, 850px, 660px and 360px tune typography, padding, and the illustration crop. A 1500px rule modestly enlarges the hero. The SVG fills and clips within its panel. Tablet and mobile offsets keep the sun visible while allowing part of the wave to extend beyond the frame. Labels remain inside the image.

Production overflow checks passed at 1440, 850, 660, 390 and 320 CSS pixels. Screenshots were inspected at desktop, tablet, 390px and 320px. Native browser zoom and translated/RTL versions were not verified; only English LTR is implemented.

## Elevation & Depth

The interface is primarily flat. One-pixel borders define the cards, fields and separators. The trade card uses a subtle offset `0 5px 0 -1px #e8e9df` shadow. Selected segmented controls use `0 1px 4px #22271f0d`. The modal uses `0 20px 80px #22271f33`, a `#18221980` backdrop and 4px backdrop blur. Notifications use `0 4px 20px #22271f22` at z-index 20. Native modal top-layer behavior keeps it above notifications and makes the background inert.

## Shapes

`--radius-card: 20px` and `--radius-control: 10px` are the shared shape tokens. The illustration uses 16px; inset amount fields and notifications use 12px. Segmented controls use 11px outer/8px inner radii with 4px padding. Progress tracks use 4–5px. The logo, token markers and personal symbol use circles. There are no decorative gradients or full-page animation layers.

## Components

`src/App.tsx` contains page-local patterns rather than a general-purpose component library:

- **`External`**: real external anchors, arrow cue, `rel="noreferrer"`, and an accessible new-tab note.
- **`Metric`**: label/value/explanation with decorative icon and stable numeric typography. Unknown data uses a dash; stale reads are labeled and pause dependent actions.
- **Buttons**: `.button`, `.primary`, `.small`, `.full`, `.text-button`. The lime primary fill belongs to trading or the current review dialog. Vote choices use quieter outlined/tinted surfaces. Most action targets are 44–50px high; dense presets are 28px desktop/34px mobile.
- **Trade form**: native labels/input/select; pressed buttons for buy/sell selection within a named group; input errors associated by `aria-describedby` and `aria-invalid`. Errors focus the amount field. Review computes the output and minimum; there is no fabricated live price.
- **Vote panel**: labeled yes/no bar, neutral empty bar, accessible quorum progress, deadline-aware vote availability, and potential next-day allowance. Color supplements labels and values.
- **Deposit panel**: explicit disclosure with `aria-expanded`; deposit/withdraw choices, exact amount, available-balance Max button, and visible lock reason.
- **Review dialog**: native `<dialog>`, heading, exact amounts, network, minimum output and deadline, confirm/cancel, pending status and receipt link. Escape closes when idle. Explicit Tab wrapping complements the native modal; closing restores focus. A stale close event cannot dismiss a newly reopened review. Busy operations disable repeated confirmation.
- **Notifications/activity**: a stable polite status region, persistent dismiss control, and session-only confirmed action list. Errors remain available rather than auto-dismiss.
- **`WaveScene` / `WaveMark`** in `src/WaveScene.tsx`: original decorative SVG, no remote raster asset or animation dependency.

Interactive motion is limited to 120ms background/press transitions, `scale(.96)` on press, and 150ms progress-width changes. All transitions live inside `prefers-reduced-motion: no-preference`. Hover treatments are gated by `(hover: hover)`. There is no autoplay. Forced-colors rules preserve system focus and control outlines.

## Do’s and Don’ts

- Start additions inside `.wrap`, reuse the color role tokens and existing button/form patterns, and preserve the DOM reading order when changing grids.
- Keep transactional copy literal. Use the surf voice in headings and low-stakes confirmation copy, not to hide approvals, limits or errors.
- Show unknown live values as unknown. Keep practice state, balances and confirmation labels separate from live mode.
- Keep a single clear trade action. Make the review’s exact amount and minimum output visible before the wallet request.
- Retain native controls, persistent field labels, keyboard outlines, reduced-motion support, and plain-language unavailable states.
- For another section, use the section-kicker/heading hierarchy, normal document flow, and the existing 660px stacking behavior. Inspect it at 320px before exporting.
- Do not replace relative assets with remote fonts or root-relative paths, add unsupported performance claims, or imply that a practice result is an onchain receipt.

Design review coverage and remaining limits are recorded separately in `artifacts/validation.md`.
