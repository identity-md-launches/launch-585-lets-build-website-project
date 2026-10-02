import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  fallback,
  erc20Abi,
  encodeFunctionData,
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  zeroAddress,
} from "viem";
import type { Address, Hex, EIP1193Provider } from "viem";
import { sepolia } from "viem/chains";
import {
  TOKEN,
  HOOK,
  MANAGER,
  ROUTER,
  QUOTER,
  PERMIT2,
  poolKey,
  hookAbi,
  quoterAbi,
  routerAbi,
  permitAbi,
} from "./contracts.ts";
import type { Snapshot } from "./model";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}
export const client = createPublicClient({
  chain: sepolia,
  batch: { multicall: true },
  transport: fallback([
    http("https://ethereum-sepolia-rpc.publicnode.com", {
      timeout: 10000,
      retryCount: 0,
    }),
    http("https://sepolia.drpc.org", { timeout: 10000, retryCount: 0 }),
  ]),
});
export const keyType =
  "(address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks)";
export const expectedPool = keccak256(
  encodeAbiParameters(parseAbiParameters(keyType), [poolKey]),
);
export async function readSnapshot(account?: Address): Promise<Snapshot> {
  const block = await client.getBlock();
  const blockNumber = block.number;
  const hook = { address: HOOK, abi: hookAbi, blockNumber } as const;
  const [day, genesis, token, manager, pool] = await Promise.all([
    client.readContract({ ...hook, functionName: "currentDay" }),
    client.readContract({ ...hook, functionName: "genesis" }),
    client.readContract({ ...hook, functionName: "token" }),
    client.readContract({ ...hook, functionName: "poolManager" }),
    client.readContract({ ...hook, functionName: "poolId" }),
  ]);
  if (
    token.toLowerCase() !== TOKEN ||
    manager.toLowerCase() !== MANAGER ||
    pool !== expectedPool ||
    genesis === 0n
  )
    throw new Error(
      "The deployed pool could not be verified. Trading is unavailable.",
    );
  const [
    record,
    previous,
    previousPassed,
    open,
    remaining,
    allowance,
    circulating,
    personal,
  ] = await Promise.all([
    client.readContract({ ...hook, functionName: "records", args: [day] }),
    day > 0n
      ? client.readContract({
          ...hook,
          functionName: "records",
          args: [day - 1n],
        })
      : Promise.resolve([0n, 0n, 0n, false, 0n, 0n] as const),
    day > 0n
      ? client.readContract({
          ...hook,
          functionName: "votePassed",
          args: [day - 1n],
        })
      : Promise.resolve(false),
    client.readContract({ ...hook, functionName: "sellWindowOpen" }),
    client.readContract({ ...hook, functionName: "sellRemaining" }),
    client.readContract({
      ...hook,
      functionName: "sellAllowance",
      args: [day],
    }),
    client.readContract({ ...hook, functionName: "circulatingSupply" }),
    account
      ? Promise.all([
          client.readContract({
            address: TOKEN,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [account],
            blockNumber,
          }),
          client.getBalance({ address: account, blockNumber }),
          client.readContract({
            ...hook,
            functionName: "stakeOf",
            args: [account],
          }),
          client.readContract({
            ...hook,
            functionName: "lockedUntil",
            args: [account],
          }),
          client.readContract({
            ...hook,
            functionName: "hasVoted",
            args: [account, day],
          }),
        ])
      : Promise.resolve([0n, 0n, 0n, 0n, false] as const),
  ]);
  return {
    day: Number(day),
    genesis: Number(genesis),
    timestamp: Number(block.timestamp),
    fetchedAt: Date.now(),
    block: blockNumber,
    yes: record[0],
    no: record[1],
    quorum: record[3] ? record[2] : (circulating * 5n) / 100n,
    hasVotes: record[3],
    bought: record[4],
    sold: record[5],
    previousBought: previous[4],
    previousPassed,
    open,
    remaining,
    allowance,
    balance: personal[0],
    eth: personal[1],
    stake: personal[2],
    lockedUntil: Number(personal[3]),
    voted: personal[4],
  };
}
export async function connect(): Promise<Address> {
  if (!window.ethereum)
    throw new Error(
      "No browser wallet found. Open this site in your wallet’s browser, or try practice mode.",
    );
  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  });
  if (!accounts[0])
    throw new Error("Choose an account in your wallet and try again.");
  const id = await window.ethereum.request({ method: "eth_chainId" });
  if (Number(id) !== sepolia.id) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }],
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 4902) throw error;
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: "0xaa36a7",
            chainName: "Sepolia",
            nativeCurrency: {
              name: "Sepolia Ether",
              symbol: "ETH",
              decimals: 18,
            },
            rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
            blockExplorerUrls: ["https://sepolia.etherscan.io"],
          },
        ],
      });
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0xaa36a7" }],
      });
    }
  }
  return accounts[0];
}
export type Progress = (message: string, hash?: Hex) => void;
async function checkAccount(account: Address) {
  if (!window.ethereum) throw new Error("Reconnect your wallet to continue.");
  const [chain, accounts] = await Promise.all([
    window.ethereum.request({ method: "eth_chainId" }),
    window.ethereum.request({ method: "eth_accounts" }),
  ]);
  if (Number(chain) !== sepolia.id)
    throw new Error("Switch your wallet to Sepolia, then reconnect.");
  if (accounts[0]?.toLowerCase() !== account.toLowerCase())
    throw new Error(
      "Your wallet account changed. Reconnect and review the action again.",
    );
}
export async function send(
  account: Address,
  to: Address,
  data: Hex,
  progress: Progress,
  value = 0n,
): Promise<Hex> {
  await checkAccount(account);
  progress("Checking the transaction…");
  await client.call({ account, to, data, value });
  const gas = await client.estimateGas({ account, to, data, value });
  await checkAccount(account);
  progress("Confirm this transaction in your wallet.");
  const wallet = createWalletClient({
    account,
    chain: sepolia,
    transport: custom(window.ethereum!),
  });
  const hash = await wallet.sendTransaction({
    to,
    data,
    value,
    gas: (gas * 120n) / 100n,
  });
  progress("Transaction sent. Waiting for confirmation…", hash);
  const receipt = await client.waitForTransactionReceipt({
    hash,
    timeout: 180000,
  });
  if (receipt.status !== "success")
    throw new Error(
      "The transaction reverted. No action completed; network gas may have been spent. Refresh and try again.",
    );
  return hash;
}
async function approve(
  account: Address,
  spender: Address,
  n: bigint,
  progress: Progress,
) {
  const current = await client.readContract({
    address: TOKEN,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, spender],
  });
  if (current < n) {
    progress("Approve the exact SURF amount in your wallet.");
    await send(
      account,
      TOKEN,
      encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, n],
      }),
      progress,
    );
  }
}
export async function govern(
  account: Address,
  type: "deposit" | "withdraw" | "vote",
  value: bigint | boolean,
  progress: Progress,
  expected?: { day: number; stake: bigint },
) {
  if (type === "vote" && expected) {
    const latest = await readSnapshot(account);
    if (latest.day !== expected.day || latest.stake !== expected.stake)
      throw new Error(
        "Your voting round or deposited balance changed. Close this review and review your vote again.",
      );
  }
  if (type === "deposit")
    await approve(account, HOOK, value as bigint, progress);
  const data =
    type === "vote"
      ? encodeFunctionData({
          abi: hookAbi,
          functionName: "vote",
          args: [value as boolean],
        })
      : encodeFunctionData({
          abi: hookAbi,
          functionName: type,
          args: [value as bigint],
        });
  return send(account, HOOK, data, progress);
}
export async function quote(buy: boolean, n: bigint) {
  const { result } = await client.simulateContract({
    address: QUOTER,
    abi: quoterAbi,
    functionName: "quoteExactInputSingle",
    args: [{ poolKey, zeroForOne: buy, exactAmount: n, hookData: "0x" }],
  });
  if (result[0] === 0n)
    throw new Error(
      "No output is available for this amount. Try a smaller trade.",
    );
  return result[0];
}
export function encodeSwap(buy: boolean, n: bigint, minimum: bigint) {
  const params = [
    encodeAbiParameters(
      parseAbiParameters(
        `(${keyType} poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,bytes hookData)`,
      ),
      [
        {
          poolKey,
          zeroForOne: buy,
          amountIn: n,
          amountOutMinimum: minimum,
          hookData: "0x",
        },
      ],
    ),
    encodeAbiParameters(parseAbiParameters("address,uint256"), [
      buy ? zeroAddress : TOKEN,
      n,
    ]),
    encodeAbiParameters(parseAbiParameters("address,uint256"), [
      buy ? TOKEN : zeroAddress,
      minimum,
    ]),
  ];
  const swap = encodeAbiParameters(parseAbiParameters("bytes,bytes[]"), [
    "0x060c0f",
    params,
  ]);
  // Sweep leftover native input back to msg.sender if liquidity only fills part of a buy.
  const sweep = encodeAbiParameters(
    parseAbiParameters("address,address,uint256"),
    [zeroAddress, "0x0000000000000000000000000000000000000001", 0n],
  );
  return {
    commands: buy ? "0x1004" : "0x10",
    inputs: buy ? [swap, sweep] : [swap],
  } as { commands: Hex; inputs: Hex[] };
}
export async function trade(
  account: Address,
  buy: boolean,
  n: bigint,
  minimum: bigint,
  deadline: number,
  progress: Progress,
) {
  if (!buy) {
    await approve(account, PERMIT2, n, progress);
    const [allowed, expiration] = await client.readContract({
      address: PERMIT2,
      abi: permitAbi,
      functionName: "allowance",
      args: [account, TOKEN, ROUTER],
    });
    if (allowed < n || expiration < deadline)
      await send(
        account,
        PERMIT2,
        encodeFunctionData({
          abi: permitAbi,
          functionName: "approve",
          args: [TOKEN, ROUTER, n, deadline],
        }),
        progress,
      );
  }
  const latest = await readSnapshot(account);
  if (Date.now() / 1000 >= deadline || latest.timestamp >= deadline)
    throw new Error(
      "Your trade review expired. Get a new quote; any completed approvals remain available.",
    );
  if (!buy && (!latest.open || n > latest.remaining))
    throw new Error(
      "The sell window or shared allowance changed. Refresh and review a new trade.",
    );
  const { commands, inputs } = encodeSwap(buy, n, minimum);
  return send(
    account,
    ROUTER,
    encodeFunctionData({
      abi: routerAbi,
      functionName: "execute",
      args: [commands, inputs, BigInt(deadline)],
    }),
    progress,
    buy ? n : 0n,
  );
}
export function errorText(error: unknown): string {
  const e = error as { message?: string; shortMessage?: string; code?: number };
  const text =
    e?.shortMessage || e?.message || "The request could not complete.";
  if (e?.code === 4001 || /rejected|denied/i.test(text))
    return "Request declined in your wallet. Nothing new was submitted; you can try again.";
  if (/timeout|timed out/i.test(text))
    return "The network took too long. If a transaction was sent, check its explorer link before trying again.";
  if (/HTTP request|fetch failed|Failed to fetch/i.test(text))
    return "Cannot reach Sepolia. Check your connection and retry.";
  return text.length > 240 ? `${text.slice(0, 237)}…` : text;
}
