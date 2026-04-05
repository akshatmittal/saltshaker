import type { Create2JobInput } from "@akshatmittal/saltshaker";

import { zeroAddress, zeroHash } from "viem";

export const STANDARDIZED_CREATE2_BENCHMARK_PRESET = {
  version: "create2-standard-v1",
  job: {
    protocol: "create2",
    deployer: zeroAddress,
    fixedSaltPrefix: `0x${"0".repeat(48)}`,
    initCodeHash: zeroHash,
    startNonce: 0n,
  } satisfies Create2JobInput,
  matcher: {
    type: "leadingZeros" as const,
    value: 40,
  },
} as const;
