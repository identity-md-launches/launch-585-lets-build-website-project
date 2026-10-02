import { formatUnits, parseUnits } from "viem";
export const DAY = 86400;
export const HOUR = 3600;
export type Snapshot = {
  day: number;
  genesis: number;
  timestamp: number;
  fetchedAt: number;
  block: bigint;
  yes: bigint;
  no: bigint;
  quorum: bigint;
  hasVotes: boolean;
  bought: bigint;
  sold: bigint;
  previousBought: bigint;
  previousPassed: boolean;
  open: boolean;
  remaining: bigint;
  allowance: bigint;
  balance: bigint;
  eth: bigint;
  stake: bigint;
  lockedUntil: number;
  voted: boolean;
};
export type Activity = {
  id: string;
  text: string;
  detail: string;
  hash?: `0x${string}`;
};
export function amount(value: string): bigint {
  if (
    !/^(?:\d+\.?\d*|\.\d+)$/.test(value.trim()) ||
    (value.split(".")[1]?.length ?? 0) > 18
  )
    throw new Error("Enter a positive amount with up to 18 decimal places.");
  const n = parseUnits(value, 18);
  if (n <= 0n || n >= 2n ** 128n)
    throw new Error(
      "Enter an amount greater than zero and smaller than the pool limit.",
    );
  return n;
}
export function fmt(value: bigint | undefined, digits = 2): string {
  if (value === undefined) return "—";
  const n = Number(formatUnits(value, 18));
  if (n > 0 && n < 0.0001) return "<0.0001";
  return Intl.NumberFormat("en", {
    maximumFractionDigits: digits,
    notation: n >= 1000000 ? "compact" : "standard",
  }).format(n);
}
export function passed(
  s: Pick<Snapshot, "yes" | "no" | "quorum" | "hasVotes">,
) {
  return s.hasVotes && s.yes > s.no && s.yes + s.no >= s.quorum;
}
export function countdown(seconds: number) {
  const n = Math.max(0, Math.floor(seconds));
  return [Math.floor(n / 3600), Math.floor(n / 60) % 60, n % 60]
    .map((x) => String(x).padStart(2, "0"))
    .join(":");
}
export function sample(): Snapshot {
  const now = Math.floor(Date.now() / 1000);
  return {
    day: 12,
    genesis: now - DAY * 12 - 55800,
    timestamp: now,
    fetchedAt: Date.now(),
    block: 0n,
    yes: parseUnits("684000", 18),
    no: parseUnits("216000", 18),
    quorum: parseUnits("1000000", 18),
    hasVotes: true,
    bought: parseUnits("2480000", 18),
    sold: 0n,
    previousBought: parseUnits("1860000", 18),
    previousPassed: false,
    open: false,
    remaining: 0n,
    allowance: parseUnits("930000", 18),
    balance: parseUnits("250000", 18),
    eth: parseUnits("1", 18),
    stake: 0n,
    lockedUntil: 0,
    voted: false,
  };
}
export type PracticeAction =
  | { type: "buy" | "sell" | "deposit" | "withdraw"; amount: bigint }
  | { type: "vote"; support: boolean }
  | { type: "next" };
export function practice(s: Snapshot, action: PracticeAction): Snapshot {
  const n = "amount" in action ? action.amount : 0n;
  if ("amount" in action && n <= 0n)
    throw new Error("Enter an amount greater than zero.");
  const fresh = { ...s, fetchedAt: Date.now() };
  switch (action.type) {
    case "buy": {
      if (n > s.eth)
        throw new Error("Not enough practice ETH. Try a smaller amount.");
      const out = (n * 1000000n * 997n) / 1000n;
      return {
        ...fresh,
        eth: s.eth - n,
        balance: s.balance + out,
        bought: s.bought + out,
      };
    }
    case "sell":
      if (!s.open || s.timestamp >= s.genesis + s.day * DAY + HOUR)
        throw new Error(
          "Sells are closed. Pass today’s vote to open tomorrow’s window.",
        );
      if (n > s.remaining)
        throw new Error("This amount exceeds the shared sell allowance.");
      if (n > s.balance) throw new Error("Not enough SURF in your wallet.");
      return {
        ...fresh,
        balance: s.balance - n,
        eth: s.eth + (n * 997n) / 1000000000n,
        remaining: s.remaining - n,
        sold: s.sold + n,
      };
    case "deposit":
      if (n > s.balance) throw new Error("Not enough SURF in your wallet.");
      return { ...fresh, balance: s.balance - n, stake: s.stake + n };
    case "withdraw":
      if (s.timestamp < s.lockedUntil)
        throw new Error(
          "Your voting deposit is locked until the end of this day.",
        );
      if (n > s.stake)
        throw new Error("This amount exceeds your deposited SURF.");
      return { ...fresh, balance: s.balance + n, stake: s.stake - n };
    case "vote":
      if (s.voted)
        throw new Error("You have already voted today. Come back next round.");
      if (s.stake === 0n)
        throw new Error("Deposit SURF first to give your vote weight.");
      return {
        ...fresh,
        voted: true,
        hasVotes: true,
        yes: s.yes + (action.support ? s.stake : 0n),
        no: s.no + (action.support ? 0n : s.stake),
        lockedUntil: s.genesis + (s.day + 1) * DAY,
      };
    case "next": {
      const opens = passed(s);
      const allowance = s.bought / 2n;
      return {
        ...fresh,
        day: s.day + 1,
        timestamp: s.genesis + (s.day + 1) * DAY,
        previousBought: s.bought,
        previousPassed: opens,
        open: opens,
        remaining: opens ? allowance : 0n,
        allowance,
        yes: 0n,
        no: 0n,
        hasVotes: false,
        bought: 0n,
        sold: 0n,
        voted: false,
      };
    }
  }
}
