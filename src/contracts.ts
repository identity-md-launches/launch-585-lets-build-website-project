import { parseAbi, zeroAddress } from "viem";
export const TOKEN = "0x6c9f29f7115092064d29d7b86d12836494982805";
export const HOOK = "0x4208fa0242a945b3156d60cdacee79030a5e68c0";
export const MANAGER = "0xe03a1074c86cfedd5c142c4f04f1a1536e203543";
// Original v4 Universal Router. Its single-hop ABI has no minHopPriceX36 field.
export const ROUTER = "0x3a9d48ab9751398bbfa63ad67599bb04e4bdf98b";
export const QUOTER = "0x61b3f2011a92d183c7dbadbda940a7555ccf9227";
export const PERMIT2 = "0x000000000022d473030f116ddee9f6b43ac78ba3";
export const EXPLORER = "https://sepolia.etherscan.io";
export const PROJECT =
  "https://explorer.imd.fun/jobs/18a1a874-ecfe-44e9-82db-1dd937635160#deployed";
export const REPO =
  "https://github.com/identity-md-launches/launch-575-can-buys-only";
export const poolKey = {
  currency0: zeroAddress,
  currency1: TOKEN,
  fee: 3000,
  tickSpacing: 60,
  hooks: HOOK,
} as const;
export const hookAbi = parseAbi([
  "function currentDay() view returns (uint256)",
  "function genesis() view returns (uint256)",
  "function token() view returns (address)",
  "function poolManager() view returns (address)",
  "function poolId() view returns (bytes32)",
  "function records(uint256) view returns (uint256 yes,uint256 no,uint256 quorum,bool hasVotes,uint256 bought,uint256 sold)",
  "function circulatingSupply() view returns (uint256)",
  "function sellWindowOpen() view returns (bool)",
  "function sellRemaining() view returns (uint256)",
  "function sellAllowance(uint256) view returns (uint256)",
  "function votePassed(uint256) view returns (bool)",
  "function stakeOf(address) view returns (uint256)",
  "function lockedUntil(address) view returns (uint256)",
  "function hasVoted(address,uint256) view returns (bool)",
  "function deposit(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function vote(bool support)",
  "error SellsClosed()",
  "error SellAllowanceExceeded(uint256 requested,uint256 remaining)",
  "error ZeroAmount()",
  "error NoStake()",
  "error AlreadyVoted(uint256 day)",
  "error StakeLocked(uint256 until)",
  "error InsufficientStake(uint256 requested,uint256 available)",
]);
export const quoterAbi = parseAbi([
  "struct PoolKey { address currency0; address currency1; uint24 fee; int24 tickSpacing; address hooks; }",
  "struct QuoteExactSingleParams { PoolKey poolKey; bool zeroForOne; uint128 exactAmount; bytes hookData; }",
  "function quoteExactInputSingle(QuoteExactSingleParams params) returns (uint256 amountOut,uint256 gasEstimate)",
]);
export const routerAbi = parseAbi([
  "function execute(bytes commands,bytes[] inputs,uint256 deadline) payable",
]);
export const permitAbi = parseAbi([
  "function allowance(address owner,address token,address spender) view returns (uint160 amount,uint48 expiration,uint48 nonce)",
  "function approve(address token,address spender,uint160 amount,uint48 expiration)",
]);
