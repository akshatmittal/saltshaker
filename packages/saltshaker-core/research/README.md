# WebGPU correctness and benchmark harness

This browser-only harness compares frozen baseline core/CreateX shaders with production. It uses the real protocol, matcher, and kernel WGSL, and production TypeScript job preparation, buffer packing, and pipeline constants.

## Freeze the baseline

The server automatically serves the original optimization baseline from Git revision `06445c5712df561e95fefc89499317619ae97dbe`. No baseline setup is needed with full Git history. For a shallow clone, fetch that revision or run `git fetch --unshallow origin` first. Missing history produces an explicit server error, never a comparison of current code against itself.

To override that baseline for a new experiment, run from the repository root before changing the production core:

```sh
cp packages/saltshaker-core/src/gpu/shaders/common/core.wgsl \
  packages/saltshaker-core/research/baseline.wgsl
cp packages/saltshaker-core/src/gpu/shaders/protocols/createx.wgsl \
  packages/saltshaker-core/research/baseline-createx.wgsl
```

Both baseline files are intentionally ignored by `research/.gitignore`: they are experiment inputs, not second maintained shaders. To preserve or share an experiment, record the baseline commit SHA with the returned JSON (the result includes the current page URL and options).

Local baseline files take precedence over the pinned Git revision. With another static server, provide these files yourself or use `variants: ["current"]` without an `experiment`.

To reproduce the original optimization baseline after checking out this branch:

```sh
git show 06445c5712df561e95fefc89499317619ae97dbe:packages/saltshaker-core/src/gpu/shaders/common/core.wgsl \
  > packages/saltshaker-core/research/baseline.wgsl
git show 06445c5712df561e95fefc89499317619ae97dbe:packages/saltshaker-core/src/gpu/shaders/protocols/createx.wgsl \
  > packages/saltshaker-core/research/baseline-createx.wgsl
```

## Serve and run

`serve.mjs` loads the Vite installation already brought in by this package's Vitest dependency. From the repository root:

```sh
node packages/saltshaker-core/research/serve.mjs
```

Open the URL printed by Vite. The dashboard immediately shows the checked-in SwiftShader results, explicitly labelled **not this device**, even when WebGPU is unavailable. GPU capability and recovery guidance appear separately.

The default live scope is **Quick CREATE2**. Choose scope, baseline comparison, dispatch size, warmups and trials, then select **Start research**. Compilation stages, elapsed time, correctness counts and completed benchmark rows update live. **Stop** is cooperative: it prevents subsequent work but must wait for an in-flight GPU compilation or dispatch. Failed or stopped runs are incomplete, not passing measurements. Switch between recorded and live results and use **Export JSON** for the selected completed result.

The full matrix can compile for several minutes, especially on software adapters. Quick runs are smoke tests, not enough evidence to promote further kernel optimizations. For detailed runs, use DevTools:

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

The default sweep first tests removing redundant state clearing from the 85-byte helper (`create2ZeroInit`) and from all helpers (`implicitZeroInit`), then constant-index input/output with 24 (fully unrolled), 1, 2, 4, 6, 8, and 12 rounds per loop iteration. Every candidate is generated from the frozen baseline, not from the previous candidate. A correctness failure excludes that attempt from performance ranking. Each completed attempt is checkpointed in `localStorage["saltshaker-autoresearch"]`; current progress is in `window.researchProgress` and `window.autoresearchAttempts`. Keep this tab open and run only one experiment at a time. Editing files does not reload the page; reload manually between source changes.

The second argument selects experiments, for example `[{ roundsPerIteration: 2 }, { staticIO: true }]`. `workloads: ["create2"]` limits a pilot to one workload; omit it for the full ten-workload matrix. Experiments change only the research candidate, never production files.

Core sweeps hold the baseline protocol source fixed to isolate core changes. A normal `runResearch` without `experiment` compares the full production change, including CreateX specialization. Pipelines are cached separately for each guard/operation pair, and compilation records include the complete shader hash and override values.

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

## Experiment log (2026-09-20)

Raw samples, adapter/browser information, options, correctness counts, source SHA-256 hashes, and compilation timings are in `results/`. These are **SwiftShader software-adapter results**, not physical GPU benchmarks.

