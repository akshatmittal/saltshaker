# WebGPU correctness and benchmark harness

This browser-only harness compares a frozen baseline `core.wgsl` with the current production core. It uses the real production protocol, matcher, and kernel WGSL, and the production TypeScript job preparation/packing code.

## Freeze the baseline

Before changing the production core, run from the repository root:

```sh
cp packages/saltshaker-core/src/gpu/shaders/common/core.wgsl \
  packages/saltshaker-core/research/baseline.wgsl
```

`baseline.wgsl` is intentionally ignored by `research/.gitignore`: it is experiment input, not a second maintained shader. To preserve or share a particular experiment, record the baseline commit SHA with the returned JSON (the result includes the current page URL and options), or explicitly force-add the frozen file if desired.

The harness can run without this file only when `variants` is `["current"]` and no `experiment` is supplied.

To reproduce the original optimization baseline after checking out this branch:

```sh
git show 06445c5712df561e95fefc89499317619ae97dbe:packages/saltshaker-core/src/gpu/shaders/common/core.wgsl \
  > packages/saltshaker-core/research/baseline.wgsl
```

## Serve and run

`serve.mjs` loads the Vite installation already brought in by this package's Vitest dependency. From the repository root:

```sh
node packages/saltshaker-core/research/serve.mjs
```

Open the URL printed by Vite in a WebGPU-capable browser. Run with the button, or in DevTools:

```js
const result = await window.runResearch({
  variants: ["baseline", "current"],
  warmups: 2,
  trials: 9,
  dispatchX: 32,
  dispatchY: 1,
  powerPreference: "high-performance",
  timestamps: true,
});
copy(JSON.stringify(result, null, 2));
```

For Chrome/Chromium, WebGPU requires a secure context (`localhost` is accepted) and a working GPU backend. Do not compare runs across browser versions, power states, adapter/driver changes, or different options.

## Autoresearch loop

Run a bounded sweep in DevTools:

```js
const attempts = await window.runAutoresearch({ warmups: 3, trials: 15, dispatchX: 128 });
copy(JSON.stringify(attempts, null, 2));
```

The default sweep tests constant-index input/output with 24 (fully unrolled), 1, 2, 4, 6, 8, and 12 rounds per loop iteration. Every candidate is generated from the frozen baseline, not from the previous candidate. A correctness failure excludes that attempt from performance ranking. Each completed attempt is checkpointed in `localStorage["saltshaker-autoresearch"]`; current progress is in `window.researchProgress` and `window.autoresearchAttempts`. Keep this tab open and run only one experiment at a time. Editing files does not reload the page; reload manually between source changes.

The second argument selects experiments, for example `[{ roundsPerIteration: 2 }, { staticIO: true }]`. `workloads: ["create2"]` limits a pilot to one workload; omit it for the full ten-workload matrix. Experiments change only the research candidate, never production files.

Use geometric speedup to rank candidates, and inspect `worstSpeedup` for regressions hidden by the average. Repeat the finalists with larger dispatches and more trials on target hardware. Require a reproducible improvement beyond sample noise with no important workload regression before promoting a change. Compilation timings can include driver caches and are diagnostic, not cold-start guarantees. The sweep does not automatically promote a winner or treat software-adapter rankings as hardware rankings.

## Options

| Option            | Default                   | Meaning                                                                               |
| ----------------- | ------------------------- | ------------------------------------------------------------------------------------- |
| `variants`        | `["baseline", "current"]` | Which core shaders to check and time.                                                 |
| `warmups`         | `2`                       | Untimed dispatches per workload and variant.                                          |
| `trials`          | `7`                       | Timed dispatches per workload and variant.                                            |
| `dispatchX`       | `8`                       | Production-main workgroups in X (64 invocations each).                                |
| `dispatchY`       | `1`                       | Production-main workgroups in Y. Keep small for software adapters.                    |
| `powerPreference` | `"high-performance"`      | Adapter preference.                                                                   |
| `timestamps`      | `true`                    | Request `timestamp-query` when the adapter supports it. Wall time is always reported. |

Inputs are validated and bounded (`warmups <= 20`, `trials <= 50`, and no more than 1,048,576 invocations per dispatch). Defaults are deliberately small enough for software WebGPU. Increase dispatch size only after a successful default run.

## What is checked and measured

- Correctness uses a research-only deterministic compute entrypoint that writes every invocation's nonce and address to its own output slot. It does **not** use production's racy best-result buffer.
- Every selected core is checked for CREATE2, Safe, and all CreateX guard modes 0–3 with both CREATE2 and CREATE3 operations. Four consecutive nonces start at `0x12345678fffffffe`, crossing the low-word carry into a nonzero high word.
- GPU addresses are compared to a separate direct viem/Keccak Ethereum derivation. The production CPU `deriveResult` API must independently agree with that derivation.
- Benchmarks use the unchanged production `main` kernel and a 16-leading-zero matcher, making result-buffer contention negligibly likely. Baseline and current use identical prepared jobs, constants, matcher, dispatch dimensions, and trial counts.
- Variant execution order alternates each warmup/trial. The result reports pipeline compilation times, all raw wall/GPU samples, and medians per workload/variant. GPU samples are `null` if timestamp queries are unavailable or disabled.

This isolates hashing throughput: it does not validate best-result publication under contention, nonce coverage of custom 2D dispatches, other matchers, or session UI/telemetry. The existing production kernel has independent result-publication and fixed-row-stride limitations; this research does not change those behaviors.

Any shader compilation message with severity `error`, WebGPU error scope failure, uncaptured GPU error, device loss, CPU/GPU mismatch, or cleanup-path execution error rejects `runResearch` and is printed visibly by the page. Resources and the device are destroyed in `finally` blocks.

This harness reports measurements, not a hardware-performance claim. In particular, the development orb has no `/dev/dri`; run the browser benchmark on the target hardware.
