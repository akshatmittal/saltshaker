export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

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
