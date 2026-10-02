# SurfSurf

A responsive, wallet-connected website for the [SurfSurf launch](https://explorer.imd.fun/jobs/18a1a874-ecfe-44e9-82db-1dd937635160#deployed). The visual direction combines TokenWorks’ understated typography and experimental character with a cream, lime, and sea-green surf identity. The finished static site is included in **`dist/`**.

## Run locally

Use **Node.js 24** and npm. No credentials, environment file, backend, or contract deployment are needed.

```sh
npm ci
npm run dev
```

Preview the supplied production export:

```sh
npm run preview -- --host 127.0.0.1
```

Open the URL printed by Vite. To serve without installing dependencies, use `python3 -m http.server 4173 --directory dist` and visit `http://localhost:4173`.

## Rebuild and validate

```sh
npm run typecheck
npm run build
npm run check:model
npx playwright install chromium
npm run check:browser
node scripts/check-submission.mjs
```

The browser check creates and closes its own local server, serving the actual export under `/preview/`. It exercises practice transactions, deposit locks, votes, daily rollover, modal keyboard behavior, network failures, and mocked wallet lifecycle events. It also scans accessibility and checks reflow at 1440, 850, 660, 390, and 320 CSS pixels. It never submits an onchain transaction. A compatible existing browser can be selected with `SURF_BROWSER=/absolute/path/to/chrome`.

`npm run build` replaces `dist/`. Run it after changing source or public assets. Keep the complete export, source, package manifest, and lockfile together in the submission. `dist/` is intentionally **not** ignored.

## Publish

Upload **the contents of `dist/`**, including `assets/`, `licenses/`, and `favicon.svg`, to your static host, IPFS directory, or gateway-backed site. Serve `index.html` as the directory index. No build step, SPA route rewrite, secret, or API server is required on the host.

Vite uses `base: './'`. Script, stylesheet, font, and icon URLs are relative, and navigation uses section hashes; the same export works at `/` or a directory such as `/surfsurf/`. Use HTTPS for browser wallets. If adding a content security policy, allow RPC connections to `https://ethereum-sepolia-rpc.publicnode.com` and `https://sepolia.drpc.org`, alongside same-origin local assets. The site’s inline SVG art and React-managed inline progress widths must also remain supported.

## What works

- **Live surf report:** reads the verified hook, token, pool ID, and PoolManager at one block; refreshes every 15 seconds while visible. Shows the pool day, bought SURF, quorum, yes/no weights, sell status, allowance, and countdowns. A failed or stale read pauses dependent actions.
- **Wallet:** injected EIP-1193 browser wallets, Sepolia switching/adding, disconnection, and clearing account state when the wallet account or network changes. No seed phrases, WalletConnect service, or private keys.
- **Buy/sell:** Uniswap v4 exact-input quote, review, minimum received from the selected slippage, five-minute deadline, simulation and gas estimation before signing, exact-amount token approvals, bounded Permit2 allowance, receipt confirmation, and explorer links. Sells require an open window and sufficient remaining aggregate allowance. A final read rechecks the window before submission. Unused native input is swept back to the sender.
- **Governance:** approve/deposit SURF, withdraw unlocked deposits, and vote once per wallet/day with the deposited balance. Reviews show vote weight and the voting round. A changed round or deposit requires a new review. The actual contract assigns a vote to the day it is mined.
- **Practice pool:** separate in-memory sample state, a clearly labeled practice wallet, illustrative fixed exchange rate, trades, deposits, both vote choices, withdrawal locks, and a “Skip to next day” control. Try buying `0.01` ETH, depositing `100000` SURF, voting to open sells, then advancing the day and selling `100` SURF. Practice data never populates live balances or live activity.
- **Recent ripples:** confirmed actions from this page session only. It is not an indexed market-wide history. Refreshing the page resets practice state and local activity.

## Contract configuration and rules

Addresses are public constants in [`src/contracts.ts`](src/contracts.ts). They come from the supplied deployment record and [Uniswap’s official Sepolia deployment list](https://developers.uniswap.org/docs/protocols/v4/deployments#sepolia-11155111).

| Contract | Sepolia address |
| --- | --- |
| SurfToken | `0x6c9f29f7115092064d29d7b86d12836494982805` |
| BuyGateHook | `0x4208fa0242a945b3156d60cdacee79030a5e68c0` |
| PoolManager | `0xe03a1074c86cfedd5c142c4f04f1a1536e203543` |
| Universal Router, original v4 ABI | `0x3a9d48ab9751398bbfa63ad67599bb04e4bdf98b` |
| V4Quoter | `0x61b3f2011a92d183c7dbadbda940a7555ccf9227` |
| Permit2 | `0x000000000022d473030f116ddee9f6b43ac78ba3` |

Chain ID is **11155111**. The pool pairs native ETH with SURF at fee `3000` and tick spacing `60`. The original router is intentionally pinned: its swap tuple does not contain newer `minHopPriceX36` fields. Routing follows [Uniswap’s v4 swap guide](https://developers.uniswap.org/docs/protocols/v4/guides/swapping/routing).

The [deployed contract source](https://github.com/identity-md-launches/launch-575-can-buys-only/tree/a1aaff38c15cc288cae3ca6db600b3027ec3c005) is authoritative: a day is 86,400 seconds from pool genesis, not UTC midnight. A vote needs **both** `yes > no` and participation of at least the quorum. Quorum is 5% of circulating supply, fixed at the first vote of the day; before then the UI labels it as an estimate. A passing vote opens only the first 3,600 seconds of the following day. Total sells are capped at half the preceding day’s bought SURF, first come, first served, with no rollover. Day zero has no sell window. Voting locks deposited tokens until the day ends. These restrictions apply to this pool, not token transfers or other markets.

## Verification results and limits

Validated on **2026-10-02** using Node 24.21.0, TypeScript 5.9.3, Vite 7.1.12, and Chromium. A clean installation outside the repository verified the documented `npm ci`, typecheck, build, and model checks. Dependencies remained outside this repository during development; the optional `SURF_DEPENDENCIES` Vite setting only supports that constrained worker layout and is unnecessary for normal installs.

The final checks include 11 model/router checks, 22 browser interaction checks, zero automated accessibility violations in the tested 320px practice state, and manual inspection of desktop, tablet, mobile, and the focused review dialog. Local production resources loaded at a subpath. Public Sepolia reads and a real v4 quote succeeded; a buy through the configured router also succeeded in `eth_call` with a funded state override. **No real transaction was signed or broadcast.** See [`artifacts/validation.md`](artifacts/validation.md) for commands, corrections, evidence, and exact coverage.

Live deposit/vote/withdraw/sell settlement with a funded wallet remains unverified; the sell window was closed during verification. Public RPCs and wallet extensions are external dependencies. Quotes, allowance and liquidity can change before a transaction is mined. An approval is a separate transaction and can remain confirmed if a later action is declined or expires. When receipt confirmation times out, check the provided explorer link before retrying. There is no backend transaction recovery after a page reload. Practice mode remains usable without an RPC or wallet and is not a price prediction.

Screen-reader sessions, physical mobile devices, browser-native 200% zoom, all wallet brands, and cross-browser coverage were not performed. Automated accessibility scans are limited evidence, not a certification.

## Files and size

- `src/`: React/TypeScript application, contract interface, transaction integration, practice model, CSS, and local WOFF2 fonts.
- `public/`: original favicon and font/runtime dependency license notices.
- `dist/`: ready-to-publish static export.
- `scripts/`: repeatable model, browser, and submission checks.
- `DESIGN.md`: final implemented design system and responsive behavior.
- `artifacts/`: validation record, JSON results, screenshots, attribution, and explicit submission path budgets.

The submission limit is 8,388,608 bytes. `.gitignore` has an explicit **512-byte path budget** in `artifacts/submission-budget.json`. Dependencies, caches, scratch work, and transient browser output are excluded at every nesting level. The submission checker records actual file bytes, a 64 KiB packaging reserve, and export hashes in `artifacts/submission-results.json`. No dependency archives or submodules are used.
