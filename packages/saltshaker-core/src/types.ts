import type { Address, Hex } from "viem";

export type JobProtocol = "create2" | "safe";

export type MatcherKind = "prefix" | "suffix" | "contains" | "leadingZeros";

export interface PrefixMatcherSpec {
  type: "prefix";
  value: Hex;
}

export interface SuffixMatcherSpec {
  type: "suffix";
  value: Hex;
}

export interface ContainsMatcherSpec {
  type: "contains";
  value: Hex;
}

export interface LeadingZerosMatcherSpec {
  type: "leadingZeros";
  value: number;
}

export type AddressMatcherSpec = PrefixMatcherSpec | SuffixMatcherSpec | ContainsMatcherSpec | LeadingZerosMatcherSpec;

export interface Create2JobInput {
  protocol: "create2";
  deployer: Address;
  fixedSaltPrefix: Hex;
  initCode?: Hex;
  initCodeHash?: Hex;
  startNonce?: bigint;
}

export interface SafeJobInput {
  protocol: "safe";
  owners: Address[];
  threshold: bigint;
  to: Address;
  data: Hex;
  fallbackHandler: Address;
  paymentToken: Address;
  payment: bigint;
  paymentReceiver: Address;
  factory: Address;
  proxyCreationCodeHash: Hex;
  startNonce?: bigint;
}

export type MiningJob = Create2JobInput | SafeJobInput;

export interface MiningResult {
  nonce: bigint;
  salt: Hex;
  address: Address;
  score: number;
  leadingZeroNibbles: number;
}

export type MiningStatus = "idle" | "running" | "stopped" | "error";

export interface MiningSessionState {
  status: MiningStatus;
  error: string | null;
  hashrate: number;
  elapsedMs: number;
  results: MiningResult[];
}

export interface CheckWebGpuSupportResult {
  supported: boolean;
  message: string;
  adapterLabel?: string;
}

export interface MiningSessionDispatchOptions {
  x?: number;
  y?: number;
}

export interface CreateMiningSessionInput {
  job: MiningJob;
  matcher?: AddressMatcherSpec;
  dispatch?: MiningSessionDispatchOptions;
  maxResults?: number;
  powerPreference?: GPUPowerPreference;
}

export interface MiningSession {
  start(): Promise<void>;
  stop(): void;
  subscribe(listener: (state: MiningSessionState) => void): () => void;
}
