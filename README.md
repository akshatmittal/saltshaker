# Saltshaker

Saltshaker is a WebGPU powered in-browser vanity salt miner for deterministic Ethereum deployments.

- Performance: push the search loop onto the GPU, stream live hashrate, and benchmark hardware with a standardized preset.
- Capability: Mine addresses for `CREATE2`, `CreateX` (`CREATE2` and `CREATE3`), and `Safe` deployments with multiple matcher strategies.
- Ease of use: Start from a tiny TypeScript API or the included browser workbench.

## Why Saltshaker

- GPU-first search. The miner dispatches work through WebGPU and, by default, searches `65,535 x 16 x 64 = 67,107,840` candidates per dispatch.
- Browser-native workflow. No backend, no RPC requirement, and no wallet connection just to search deterministic addresses.
- Correctness guardrails. GPU hits are re-scored on the CPU before they are accepted into the result set.
- Live telemetry. Sessions report status, elapsed time, hashrate, and ranked results as they run.
- Built-in benchmark mode. The starter app includes a repeatable benchmark route so you can compare GPUs with the same preset.

## Benchmark

| Device          | Hashrate  |
| --------------- | --------- |
| Nvidia RTX 3070 | 1140 MH/s |

(Consider adding your device to this list!)

## What It Supports

### Protocols

| Protocol  | Notes                                                                                       |
| --------- | ------------------------------------------------------------------------------------------- |
| `create2` | Deterministic contract address mining from deployer + salt + init code hash                 |
| `createx` | Supports `CREATE2` and `CREATE3`, including caller-protected and crosschain-protected salts |
| `safe`    | Mines proxy addresses derived from Safe initializer data and nonce                          |

### Matchers

| Matcher        | Notes                                                              |
| -------------- | ------------------------------------------------------------------ |
| `leadingZeros` | Search for addresses with a minimum number of leading zero nibbles |
| `prefix`       | Nibble-precision prefix matching                                   |
| `suffix`       | Nibble-precision suffix matching                                   |
| `contains`     | Nibble-precision substring matching                                |

If you do not provide a matcher, Saltshaker defaults to `leadingZeros: 8`.

You can also create custom matcher configurations to target very specific address patterns, such as the Uniswap V4 address mining competition!

## Technical Overview

Saltshaker runs the mining loop as a WebGPU compute workload.

### WebGPU Mining Flow

1. The CPU prepares protocol-specific constants such as deployers, factories, salt prefixes, code hashes, Safe initializer hashes, and matcher data.
2. Saltshaker packs those constants into a GPU storage buffer, writes the current nonce base into a small uniform buffer, and allocates a compact result buffer for the best hit in the current dispatch.
3. The shader is assembled from shared Keccak primitives, a matcher module, a protocol module, and one shared compute kernel.
4. The GPU dispatches workgroups across the nonce space and each invocation derives one candidate address for one nonce.
5. Each invocation scores its candidate on the GPU and only higher-scoring hits try to update the shared best-result buffer through atomics.
6. After the dispatch completes, Saltshaker copies the result buffer back to the CPU, derives the final salt and address, re-scores the hit on the CPU, and merges valid results into the ranked result list.

By default, each dispatch covers `65,535 x 16` workgroups at a workgroup size of `64`, which means `67,107,840` nonce candidates per dispatch.

### Keccak Kernel

The compute path is centered on a shared WGSL Keccak implementation.

- The shared core shader implements the Keccak-f permutation directly in WGSL, including the `theta`, `rho/pi`, `chi`, and `iota` rounds.
- Protocol shaders only define how to build the correct preimage for a nonce. `CREATE2` hashes `0xff ++ deployer ++ salt ++ initCodeHash`, `Safe` derives its salt from `keccak256(initializerHash ++ nonce)`, and `CreateX` applies its guarded-salt rules before address derivation.
- The kernel exposes fixed-size helpers such as `keccak256_32`, `keccak256_64`, `keccak256_96`, `keccak256_85_address`, and `keccak256_23_address` so each protocol can hash the exact layout it needs.
- All protocol and matcher combinations reuse the same `@compute @workgroup_size(64)` entrypoint, so Saltshaker swaps protocol and matcher logic without changing the overall execution model.
- The GPU only returns the best hit from a dispatch, which keeps readback small and lets the CPU stay focused on verification, ranking, and session telemetry.

## Quick Start

### Run the starter app

```bash
pnpm install
pnpm dev
```

Then open the local URL printed by Vite.

The starter app includes:

- a mining workbench for `CREATE2`, `CreateX`, and `Safe`
- live telemetry and ranked results
- a `/benchmark` route for repeatable WebGPU throughput tests

### Use the library

The core package lives in `packages/saltshaker-core` and exports a very small API:

- `checkWebGpuSupport()`
- `createMiningSession()`

Example:

```ts
import { checkWebGpuSupport, createMiningSession } from "@akshatmittal/saltshaker";

const support = await checkWebGpuSupport();
if (!support.supported) {
  throw new Error(support.message);
}

const session = createMiningSession({
  job: {
    protocol: "create2",
    deployer: "0x4e59b44847b379578588920cA78FbF26c0B4956C",
    fixedSaltPrefix: "0x000000000000000000000000000000000000000000000000",
    initCodeHash: "0x6e1cce4955d4b57d9569397925551f2fb36c34f1cfe0f2e8c0c727c44bd08b90",
  },
  matcher: { type: "prefix", value: "0xdead" },
  maxResults: 10,
});

const unsubscribe = session.subscribe((state) => {
  console.log(state.status, state.hashrate, state.results);

  if (state.results.length > 0) {
    session.stop();
  }
});

await session.start();
unsubscribe();
```

## API Shape

`createMiningSession()` accepts:

- a `job` for `create2`, `createx`, or `safe`
- an optional `matcher`
- optional `dispatch` sizing
- optional `maxResults`
- optional WebGPU `powerPreference`

Each session exposes:

- `start()` to begin mining
- `stop()` to stop the active run
- `subscribe(listener)` to receive state updates

Session state includes:

- `status` and `statusDetail`
- `hashrate`
- `elapsedMs`
- `results`
- `error`

## Development

### Repo layout

- `packages/saltshaker-core`: Typed WebGPU mining library
- `apps/web-start`: Browser workbench and benchmark UI (Tanstack Start)
- `tooling/typescript-config`: Shared TypeScript config

### Commands

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
```

## Requirements

- Node.js `>=24`
- `pnpm@10`
- A browser with WebGPU support for actual mining
- `viem` as a peer dependency of the `@akshatmittal/saltshaker` package
