import assert from "node:assert/strict";
const root = process.env.SURF_CHECK_MODULES;
const { amount, practice, sample, passed, DAY, HOUR } = await import(
  root ? `${root}/model.mjs` : "../src/model.ts"
);
let checks = 0;
function test(name, fn) {
  fn();
  checks++;
  console.log(`PASS ${name}`);
}
const unit = 10n ** 18n;
test("Exact decimal parsing preserves 18 decimals", () =>
  assert.equal(amount("0.000000000000000001"), 1n));
test("Reject invalid, zero, negative, exponent, precision and oversized input", () => {
  for (const value of [
    "",
    "0",
    "-1",
    "1e3",
    "NaN",
    "Infinity",
    "1.1234567890123456789",
    "9999999999999999999999999999999999",
  ])
    assert.throws(() => amount(value));
});
test("Majority and quorum are both required; ties and no votes fail", () => {
  assert.equal(
    passed({ yes: 50n, no: 50n, quorum: 5n, hasVotes: true }),
    false,
  );
  assert.equal(passed({ yes: 6n, no: 1n, quorum: 8n, hasVotes: true }), false);
  assert.equal(passed({ yes: 6n, no: 1n, quorum: 7n, hasVotes: true }), true);
  assert.equal(passed({ yes: 6n, no: 1n, quorum: 7n, hasVotes: false }), false);
});
test("Buying adjusts both balances and actual bought output", () => {
  const s = sample(),
    r = practice(s, { type: "buy", amount: unit / 100n });
  assert.equal(r.balance - s.balance, 9970n * unit);
  assert.equal(r.bought - s.bought, 9970n * unit);
  assert.equal(s.eth - r.eth, unit / 100n);
  assert.throws(() => practice(s, { type: "buy", amount: 2n * unit }));
});
test("Deposit, weighted vote, withdrawal lock and duplicate vote", () => {
  let s = sample();
  s = practice(s, { type: "deposit", amount: 100000n * unit });
  const yes = s.yes;
  s = practice(s, { type: "vote", support: true });
  assert.equal(s.yes - yes, 100000n * unit);
  assert.equal(s.lockedUntil, s.genesis + (s.day + 1) * DAY);
  assert.throws(() => practice(s, { type: "vote", support: true }));
  assert.throws(() => practice(s, { type: "withdraw", amount: unit }));
});
test("Zero stake, invalid deposit and closed sell fail", () => {
  const s = sample();
  assert.throws(() => practice(s, { type: "vote", support: true }));
  assert.throws(() => practice(s, { type: "deposit", amount: s.balance + 1n }));
  assert.throws(() => practice(s, { type: "deposit", amount: 0n }));
  assert.throws(() => practice(s, { type: "sell", amount: unit }));
});
test("Passing vote opens next day and sets 50% aggregate allowance", () => {
  let s = sample();
  s = practice(s, { type: "deposit", amount: 100000n * unit });
  s = practice(s, { type: "vote", support: true });
  const before = s;
  s = practice(s, { type: "next" });
  assert.equal(s.open, true);
  assert.equal(s.allowance, before.bought / 2n);
  assert.equal(s.remaining, s.allowance);
  assert.equal(s.voted, false);
  assert.equal(s.bought, 0n);
  assert.equal(s.yes, 0n);
  const r = practice(s, { type: "sell", amount: 100n * unit });
  assert.equal(r.remaining, s.remaining - 100n * unit);
  assert.equal(r.sold, 100n * unit);
  assert.throws(() =>
    practice(
      { ...s, balance: s.remaining + unit },
      { type: "sell", amount: s.remaining + 1n },
    ),
  );
  const w = practice(s, { type: "withdraw", amount: s.stake });
  assert.equal(w.stake, 0n);
});
test("Sell window closes exactly at one hour", () => {
  let s = sample();
  s = {
    ...s,
    open: true,
    remaining: 100n * unit,
    timestamp: s.genesis + s.day * DAY + HOUR,
  };
  assert.throws(() => practice(s, { type: "sell", amount: unit }));
  s.timestamp--;
  assert.doesNotThrow(() => practice(s, { type: "sell", amount: unit }));
});
test("Failed vote and unused allowance do not carry over", () => {
  const s = practice(sample(), { type: "next" });
  assert.equal(s.open, false);
  assert.equal(s.remaining, 0n);
  const next = practice(
    { ...s, open: true, remaining: unit },
    { type: "next" },
  );
  assert.equal(next.remaining, 0n);
  assert.equal(next.allowance, 0n);
});
console.log(`${checks} model checks passed.`);
const { encodeSwap, expectedPool } = await import(
  root ? `${root}/chain.mjs` : "../src/chain.ts"
);
const { createRequire } = await import("node:module");
const require = createRequire(
  process.env.SURF_TEST_DEPENDENCIES
    ? `${process.env.SURF_TEST_DEPENDENCIES}/package.json`
    : import.meta.url,
);
const { decodeAbiParameters, parseAbiParameters } = require("viem");
test("Universal Router buy preserves pool, precision, slippage and refund command", () => {
  const n = 123456789123456789n,
    minimum = 98765432123456789n;
  const encoded = encodeSwap(true, n, minimum);
  assert.equal(encoded.commands, "0x1004");
  assert.equal(encoded.inputs.length, 2);
  const [actions, params] = decodeAbiParameters(
    parseAbiParameters("bytes,bytes[]"),
    encoded.inputs[0],
  );
  assert.equal(actions, "0x060c0f");
  const [swap] = decodeAbiParameters(
    parseAbiParameters(
      "((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,bytes hookData)",
    ),
    params[0],
  );
  assert.equal(swap.amountIn, n);
  assert.equal(swap.amountOutMinimum, minimum);
  assert.equal(swap.zeroForOne, true);
  assert.equal(
    swap.poolKey.hooks.toLowerCase(),
    "0x4208fa0242a945b3156d60cdacee79030a5e68c0",
  );
  assert.equal(swap.poolKey.fee, 3000);
  assert.equal(swap.poolKey.tickSpacing, 60);
  assert.equal(swap.hookData, "0x");
  const [currency, maximum] = decodeAbiParameters(
    parseAbiParameters("address,uint256"),
    params[1],
  );
  assert.equal(currency, "0x0000000000000000000000000000000000000000");
  assert.equal(maximum, n);
  assert.equal(expectedPool.length, 66);
});
test("Universal Router sell uses SURF as input and native ETH as output", () => {
  const encoded = encodeSwap(false, unit, 99n);
  assert.equal(encoded.commands, "0x10");
  assert.equal(encoded.inputs.length, 1);
  const [, params] = decodeAbiParameters(
    parseAbiParameters("bytes,bytes[]"),
    encoded.inputs[0],
  );
  const [currency, n] = decodeAbiParameters(
    parseAbiParameters("address,uint256"),
    params[1],
  );
  assert.equal(
    currency.toLowerCase(),
    "0x6c9f29f7115092064d29d7b86d12836494982805",
  );
  assert.equal(n, unit);
  const [output, minimum] = decodeAbiParameters(
    parseAbiParameters("address,uint256"),
    params[2],
  );
  assert.equal(output, "0x0000000000000000000000000000000000000000");
  assert.equal(minimum, 99n);
});
console.log(`${checks} total model and router checks passed.`);
