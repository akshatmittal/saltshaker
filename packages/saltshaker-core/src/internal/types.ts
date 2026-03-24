import type { Address, Hex } from "viem";

import type { JobProtocol, MatcherKind } from "../types";

type PatternMatcherKind = Exclude<MatcherKind, "leadingZeros">;

export interface PreparedPatternMatcher {
  type: PatternMatcherKind;
  valueHex: `0x${string}`;
  nibbles: Uint8Array;
}

export interface PreparedLeadingZerosMatcher {
  type: "leadingZeros";
  minZeroNibbles: number;
}

export type PreparedMatcher = PreparedPatternMatcher | PreparedLeadingZerosMatcher;

interface PreparedJobBase {
  protocol: JobProtocol;
  startNonce: bigint;
}

export interface PreparedCreate2Job extends PreparedJobBase {
  protocol: "create2";
  deployer: Address;
  deployerBytes: Uint8Array;
  fixedSaltPrefixBytes: Uint8Array;
  initCodeHash: Hex;
  initCodeHashBytes: Uint8Array;
}

export interface PreparedSafeJob extends PreparedJobBase {
  protocol: "safe";
  initializerHash: Hex;
  initializerHashBytes: Uint8Array;
  factory: Address;
  factoryBytes: Uint8Array;
  proxyCreationCodeHash: Hex;
  proxyCreationCodeHashBytes: Uint8Array;
}

export type PreparedJob = PreparedCreate2Job | PreparedSafeJob;

export interface SessionConfig {
  dispatchX: number;
  dispatchY: number;
  maxResults: number;
  powerPreference?: GPUPowerPreference;
}