1. `swiftshader-sweep.json`: seven CREATE2 candidates, 1,024 invocations, two warmups and seven alternating samples. Static input/output indexing with full round unrolling measured 1.110× baseline throughput. Round factors 1/2/4/6/8/12 measured 0.978×/0.873×/0.834×/0.834×/0.814×/0.924×. Reject shorter round loops on this evidence.
2. `swiftshader-confirmation.json`: hand-written constant-index input/output, 8,192 invocations, five warmups and 21 samples. CREATE2 improved from 13.886 to 12.715 ms, but Safe regressed from 31.882 to 32.925 ms. Reject the combined change; do not select a winner using CREATE2 alone.
3. `swiftshader-zero-init.json`: remove only redundant state-clearing loops, 8,192 invocations, ten warmups and 31 samples. CREATE2 improved from 14.141 to 13.495 ms (1.048× throughput), and Safe from 32.297 to 31.267 ms (1.033×). Preserve input/output and round-loop structure.
4. `swiftshader-full-matrix-failure.json` and `swiftshader-single-variant-failure.json`: the all-helper candidate caused the GPU process to exit during CreateX verification-pipeline compilation, both paired with baseline and alone in a fresh browser with the watchdog disabled. The paired run had completed baseline correctness first. Reject broad clearing-loop removal despite the CREATE2/Safe timings; narrow the change to the 85-byte helper instead. These failures do not establish whether the cause was compiler memory use or another backend fault.
5. `swiftshader-create2-zero-init.json`: restrict implicit initialization to the 85-byte helper, leaving all other helpers unchanged. All 40 CPU/GPU address comparisons and all ten production workloads passed. This run predates CreateX pipeline specialization and measures only the current candidate, not a paired speedup.
6. `swiftshader-specialized.json`: final paired comparison against the original core and CreateX shader. The candidate combines 85-byte implicit initialization with per-job CreateX guard/operation overrides. All **80 address comparisons** passed. Each variant/workload used 4,096 invocations, ten warmups, and 21 alternating timed samples. Every workload improved in this run:

| Workload                 | Baseline GPU ms | Candidate GPU ms | Throughput ratio |
| ------------------------ | --------------: | ---------------: | ---------------: |
| CREATE2                  |           8.078 |            7.426 |           1.088× |
| Safe                     |          20.284 |           18.152 |           1.117× |
| CreateX CREATE2, guard 0 |         136.629 |           17.533 |           7.793× |
| CreateX CREATE3, guard 0 |         142.535 |           43.675 |           3.264× |
| CreateX CREATE2, guard 1 |         142.748 |           17.081 |           8.357× |
| CreateX CREATE3, guard 1 |         138.479 |           38.312 |           3.615× |
| CreateX CREATE2, guard 2 |         137.697 |           14.757 |           9.331× |
| CreateX CREATE3, guard 2 |         137.889 |           40.786 |           3.381× |
| CreateX CREATE2, guard 3 |         142.050 |           17.040 |           8.336× |
| CreateX CREATE3, guard 3 |         137.761 |           38.954 |           3.537× |

Guard modes are unprotected (0), caller (1), chain (2), and caller plus chain (3). CreateX production-pipeline compilation was 64.36 seconds for the baseline and 41.21–55.40 seconds per specialized pipeline. These are diagnostic compile timings, not a cache-controlled cold-start comparison.

The final software runs used Chromium flags `--enable-unsafe-webgpu --use-angle=swiftshader --disable-gpu-watchdog`. Physical-GPU runs should use their normal hardware backend, not SwiftShader. To reproduce the final comparison, use `runResearch({ warmups: 10, trials: 21, dispatchX: 64 })` without an `experiment` option. Increase dispatch size on faster physical adapters if timestamp samples are too short.

These runs include noisy samples and changing CPU load. Treat small differences as provisional until repeated on the target GPU. The retained changes remove a redundant initialization loop and let the compiler discard CreateX branches that cannot execute for the prepared job. They do not introduce adapter-specific tuning or change hashing semantics. Existing best-result publication and custom 2D-dispatch coverage are outside this experiment.
