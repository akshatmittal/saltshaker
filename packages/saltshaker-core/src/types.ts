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

export type AddressMatcherSpec =
  | PrefixMatcherSpec
  | SuffixMatcherSpec
  | ContainsMatcherSpec
  | LeadingZerosMatcherSpec;

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
  to?: Address;
  data?: Hex;
  fallbackHandler?: Address;
  paymentToken?: Address;
  payment?: bigint;
  paymentReceiver?: Address;
  singleton?: Address;
  factory?: Address;
  proxyCreationCodeHash?: Hex;
  startNonce?: bigint;
}

export type MiningJob = Create2JobInput | SafeJobInput;

export interface PreparedAddressMatcher {
  type: MatcherKind;
  valueHex: Hex;
  valueBytes: Uint8Array;
  leadingZeroNibbles: number;
}

interface PreparedJobBase {
  protocol: JobProtocol;
  startNonce: bigint;
}

export interface PreparedCreate2Job extends PreparedJobBase {
  protocol: "create2";
  deployer: Address;
  deployerBytes: Uint8Array;
  fixedSaltPrefix: Hex;
  fixedSaltPrefixBytes: Uint8Array;
  initCodeHash: Hex;
  initCodeHashBytes: Uint8Array;
}

export interface PreparedSafeJob extends PreparedJobBase {
  protocol: "safe";
  initializer: Hex;
  initializerHash: Hex;
  initializerHashBytes: Uint8Array;
  factory: Address;
  factoryBytes: Uint8Array;
  proxyCreationCodeHash: Hex;
  proxyCreationCodeHashBytes: Uint8Array;
}

export type PreparedMiningJob = PreparedCreate2Job | PreparedSafeJob;

export interface MiningCandidate {
  protocol: JobProtocol;
  nonce: bigint;
  salt: Hex;
  address: Address;
  leadingZeroNibbles: number;
}

export type MiningStatus = "idle" | "running" | "paused" | "stopped" | "error";

export interface MiningSessionState {
  protocol: JobProtocol;
  status: MiningStatus;
  adapterLabel?: string;
  error: string | null;
  totalHashes: bigint;
  hashrate: number;
  elapsedMs: number;
  currentWindowStart: bigint;
  dispatchesCompleted: number;
  top: MiningCandidate[];
}

export interface CheckWebGpuSupportResult {
  supported: boolean;
  message: string;
  adapterLabel?: string;
}

export interface WebGpuMiningSessionOptions {
  dispatchX?: number;
  dispatchY?: number;
  maxResults?: number;
  powerPreference?: GPUPowerPreference;
}

export interface WebGpuMiningSession {
  start(): Promise<void>;
  pause(): void;
  stop(): void;
  getState(): MiningSessionState;
  subscribe(listener: (state: MiningSessionState) => void): () => void;
}

export interface Create2BenchmarkOptions {
  durationMs?: number;
  dispatchX?: number;
  dispatchY?: number;
  powerPreference?: GPUPowerPreference;
}

export interface Create2BenchmarkResult {
  preset: "create2-standard-v1";
  durationMs: number;
  totalHashes: bigint;
  hashrate: number;
  dispatchX: number;
  dispatchY: number;
  workgroupSize: number;
  adapterLabel?: string;
}
