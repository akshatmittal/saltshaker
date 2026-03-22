import type { Address, Hex } from "viem";

import type { LeadingZerosMatcherSpec } from "./types";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export const DEFAULT_SAFE_FACTORY = "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2" as const;
export const DEFAULT_SAFE_SINGLETON = "0x3E5c63644E683549055b9Be8653de26E0B4CD36E" as const;
export const DEFAULT_SAFE_FALLBACK_HANDLER = "0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4" as const;
export const DEFAULT_SAFE_PROXY_CREATION_CODE_HASH =
  "0xcaf2dc2f91b804b2fcf1ed3a965a1ff4404b840b80c124277b00a43b4634b2ce" as const;

export const SAFE_SETUP_ABI = [
  {
    inputs: [
      { name: "_owners", type: "address[]" },
      { name: "_threshold", type: "uint256" },
      { name: "to", type: "address" },
      { name: "data", type: "bytes" },
      { name: "fallbackHandler", type: "address" },
      { name: "paymentToken", type: "address" },
      { name: "payment", type: "uint256" },
      { name: "paymentReceiver", type: "address" },
    ],
    name: "setup",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const DEFAULT_DISPATCH_X = 65_535;
export const DEFAULT_DISPATCH_Y = 16;
export const DEFAULT_WORKGROUP_SIZE = 64;
export const ITEMS_PER_DISPATCH = BigInt(DEFAULT_DISPATCH_X * DEFAULT_DISPATCH_Y * DEFAULT_WORKGROUP_SIZE);

export const MAX_RESULTS = 25;
export const FIXED_SALT_PREFIX_BYTES = 24;

export const STANDARDIZED_CREATE2_BENCHMARK_PRESET = {
  version: "create2-standard-v1",
  job: {
    protocol: "create2",
    deployer: "0x4e59b44847b379578588920cA78FbF26c0B4956C" as Address,
    fixedSaltPrefix: "0x73616c747368616b65725f62656e63686d61726b5f763121" as Hex,
    initCodeHash: "0x6e1cce4955d4b57d9569397925551f2fb36c34f1cfe0f2e8c0c727c44bd08b90" as Hex,
    startNonce: 0n,
  },
  matcher: {
    type: "leadingZeros",
    value: 20,
  } as LeadingZerosMatcherSpec,
} as const;
