import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(
  process.env.SURF_TEST_DEPENDENCIES
    ? `${process.env.SURF_TEST_DEPENDENCIES}/package.json`
    : import.meta.url,
);
const { chromium } = require("playwright");
const { default: AxeBuilder } = require("@axe-core/playwright");
const root = resolve("dist");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (!url.pathname.startsWith("/preview/")) throw Error();
    const file = resolve(
      root,
      decodeURIComponent(url.pathname.slice(9)) || "index.html",
    );
    if (!file.startsWith(root + "/")) throw Error();
    res.setHeader(
      "Content-Type",
      types[extname(file)] || "application/octet-stream",
    );
    res.end(await readFile(file));
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/preview/`;
let browser;
let checks = 0;
const results = [];
function pass(name) {
  checks++;
  results.push(name);
  console.log(`PASS ${name}`);
}
try {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.SURF_BROWSER
      ? { executablePath: process.env.SURF_BROWSER }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  const page = await context.newPage();
  const failures = [];
  page.on("pageerror", (e) => failures.push(String(e)));
  page.on("response", (r) => {
    if (r.url().startsWith(url) && r.status() >= 400)
      failures.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(url);
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "No browser wallet found" })
    .waitFor();
  pass("Missing-wallet recovery is actionable");
  await page.getByRole("button", { name: "Try practice mode ↗" }).click();
  await page.locator(".trade-submit").click();
  await page.locator("#trade-amount[aria-invalid=true]").waitFor();
  assert.match(
    await page.locator("#trade-error").textContent(),
    /positive amount/,
  );
  assert.equal(
    await page
      .locator("#trade-amount")
      .evaluate((e) => e === document.activeElement),
    true,
  );
  pass("Empty amount produces an associated error and focuses the field");
  await page.locator("#trade-amount").fill("2");
  await page.locator(".trade-submit").click();
  assert.match(
    await page.locator("#trade-error").textContent(),
    /Not enough ETH/,
  );
  pass("Insufficient balance blocks review");
  await page.getByRole("button", { name: "0.01", exact: true }).click();
  await page.locator(".trade-submit").click();
  await page.locator("dialog[open]").waitFor();
  assert.match(await page.locator(".review-values").textContent(), /9920.15/);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("dialog").evaluate((e) => e.open), false);
  assert.equal(
    await page
      .locator(".trade-submit")
      .evaluate((e) => e === document.activeElement),
    true,
  );
  pass("Trade review shows minimum output; Escape restores trigger focus");
  await page.locator(".trade-submit").focus();
  await page.keyboard.press("Enter");
  await page.locator("dialog[open]").waitFor();
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => !!document.activeElement.closest("dialog")),
      true,
    );
  }
  pass("Native modal traps keyboard focus");
  await page.locator("dialog .primary").click();
  await page.getByText("Bought SURF", { exact: true }).waitFor();
  assert.match(await page.locator(".position-stats").textContent(), /259,970/);
  pass("Confirmed practice buy updates balance and activity");
  await page.getByRole("button", { name: "Manage voting deposit" }).click();
  await page.locator("#stake-amount").fill("100000");
  await page.locator("#stake-panel > button").click();
  await page.locator("dialog .primary").click();
  assert.match(await page.locator(".position-stats").textContent(), /100,000/);
  pass("Deposit updates voting power and wallet balance");
  await page.locator(".vote-yes").click();
  await page.locator("dialog .primary").click();
  assert.equal(await page.locator(".vote-yes").isDisabled(), true);
  assert.match(await page.locator(".vote-card").textContent(), /Vote cast/);
  assert.match(await page.locator(".quorum-row").textContent(), /100%/);
  pass("Weighted yes vote reaches quorum and blocks repeat voting");
  await page.getByRole("button", { name: "Withdraw", exact: true }).click();
  assert.equal(await page.locator("#stake-panel > button").isDisabled(), true);
  pass("Voted stake cannot be withdrawn before the day ends");
  await page.getByRole("button", { name: "Skip to next day →" }).click();
  await page.getByRole("button", { name: "Sell SURF" }).click();
  assert.equal(await page.locator(".trade-submit").isEnabled(), true);
  assert.match(
    await page.locator(".metrics-grid").textContent(),
    /Open for sells/,
  );
  pass("Next day opens the one-hour sell window after a passing vote");
  await page.locator("#trade-amount").fill("100");
  await page.locator(".trade-submit").click();
  await page.locator("dialog .primary").click();
  await page.getByText("Sold SURF", { exact: true }).waitFor();
  assert.match(await page.locator(".position-stats").textContent(), /159,870/);
  pass("Practice sell updates balances and confirmed activity");
  await page.locator("#stake-amount").fill("100000");
  await page.locator("#stake-panel > button").click();
  await page.locator("dialog .primary").click();
  await page.getByText("Withdrew SURF", { exact: true }).waitFor();
  assert.match(await page.locator(".position-stats").textContent(), /259,870/);
  pass("Unlocked stake can be withdrawn");
  await page.getByRole("link", { name: "The rules", exact: true }).click();
  assert.match(page.url(), /#how-it-works$/);
  pass("Hash navigation works beneath the static hosting subpath");
  if (
    await page.getByRole("button", { name: "Dismiss notification" }).isVisible()
  )
    await page.getByRole("button", { name: "Dismiss notification" }).click();
  const viewportResults = [];
  for (const width of [1440, 850, 660, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(() => scrollTo(0, 0));
    const bounds = await page.evaluate(() => ({
      viewport: innerWidth,
      page: document.documentElement.scrollWidth,
    }));
    assert.ok(
      bounds.page <= bounds.viewport,
      `${width}px overflow: ${JSON.stringify(bounds)}`,
    );
    viewportResults.push(bounds);
  }
  pass("No horizontal page overflow at 1440, 850, 660, 390 and 320 CSS px");
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  await readFile("dist/index.html").then((b) =>
    assert.ok(b.toString().includes("./assets/")),
  );
  await import("node:fs/promises").then((fs) =>
    fs.writeFile(
      "artifacts/accessibility-results.json",
      JSON.stringify(
        {
          viewport: 320,
          violations: axe.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodes: v.nodes.map((n) => ({
              html: n.html,
              failureSummary: n.failureSummary,
            })),
          })),
          incomplete: axe.incomplete.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => ({
              html: n.html,
              failureSummary: n.failureSummary,
            })),
          })),
          passes: axe.passes.length,
        },
        null,
        2,
      ),
    ),
  );
  assert.equal(
    axe.violations.length,
    0,
    JSON.stringify(
      axe.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.html),
      })),
    ),
  );
  pass(
    "Automated accessibility scan: zero violations in the tested 320px practice state",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .locator(".primary")
      .first()
      .evaluate((e) => getComputedStyle(e).transitionDuration),
    "0s",
  );
  pass("Reduced motion removes button and progress transitions");
  await page.getByRole("button", { name: "← Back to live pool" }).click();
  assert.equal(await page.locator(".activity-list li").count(), 0);
  assert.match(await page.locator(".position-stats").textContent(), /—/);
  pass("Practice data never becomes a real account balance or live activity");
  assert.deepEqual(failures, []);
  pass("No uncaught application errors or failed local resources");
  const walletPage = await context.newPage();
  await walletPage.addInitScript(() => {
    const handlers = {};
    window.testWallet = {
      reject: true,
      chain: "0x1",
      switches: 0,
      sent: 0,
      handlers,
    };
    window.ethereum = {
      on: (name, fn) => {
        handlers[name] = fn;
      },
      removeListener: (name) => {
        delete handlers[name];
      },
      request: async ({ method }) => {
        const state = window.testWallet;
        if (method === "eth_requestAccounts" && state.reject)
          throw { code: 4001, message: "User rejected" };
        if (method === "eth_requestAccounts" || method === "eth_accounts")
          return ["0x1111111111111111111111111111111111111111"];
        if (method === "eth_chainId") return state.chain;
        if (method === "wallet_switchEthereumChain") {
          state.switches++;
          state.chain = "0xaa36a7";
          handlers.chainChanged?.(state.chain);
          return null;
        }
        if (method === "eth_sendTransaction") {
          state.sent++;
          throw Error("No real transactions are allowed in this test.");
        }
        throw Error("Unexpected wallet method: " + method);
      },
    };
  });
  await walletPage.goto(url);
  await walletPage
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await walletPage
    .getByRole("status")
    .filter({ hasText: "Request declined" })
    .waitFor();
  pass("Rejected wallet request leaves an actionable message");
  await walletPage.evaluate(() => {
    window.testWallet.reject = false;
  });
  await walletPage
    .getByRole("button", { name: "Connect wallet", exact: true })
    .click();
  await walletPage.getByRole("button", { name: /Disconnect/ }).waitFor();
  assert.equal(await walletPage.evaluate(() => window.testWallet.switches), 1);
  pass("Wrong network requests a switch to Sepolia before connection");
  await walletPage.evaluate(() =>
    window.testWallet.handlers.accountsChanged?.([]),
  );
  await walletPage
    .getByRole("button", { name: "Connect wallet", exact: true })
    .waitFor();
  assert.match(await walletPage.locator(".position-stats").textContent(), /—/);
  assert.equal(await walletPage.evaluate(() => window.testWallet.sent), 0);
  pass(
    "Wallet account changes clear balances and require reconnection; no transactions sent by tests",
  );
  await walletPage.close();
  // Deliberately block only network RPC calls to verify an offline static host.
  const offline = await context.newPage();
  await offline.route(
    /ethereum-sepolia-rpc\.publicnode\.com|sepolia\.drpc\.org/,
    (r) => r.abort(),
  );
  await offline.goto(url);
  await offline
    .getByText("Pool data unavailable.", { exact: true })
    .waitFor({ timeout: 30000 });
  assert.equal(await offline.locator(".vote-yes").isDisabled(), true);
  await offline.getByRole("button", { name: "Try practice mode ↗" }).click();
  assert.equal(await offline.locator(".trade-submit").isEnabled(), true);
  pass("RPC failure pauses live voting; local practice remains available");
  await offline.close();
  await import("node:fs/promises").then((fs) =>
    fs.writeFile(
      "artifacts/interaction-results.json",
      JSON.stringify(
        {
          checks,
          results,
          viewports: viewportResults,
          uncaughtOrLocalResourceErrors: failures,
        },
        null,
        2,
      ),
    ),
  );
  console.log(`${checks} browser checks passed.`);
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
