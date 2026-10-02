import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { formatUnits } from "viem";
import type { Address, Hex } from "viem";
import {
  connect,
  readSnapshot,
  quote,
  govern,
  trade,
  errorText,
} from "./chain";
import {
  DAY,
  HOUR,
  amount,
  fmt,
  countdown,
  passed,
  sample,
  practice,
} from "./model";
import type { Snapshot, Activity, PracticeAction } from "./model";
import { TOKEN, HOOK, PROJECT, REPO, EXPLORER } from "./contracts";
import WaveScene, { WaveMark } from "./WaveScene";

type Review = {
  kind: "buy" | "sell" | "deposit" | "withdraw" | "vote";
  n: bigint;
  output?: bigint;
  minimum?: bigint;
  support?: boolean;
  deadline: number;
  day: number;
  mode: boolean;
  account?: Address;
};
const Arrow = () => <span aria-hidden="true">↗</span>;
function External({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className}>
      {children} <Arrow />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
function Metric({
  label,
  value,
  foot,
  icon,
}: {
  label: string;
  value: string;
  foot: string;
  icon: string;
}) {
  return (
    <div className="metric">
      <span className="metric-label">
        {label}
        <span aria-hidden="true">{icon}</span>
      </span>
      <strong>{value}</strong>
      <span className="metric-foot">{foot}</span>
    </div>
  );
}
function App() {
  const [demo, setDemo] = useState(false);
  const [practiceState, setPracticeState] = useState<Snapshot>(() => sample());
  const [live, setLive] = useState<Snapshot>();
  const [account, setAccount] = useState<Address>();
  const [connection, setConnection] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [tradeAmount, setTradeAmount] = useState("");
  const [slippage, setSlippage] = useState("0.5");
  const [tradeError, setTradeError] = useState("");
  const [stakeError, setStakeError] = useState("");
  const [stakeAmount, setStakeAmount] = useState("");
  const [stakeMode, setStakeMode] = useState<"deposit" | "withdraw">("deposit");
  const [showStake, setShowStake] = useState(false);
  const [notice, setNotice] = useState("");
  const [txHash, setTxHash] = useState<Hex>();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [review, setReview] = useState<Review>();
  const [reviewError, setReviewError] = useState("");
  const [busy, setBusy] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [nav, setNav] = useState("overview");
  const dialog = useRef<HTMLDialogElement>(null);
  const tradeInput = useRef<HTMLInputElement>(null);
  const stakeInput = useRef<HTMLInputElement>(null);
  const requestId = useRef(0);
  const generation = useRef(0);
  const pending = useRef(false);
  const s = demo ? practiceState : live;
  const connected = demo || !!account;
  const clock = s ? s.timestamp + Math.floor((now - s.fetchedAt) / 1000) : 0;
  const fresh = demo || !!(s && !loadError && now - s.fetchedAt < 45000);
  const dayEnd = s ? s.genesis + (s.day + 1) * DAY : 0;
  const inDay = !!s && clock < dayEnd;
  const sellOpen =
    !!s &&
    s.open &&
    clock < s.genesis + s.day * DAY + HOUR &&
    s.remaining > 0n &&
    fresh;
  const locked = !!s && clock < s.lockedUntil;
  const ready = !!s && fresh && inDay;
  const total = s ? s.yes + s.no : 0n;
  const yesPercent = total ? Number((s!.yes * 1000n) / total) / 10 : 0;
  const quorumPercent =
    s && s.quorum > 0n
      ? Math.min(100, Number((total * 10000n) / s.quorum) / 100)
      : s?.hasVotes
        ? 100
        : 0;

  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const data = await readSnapshot(account);
      if (id === requestId.current) {
        setLive(data);
        setLoadError("");
      }
    } catch (error) {
      if (id === requestId.current) setLoadError(errorText(error));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [account]);
  useEffect(() => {
    if (demo) {
      ++requestId.current;
      return;
    }
    void refresh();
    const timer = setInterval(() => {
      if (!document.hidden) void refresh();
    }, 15000);
    return () => {
      clearInterval(timer);
      ++requestId.current;
    };
  }, [demo, refresh]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const provider = window.ethereum;
    if (!provider) return;
    const changed = () => {
      generation.current++;
      setAccount(undefined);
      setLive(undefined);
      setReview(undefined);
      setNotice(
        "Wallet changed. Reconnect to refresh your account and network.",
      );
    };
    provider.on("accountsChanged", changed);
    provider.on("chainChanged", changed);
    return () => {
      provider.removeListener("accountsChanged", changed);
      provider.removeListener("chainChanged", changed);
    };
  }, []);
  useEffect(() => {
    if (review) {
      setReviewError("");
      dialog.current?.showModal();
    } else dialog.current?.close();
  }, [review]);
  const addActivity = (text: string, detail: string, hash?: Hex) =>
    setActivities((a) =>
      [{ id: crypto.randomUUID(), text, detail, hash }, ...a].slice(0, 8),
    );
  function changeMode() {
    if (busy || quoting) return;
    generation.current++;
    setDemo(!demo);
    setReview(undefined);
    setNotice("");
    setTxHash(undefined);
    setTradeError("");
    setStakeError("");
    setActivities([]);
    setSide("buy");
    setTradeAmount("");
    setStakeAmount("");
  }
  async function connectWallet() {
    setConnection(true);
    setNotice("");
    try {
      const address = await connect();
      setAccount(address);
      setLive(undefined);
      setNotice("Wallet connected on Sepolia. Your balance is loading.");
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setConnection(false);
    }
  }
  function openReview(
    r: Omit<Review, "deadline" | "day" | "mode" | "account">,
  ) {
    setReview({
      ...r,
      day: s!.day,
      deadline: Math.floor(Date.now() / 1000) + 300,
      mode: demo,
      account,
    });
    setTxHash(undefined);
    setNotice("");
  }
  async function reviewTrade(event: FormEvent) {
    event.preventDefault();
    setTradeError("");
    if (!connected) {
      await connectWallet();
      return;
    }
    if (!ready || !s) {
      setTradeError(
        "Live pool data is unavailable or updating. Refresh before trading.",
      );
      return;
    }
    const gen = generation.current;
    try {
      const n = amount(tradeAmount);
      if (side === "sell" && !sellOpen)
        throw new Error(
          "Sells are closed. Today’s vote decides tomorrow’s window.",
        );
      if (n > (side === "buy" ? s.eth : s.balance))
        throw new Error(
          `Not enough ${side === "buy" ? "ETH" : "SURF"}. Enter a smaller amount.`,
        );
      if (side === "sell" && n > s.remaining)
        throw new Error(
          "This amount exceeds the shared sell allowance. Enter a smaller amount.",
        );
      setQuoting(true);
      const output = demo
        ? side === "buy"
          ? (n * 1000000n * 997n) / 1000n
          : (n * 997n) / 1000000000n
        : await quote(side === "buy", n);
      if (gen !== generation.current) return;
      const minimum =
        (output * BigInt(10000 - Math.round(Number(slippage) * 100))) / 10000n;
      if (minimum === 0n)
        throw new Error(
          "This trade is too small to receive output. Enter a larger amount.",
        );
      openReview({ kind: side, n, output, minimum });
    } catch (error) {
      if (gen === generation.current) {
        setTradeError(errorText(error));
        tradeInput.current?.focus();
      }
    } finally {
      setQuoting(false);
    }
  }
  function reviewStake(event: FormEvent) {
    event.preventDefault();
    setStakeError("");
    try {
      if (!ready || !s)
        throw new Error("Refresh pool data before managing your deposit.");
      const n = amount(stakeAmount);
      if (stakeMode === "withdraw" && locked)
        throw new Error("Your voting deposit unlocks at the end of this day.");
      if (n > (stakeMode === "deposit" ? s.balance : s.stake))
        throw new Error("This amount exceeds your available SURF.");
      openReview({ kind: stakeMode, n });
    } catch (error) {
      setStakeError(errorText(error));
      stakeInput.current?.focus();
    }
  }
  async function vote(support: boolean) {
    if (!connected) {
      await connectWallet();
      return;
    }
    if (!ready || !s) {
      setNotice("Refresh pool data before voting.");
      return;
    }
    if (s.voted) {
      setNotice(
        "You already voted today. Your next vote is available next round.",
      );
      return;
    }
    if (s.stake === 0n) {
      setShowStake(true);
      setNotice("Deposit SURF to activate your voting power.");
      document
        .getElementById("your-surf")
        ?.scrollIntoView({ behavior: "instant" });
      setTimeout(() => stakeInput.current?.focus(), 0);
      return;
    }
    openReview({ kind: "vote", support, n: s.stake });
  }
  async function confirm() {
    if (!review || pending.current) return;
    pending.current = true;
    setBusy(true);
    setReviewError("");
    setNotice("");
    const r = review;
    const gen = generation.current;
    const label =
      r.kind === "vote"
        ? r.support
          ? "Voted to open sells"
          : "Voted to keep buys only"
        : (
            {
              buy: "Bought SURF",
              sell: "Sold SURF",
              deposit: "Deposited SURF",
              withdraw: "Withdrew SURF",
            } as const
          )[r.kind];
    try {
      if (r.mode !== demo || (!demo && r.account !== account))
        throw new Error(
          "Your session changed. Close this review and start again.",
        );
      let hash: Hex | undefined;
      if (demo) {
        const current = { ...practiceState, timestamp: clock };
        const action: PracticeAction =
          r.kind === "vote"
            ? { type: "vote", support: r.support! }
            : { type: r.kind, amount: r.n };
        setPracticeState(practice(current, action));
      } else {
        if (!account) throw new Error("Reconnect your wallet to continue.");
        const progress = (message: string, h?: Hex) => {
          setNotice(message);
          if (h) setTxHash(h);
        };
        if (r.kind === "buy" || r.kind === "sell")
          hash = await trade(
            account,
            r.kind === "buy",
            r.n,
            r.minimum!,
            r.deadline,
            progress,
          );
        else
          hash = await govern(
            account,
            r.kind,
            r.kind === "vote" ? r.support! : r.n,
            progress,
            { day: r.day, stake: r.n },
          );
        if (gen === generation.current) await refresh();
      }
      addActivity(
        label,
        demo ? "Practice transaction · just now" : "Confirmed on Sepolia",
        hash,
      );
      setNotice(
        `${demo ? "Practice: " : ""}${label}. ${r.kind === "vote" ? "Your deposit is locked until this day ends." : "You’re all set."}`,
      );
      setReview(undefined);
      setTradeAmount("");
      setStakeAmount("");
      if (hash) setTxHash(hash);
    } catch (error) {
      setReviewError(errorText(error));
    } finally {
      setBusy(false);
      pending.current = false;
    }
  }
  function nextDay() {
    if (busy) return;
    const next = practice(
      { ...practiceState, timestamp: clock },
      { type: "next" },
    );
    setPracticeState(next);
    setNow(Date.now());
    setNotice(
      next.open
        ? "Practice: the vote passed. Sells are open for one hour."
        : "Practice: a new day started. Sells stay closed because the vote did not pass.",
    );
  }
  const voteDisabled = busy || !!(s?.voted && connected) || !ready;
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header wrap">
        <a href="#overview" className="logo" aria-label="SurfSurf home">
          <span className="logo-mark">
            <WaveMark />
          </span>
          surfsurf<span className="logo-star">✳</span>
        </a>
        <nav aria-label="Main navigation">
          {[
            ["overview", "The pool"],
            ["vote", "The vote"],
            ["how-it-works", "The rules"],
          ].map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              className={nav === id ? "active" : ""}
              onClick={() => setNav(id)}
            >
              {label}
            </a>
          ))}
        </nav>
        <button
          className="button wallet-button"
          disabled={connection || busy}
          onClick={() =>
            demo
              ? setNotice(
                  "You’re using a practice wallet. No real funds or wallet connection needed.",
                )
              : account
                ? (setAccount(undefined),
                  setLive(undefined),
                  setNotice("Wallet disconnected from this site."))
                : void connectWallet()
          }
        >
          <span className="wallet-icon" aria-hidden="true">
            ▣
          </span>
          {demo
            ? "Practice wallet"
            : connection
              ? "Connecting…"
              : account
                ? `${account.slice(0, 6)}…${account.slice(-4)} · Disconnect`
                : "Connect wallet"}
          <span aria-hidden="true">↗</span>
        </button>
      </header>
      <main id="main" className="wrap">
        <div className="network-strip">
          <span>
            <span className="status-dot" />
            An onchain experiment <span className="muted">/</span>{" "}
            <strong>Sepolia testnet</strong>
          </span>
          <button
            className="text-button"
            onClick={changeMode}
            disabled={busy || quoting}
          >
            {demo ? "← Back to live pool" : "Try practice mode ↗"}
          </button>
        </div>
        {demo && (
          <div className="practice-banner">
            <div>
              <strong>You’re in the practice pool.</strong> Try trading and
              voting with pretend tokens. No wallet or real funds.
            </div>
            <button className="button small" onClick={nextDay} disabled={busy}>
              Skip to next day →
            </button>
          </div>
        )}
        {!demo && loadError && (
          <div className="error-banner" role="alert">
            <span>
              <strong>Pool data unavailable.</strong> {loadError}
            </span>
            <button
              className="button small"
              onClick={() => void refresh()}
              disabled={loading}
            >
              {loading ? "Retrying…" : "Retry connection"}
            </button>
          </div>
        )}
        <section className="hero" id="overview" aria-labelledby="hero-title">
          <div className="hero-left">
            <div className="eyebrow">
              <span className="tiny-wave" aria-hidden="true">
                ≈
              </span>{" "}
              Buy the wave. Vote the tide.
            </div>
            <h1 id="hero-title">
              Catch a wave.
              <br />
              Have a say<span className="accent-period">.</span>
            </h1>
            <p className="hero-copy">
              A token with a twist. Buys are always on.
              <br className="desktop-break" /> Sells? That’s up to the
              community.
            </p>
            <div className="wave-panel">
              <div className="wave-tag">
                <span className="status-dot" />{" "}
                {demo
                  ? "Practice waters"
                  : fresh
                    ? "Pool is onchain"
                    : "Checking the tide…"}
              </div>
              <span className="wave-caption">
                Go with the flow.
                <br />
                Or vote to change it.
              </span>
              <WaveScene />
              <div className="wave-footer">
                <span>ETH / SURF</span>
                <span>Community powered. ↗</span>
              </div>
            </div>
          </div>
          <section className="trade-card" aria-labelledby="trade-title">
            <div className="card-heading">
              <h2 id="trade-title">Make a splash</h2>
              <span className="surf-token">
                <WaveMark size={20} /> SURF
              </span>
            </div>
            <div
              className="segmented"
              role="group"
              aria-label="Trade direction"
            >
              <button
                type="button"
                aria-pressed={side === "buy"}
                className={side === "buy" ? "selected" : ""}
                onClick={() => {
                  setSide("buy");
                  setTradeAmount("");
                  setTradeError("");
                }}
                disabled={busy || quoting}
              >
                Buy SURF <span>↗</span>
              </button>
              <button
                type="button"
                aria-pressed={side === "sell"}
                className={side === "sell" ? "selected" : ""}
                onClick={() => {
                  setSide("sell");
                  setTradeAmount("");
                  setTradeError("");
                }}
                disabled={busy || quoting}
              >
                Sell SURF <span>{sellOpen ? "↘" : "⌁"}</span>
              </button>
            </div>
            <div
              className={`trade-state ${side === "sell" && !sellOpen ? "closed" : ""}`}
            >
              <span aria-hidden="true">
                {side === "buy" ? "↗" : sellOpen ? "↘" : "◷"}
              </span>
              <span>
                {side === "buy"
                  ? "Buying is always in season."
                  : sellOpen
                    ? `${countdown(s!.genesis + s!.day * DAY + HOUR - clock)} left · ${fmt(s!.remaining)} SURF shared`
                    : "Sells are closed. Have your say below."}
              </span>
            </div>
            <form onSubmit={reviewTrade} noValidate>
              <div className="amount-box">
                <div className="field-top">
                  <label htmlFor="trade-amount">You pay</label>
                  <span>
                    Balance:{" "}
                    {connected
                      ? fmt(side === "buy" ? s?.eth : s?.balance, 4)
                      : "—"}
                  </span>
                </div>
                <div className="amount-row">
                  <input
                    ref={tradeInput}
                    id="trade-amount"
                    name="amount"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.00"
                    value={tradeAmount}
                    onChange={(e) => {
                      setTradeAmount(e.target.value);
                      setTradeError("");
                    }}
                    aria-invalid={!!tradeError}
                    aria-describedby="trade-error"
                    disabled={busy || quoting}
                  />
                  <span className="currency">
                    <span className={side === "buy" ? "eth-icon" : "surf-coin"}>
                      {side === "buy" ? "♦" : <WaveMark size={18} />}
                    </span>
                    {side === "buy" ? "ETH" : "SURF"}
                  </span>
                </div>
                <div className="quick-amounts">
                  {(side === "buy"
                    ? ["0.01", "0.05", "0.1"]
                    : ["100", "1000", "10000"]
                  ).map((n) => (
                    <button
                      type="button"
                      key={n}
                      onClick={() => {
                        setTradeAmount(n);
                        setTradeError("");
                      }}
                      disabled={busy || quoting}
                    >
                      {n}
                    </button>
                  ))}
                  <span>
                    {demo ? "Practice tokens" : "Sepolia test tokens"}
                  </span>
                </div>
              </div>
              <div className="swap-divider" aria-hidden="true">
                ↓
              </div>
              <div className="receive-box">
                <div className="field-top">
                  <span>You receive</span>
                  <span>
                    {demo ? "Illustrative rate" : "Live quote on review"}
                  </span>
                </div>
                <div className="amount-row">
                  <strong>
                    {demo &&
                    /^\d*\.?\d+$/.test(tradeAmount) &&
                    Number(tradeAmount) > 0
                      ? Intl.NumberFormat("en", {
                          maximumFractionDigits: 4,
                        }).format(
                          Number(tradeAmount) *
                            (side === "buy" ? 997000 : 0.000000997),
                        )
                      : "—"}
                  </strong>
                  <span className="currency">
                    <span className={side === "buy" ? "surf-coin" : "eth-icon"}>
                      {side === "buy" ? <WaveMark size={18} /> : "♦"}
                    </span>
                    {side === "buy" ? "SURF" : "ETH"}
                  </span>
                </div>
              </div>
              <div className="trade-details">
                <span>
                  Pool fee <strong>0.3%</strong>
                </span>
                <label htmlFor="slippage">
                  Max. slippage{" "}
                  <select
                    id="slippage"
                    value={slippage}
                    onChange={(e) => setSlippage(e.target.value)}
                    disabled={busy || quoting}
                  >
                    <option value="0.5">0.5%</option>
                    <option value="1">1%</option>
                    <option value="2">2%</option>
                  </select>
                </label>
              </div>
              <p id="trade-error" className="field-error" role="alert">
                {tradeError}
              </p>
              <button
                className="button primary trade-submit"
                disabled={
                  busy ||
                  quoting ||
                  connection ||
                  (side === "sell" && !sellOpen)
                }
              >
                {quoting
                  ? "Finding your wave…"
                  : side === "sell" && !sellOpen
                    ? "Sell window closed"
                    : !connected
                      ? "Connect wallet to trade"
                      : `Review ${side === "buy" ? "buy" : "sell"}`}
                <span aria-hidden="true">
                  {side === "sell" && !sellOpen ? "◷" : "→"}
                </span>
              </button>
            </form>
            <p className="trade-footnote">
              {side === "sell"
                ? "Shared allowance. First come, first served."
                : "No hook fees. Just you, the pool, and the tide."}
            </p>
          </section>
        </section>
        <section className="pool-status" aria-label="Pool status">
          <div className="section-kicker">
            <span>
              The surf report{" "}
              <span className="muted">
                /{" "}
                {demo
                  ? "Practice data"
                  : fresh
                    ? "Live from the pool"
                    : s
                      ? "Last known data · actions paused"
                      : "Awaiting live data"}
              </span>
            </span>
            <button
              className="refresh-button"
              aria-label="Refresh pool data"
              disabled={(loading && !demo) || busy}
              onClick={() =>
                demo
                  ? setNotice("Practice data is up to date.")
                  : void refresh()
              }
            >
              <span aria-hidden="true">↻</span>{" "}
              {demo
                ? "Practice"
                : loading
                  ? "Syncing"
                  : fresh
                    ? "Synced"
                    : "Refresh"}
            </button>
          </div>
          <div className="metrics-grid">
            <Metric
              label="Current tide"
              value={s ? `Day ${String(s.day).padStart(2, "0")}` : "—"}
              foot="A fresh vote every 24 hours"
              icon="☀"
            />
            <Metric
              label="Bought today"
              value={fmt(s?.bought)}
              foot="SURF building tomorrow’s allowance"
              icon="↗"
            />
            <Metric
              label="Sell window"
              value={
                !fresh
                  ? "Checking…"
                  : sellOpen
                    ? "Open for sells"
                    : s?.open && clock < s.genesis + s.day * DAY + HOUR
                      ? "Cap reached"
                      : "Buys only"
              }
              foot={
                sellOpen
                  ? `${fmt(s?.remaining)} SURF remaining`
                  : s?.open && clock < s.genesis + s.day * DAY + HOUR
                    ? "This window’s allowance is exhausted"
                    : s?.day === 0
                      ? "First day · no sell window"
                      : s?.previousPassed
                        ? "Today’s sell window has ended"
                        : "Yesterday’s vote did not pass"
              }
              icon="◷"
            />
            <Metric
              label="Next round in"
              value={s ? countdown(dayEnd - clock) : "— : — : —"}
              foot="Days follow the pool’s launch time"
              icon="↻"
            />
          </div>
        </section>
        <div className="community-grid">
          <section id="vote" className="vote-card" aria-labelledby="vote-title">
            <div className="section-kicker">
              <span>
                <span className="number-tag">01</span> The daily decision
              </span>
              <span className="pill">
                {s?.voted && connected
                  ? "Vote cast"
                  : ready
                    ? "Voting open"
                    : "Syncing"}
              </span>
            </div>
            <h2 id="vote-title">Same tide. Your call.</h2>
            <p className="section-copy">
              Open sells for one hour tomorrow?
              <br />
              Put your SURF behind your answer.
            </p>
            <div className="vote-labels">
              <span>
                <span className="vote-dot yes" />
                Open sells <strong>{total ? `${yesPercent}%` : "—"}</strong>
              </span>
              <span>
                Keep buys only{" "}
                <strong>
                  {total
                    ? `${(100 - yesPercent).toFixed(1).replace(".0", "")}%`
                    : "—"}
                </strong>
                <span className="vote-dot no" />
              </span>
            </div>
            <div
              className={`vote-bar ${total === 0n ? "empty" : ""}`}
              role="img"
              aria-label={`${fmt(s?.yes)} SURF for opening sells, ${fmt(s?.no)} SURF for keeping buys only`}
            >
              <div style={{ width: `${yesPercent}%` }} />
            </div>
            <div className="vote-amounts">
              <span>{fmt(s?.yes)} SURF</span>
              <span>{fmt(s?.no)} SURF</span>
            </div>
            <div className="quorum-row">
              <span>
                {total >= (s?.quorum ?? 1n) && s?.hasVotes ? "✓" : "◌"} Quorum{" "}
                {total >= (s?.quorum ?? 1n) && s?.hasVotes
                  ? "reached"
                  : "progress"}
              </span>
              <strong>
                {quorumPercent.toFixed(0)}%{" "}
                <span className="muted">
                  / {fmt(s?.quorum)} SURF{!s?.hasVotes ? " est." : ""}
                </span>
              </strong>
            </div>
            <div
              className="quorum-track"
              role="progressbar"
              aria-label="Voting quorum reached"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.floor(quorumPercent)}
            >
              <span style={{ width: `${quorumPercent}%` }} />
            </div>
            <div className="vote-actions">
              <button
                className="button vote-yes"
                onClick={() => void vote(true)}
                disabled={voteDisabled}
              >
                Open sells <span aria-hidden="true">↗</span>
              </button>
              <button
                className="button vote-no"
                onClick={() => void vote(false)}
                disabled={voteDisabled}
              >
                Keep buys only <WaveMark size={20} />
              </button>
            </div>
            <p className="vote-note">
              {s?.voted && connected
                ? "Your vote is in. Your deposited SURF unlocks at the next round."
                : s && passed(s)
                  ? "Currently passing. Voting stays open until this round ends."
                  : "To pass: more yes than no, plus 5% of circulating supply voting."}
            </p>
            <div className="potential-cap">
              <span>Tomorrow’s potential sell cap</span>
              <strong>{s ? fmt(s.bought / 2n) : "—"} SURF</strong>
            </div>
          </section>
          <section
            id="your-surf"
            className="position-card"
            aria-labelledby="position-title"
          >
            <div className="section-kicker">
              <span>
                <span className="number-tag">02</span> Your corner of the ocean
              </span>
              <WaveMark size={24} />
            </div>
            <h2 id="position-title">Your SURF, your say.</h2>
            <div className="position-stats">
              <div>
                <span>Wallet balance</span>
                <strong>
                  {connected ? fmt(s?.balance) : "—"} <small>SURF</small>
                </strong>
              </div>
              <div>
                <span>Voting power</span>
                <strong>
                  {connected ? fmt(s?.stake) : "—"} <small>SURF</small>
                </strong>
              </div>
            </div>
            <div className="position-message">
              <span className="position-symbol" aria-hidden="true">
                {connected ? "✳" : "↗"}
              </span>
              <div>
                <strong>
                  {!connected
                    ? "Your next wave starts here."
                    : s?.voted
                      ? "Thanks for making waves."
                      : s && s.stake > 0n
                        ? "You’re ready to make waves."
                        : "Turn your tokens into a voice."}
                </strong>
                <p>
                  {!connected
                    ? "Connect to see your balance, deposit SURF, and join the daily vote."
                    : s?.voted
                      ? `Deposit ${locked ? "locked for " + countdown(s.lockedUntil - clock) : "unlocked and ready to withdraw"}.`
                      : s && s.stake > 0n
                        ? "Your deposited SURF is your vote weight. One vote per wallet, per day."
                        : "Deposit SURF to vote. Voting locks your deposit until the day ends."}
                </p>
              </div>
            </div>
            {!connected ? (
              <button
                className="button full"
                onClick={() => void connectWallet()}
                disabled={connection}
              >
                Connect your wallet <Arrow />
              </button>
            ) : (
              <button
                className="button full"
                aria-expanded={showStake}
                aria-controls="stake-panel"
                onClick={() => setShowStake(!showStake)}
                disabled={busy}
              >
                Manage voting deposit{" "}
                <span aria-hidden="true">{showStake ? "−" : "+"}</span>
              </button>
            )}
            {connected && showStake && (
              <form
                id="stake-panel"
                className="stake-panel"
                onSubmit={reviewStake}
                noValidate
              >
                <div className="segmented">
                  <button
                    type="button"
                    aria-pressed={stakeMode === "deposit"}
                    className={stakeMode === "deposit" ? "selected" : ""}
                    onClick={() => {
                      setStakeMode("deposit");
                      setStakeError("");
                    }}
                  >
                    Deposit
                  </button>
                  <button
                    type="button"
                    aria-pressed={stakeMode === "withdraw"}
                    className={stakeMode === "withdraw" ? "selected" : ""}
                    onClick={() => {
                      setStakeMode("withdraw");
                      setStakeError("");
                    }}
                  >
                    Withdraw
                  </button>
                </div>
                <label htmlFor="stake-amount">SURF to {stakeMode}</label>
                <div className="stake-input">
                  <input
                    id="stake-amount"
                    ref={stakeInput}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="e.g. 1000"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    aria-invalid={!!stakeError}
                    aria-describedby="stake-error"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setStakeAmount(
                        formatUnits(
                          (stakeMode === "deposit" ? s?.balance : s?.stake) ??
                            0n,
                          18,
                        ),
                      )
                    }
                  >
                    Max
                  </button>
                </div>
                <p id="stake-error" className="field-error" role="alert">
                  {stakeError}
                </p>
                <button
                  className="button full"
                  disabled={
                    busy || !ready || (stakeMode === "withdraw" && locked)
                  }
                >
                  {stakeMode === "withdraw" && locked
                    ? "Locked until the next round"
                    : `Review ${stakeMode}`}{" "}
                  <span aria-hidden="true">→</span>
                </button>
              </form>
            )}
            <div className="position-bottom">
              <span className="status-dot" />{" "}
              {demo
                ? "Practice wallet · no real funds"
                : "Your tokens. Your keys. Your vote."}
            </div>
          </section>
        </div>
        <section
          id="how-it-works"
          className="rules"
          aria-labelledby="rules-title"
        >
          <div className="rules-header">
            <div className="eyebrow">A little different. By design.</div>
            <h2 id="rules-title">Three rules. Endless waves.</h2>
            <External href={REPO}>Read the contracts</External>
          </div>
          <div className="rules-grid">
            <article>
              <span className="rule-illustration" aria-hidden="true">
                <WaveMark size={39} />
              </span>
              <span className="rule-number">01 / Catch a wave</span>
              <h3>Buy any time.</h3>
              <p>
                The hook always permits buys in the ETH / SURF pool. A 0.3% pool
                fee applies, with no extra hook fee.
              </p>
            </article>
            <article>
              <span className="rule-illustration" aria-hidden="true">
                ✳
              </span>
              <span className="rule-number">02 / Make your call</span>
              <h3>Vote every day.</h3>
              <p>
                Deposit SURF, then vote once per day. A yes majority and 5%
                quorum open the next day’s sell window. Ties fail.
              </p>
            </article>
            <article>
              <span
                className="rule-illustration clock-illustration"
                aria-hidden="true"
              >
                ◷
              </span>
              <span className="rule-number">03 / Watch the tide</span>
              <h3>One hour. Half the buys.</h3>
              <p>
                Sells open in the next day’s first hour, capped at 50% of the
                previous day’s bought SURF. Shared by everyone; no rollover.
              </p>
            </article>
          </div>
          <p className="rules-fineprint">
            These rules apply to this launch pool. Token transfers and other
            markets are unrestricted. Selling depends on the vote, available
            allowance, and pool liquidity.
          </p>
        </section>
        <section className="activity-section" aria-labelledby="activity-title">
          <div className="section-kicker">
            <h2 id="activity-title">Your recent ripples</h2>
            <span className="muted">
              This session {demo ? "· practice" : ""}
            </span>
          </div>
          {activities.length ? (
            <ul className="activity-list">
              {activities.map((a) => (
                <li key={a.id}>
                  <span className="activity-check" aria-hidden="true">
                    ↗
                  </span>
                  <div>
                    <strong>{a.text}</strong>
                    <span>{a.detail}</span>
                  </div>
                  {a.hash && (
                    <External href={`${EXPLORER}/tx/${a.hash}`}>
                      View transaction
                    </External>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-activity">
              <span aria-hidden="true">≈</span>
              <p>
                No ripples yet. Your confirmed trades, deposits, and votes will
                appear here.
              </p>
              <a href="#overview">Make your first splash ↗</a>
            </div>
          )}
        </section>
        <footer>
          <a href="#overview" className="logo footer-logo">
            <WaveMark size={25} />
            surfsurf
          </a>
          <span>A small experiment in collective tides.</span>
          <div>
            <External href={`${EXPLORER}/address/${TOKEN}`}>Token</External>
            <External href={`${EXPLORER}/address/${HOOK}`}>Hook</External>
            <External href={PROJECT}>Built on IdentityMD</External>
          </div>
        </footer>
      </main>
      <div
        className={`notice ${notice ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {notice && (
          <>
            <span>{notice}</span>
            {txHash && (
              <External href={`${EXPLORER}/tx/${txHash}`}>
                View transaction
              </External>
            )}
            <button
              aria-label="Dismiss notification"
              onClick={() => setNotice("")}
            >
              ×
            </button>
          </>
        )}
      </div>
      <dialog
        ref={dialog}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              "button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled)",
            ),
          );
          const first = controls[0],
            last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        className="review-dialog"
        aria-labelledby="review-title"
        onCancel={(e) => {
          if (busy) e.preventDefault();
          else setReview(undefined);
        }}
        onClose={() => {
          if (!busy && !dialog.current?.open) setReview(undefined);
        }}
      >
        {review && (
          <>
            <div className="dialog-top">
              <span className="eyebrow">
                {demo ? "Practice transaction" : "Sepolia transaction"}
              </span>
              <button
                className="close-button"
                aria-label="Close review"
                disabled={busy}
                onClick={() => setReview(undefined)}
              >
                ×
              </button>
            </div>
            <h2 id="review-title">
              {review.kind === "vote"
                ? "Make your vote count."
                : `Review your ${review.kind}.`}
            </h2>
            <p className="dialog-description">
              {review.kind === "vote"
                ? `Vote to ${review.support ? "open sells for one hour tomorrow" : "keep tomorrow buys only"}. Your entire deposit will be locked until the voting round ends. A vote counts in the round when it is mined.`
                : review.kind === "deposit"
                  ? "Deposit SURF into the voting hook. This may require an exact-amount approval before the deposit."
                  : review.kind === "withdraw"
                    ? "Return deposited SURF to your connected wallet."
                    : review.kind === "sell"
                      ? "Sell SURF from your wallet. Token and Permit2 approvals may be needed first. The shared allowance can change before confirmation."
                      : "Swap Sepolia ETH for SURF in the verified launch pool."}
            </p>
            <dl className="review-values">
              {review.kind === "vote" && (
                <div>
                  <dt>Voting round</dt>
                  <dd>Day {review.day}</dd>
                </div>
              )}
              <div>
                <dt>{review.kind === "vote" ? "Vote weight" : "Amount"}</dt>
                <dd>
                  {formatUnits(review.n, 18)}{" "}
                  {review.kind === "buy" ? "ETH" : "SURF"}
                </dd>
              </div>
              {review.output !== undefined && (
                <>
                  <div>
                    <dt>Estimated output</dt>
                    <dd>
                      {fmt(review.output, 6)}{" "}
                      {review.kind === "buy" ? "SURF" : "ETH"}
                    </dd>
                  </div>
                  <div>
                    <dt>Minimum received</dt>
                    <dd>
                      {formatUnits(review.minimum!, 18)}{" "}
                      {review.kind === "buy" ? "SURF" : "ETH"}
                    </dd>
                  </div>
                  <div>
                    <dt>Deadline</dt>
                    <dd>
                      {new Date(review.deadline * 1000).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </dd>
                  </div>
                </>
              )}
              <div>
                <dt>Network</dt>
                <dd>{demo ? "Practice · no real funds" : "Sepolia testnet"}</dd>
              </div>
            </dl>
            {!demo && (
              <p className="dialog-note">
                Network gas is additional. Confirm each transaction in your
                wallet. Check any sent transaction before retrying.
              </p>
            )}
            {demo && (
              <p className="dialog-note">
                This is a simulation with a fixed illustrative exchange rate. It
                does not predict live prices.
              </p>
            )}
            <p role="alert" className="field-error">
              {reviewError}
            </p>
            {busy && (
              <p className="pending-message">{notice || "Processing…"}</p>
            )}
            {txHash && (
              <External href={`${EXPLORER}/tx/${txHash}`}>
                View submitted transaction
              </External>
            )}
            <button
              className="button primary full"
              onClick={() => void confirm()}
              disabled={busy}
            >
              {busy
                ? "Waiting for confirmation…"
                : review.kind === "vote"
                  ? `Confirm vote to ${review.support ? "open sells" : "keep buys only"}`
                  : `Confirm ${review.kind}`}
              <span aria-hidden="true">→</span>
            </button>
            <button
              className="text-button dialog-cancel"
              disabled={busy}
              onClick={() => setReview(undefined)}
            >
              Cancel
            </button>
          </>
        )}
      </dialog>
    </>
  );
}
export default App;
