"use client";

import { useEffect, useState } from "react";
import {
  checkWebGpuSupport,
  runCreate2Benchmark,
  STANDARDIZED_CREATE2_BENCHMARK_PRESET,
  type CheckWebGpuSupportResult,
  type Create2BenchmarkResult,
} from "saltshaker";

import { Button } from "@/components/ui/button";

export function BenchmarkConsole() {
  const [support, setSupport] = useState<CheckWebGpuSupportResult>({
    supported: false,
    message: "Checking WebGPU support...",
  });
  const [durationMs, setDurationMs] = useState("10000");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Create2BenchmarkResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkWebGpuSupport().then(setSupport);
  }, []);

  async function handleRun() {
    setError(null);
    setResult(null);

    if (!support.supported) {
      setError("Benchmark mode requires WebGPU. There is no CPU fallback.");
      return;
    }

    setRunning(true);
    const normalizedDuration = Number.parseInt(durationMs, 10);

    try {
      const benchmark = await runCreate2Benchmark({ durationMs: normalizedDuration });
      setResult(benchmark);
    } catch (benchmarkError) {
      setError(benchmarkError instanceof Error ? benchmarkError.message : "Benchmark failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6 py-8">
      <section className="rounded-3xl border border-border bg-[linear-gradient(135deg,rgba(251,146,60,0.12),rgba(56,189,248,0.08),rgba(15,23,42,0.02))] p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">Standardized Benchmark</p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Fixed CREATE2 inputs, repeatable GPU throughput.
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
              Benchmark mode always runs the versioned preset <span className="font-mono">{STANDARDIZED_CREATE2_BENCHMARK_PRESET.version}</span>.
              It uses the same CREATE2 mining shader as the app, with the benchmark matcher fixed to leading zeros = 20.
            </p>
          </div>
          <div className="rounded-2xl border border-border/80 bg-background/80 px-4 py-3 text-sm backdrop-blur-sm">
            <p className="font-medium text-foreground">{support.supported ? "WebGPU Ready" : "WebGPU Required"}</p>
            <p className="text-xs text-muted-foreground">{support.adapterLabel ?? support.message}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Preset</p>
            <h2 className="text-xl font-semibold text-foreground">CREATE2 Standard v1</h2>
          </div>
          <div className="grid gap-4">
            <ReadOnlyField label="Deployer" value={STANDARDIZED_CREATE2_BENCHMARK_PRESET.job.deployer} />
            <ReadOnlyField label="Fixed Salt Prefix" value={STANDARDIZED_CREATE2_BENCHMARK_PRESET.job.fixedSaltPrefix} />
            <ReadOnlyField label="Init Code Hash" value={STANDARDIZED_CREATE2_BENCHMARK_PRESET.job.initCodeHash} />
            <ReadOnlyField label="Matcher" value="Leading zeros = 20" />
            <label className="grid gap-2">
              <span className="text-sm font-medium text-foreground">Duration (ms)</span>
              <input
                value={durationMs}
                onChange={(event) => setDurationMs(event.target.value)}
                className="h-11 rounded-2xl border border-input bg-background px-3 font-mono text-sm outline-none transition focus:border-primary"
              />
            </label>
            <Button onClick={handleRun} disabled={running || !support.supported}>
              {running ? "Running benchmark..." : "Run Benchmark"}
            </Button>
            {error !== null ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        </section>

        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          <div className="mb-4 space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Results</p>
            <h2 className="text-xl font-semibold text-foreground">Standard CREATE2 throughput</h2>
          </div>
          {result === null ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
              No benchmark runs yet.
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-background/80 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{result.preset}</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatHashrate(result.hashrate)}</p>
              <dl className="mt-4 grid gap-2 text-sm">
                <Metric label="Duration" value={`${(result.durationMs / 1000).toFixed(2)}s`} />
                <Metric label="Total Hashes" value={formatBigInt(result.totalHashes)} />
                <Metric label="Dispatch" value={`${result.dispatchX} x ${result.dispatchY} x ${result.workgroupSize}`} />
                <Metric label="Adapter" value={result.adapterLabel ?? "Unknown"} />
              </dl>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="rounded-2xl border border-border bg-background px-3 py-3 font-mono text-xs text-foreground">
        {value}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

function formatHashrate(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)} GH/s`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)} MH/s`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)} KH/s`;
  return `${value.toFixed(0)} H/s`;
}

function formatBigInt(value: bigint): string {
  const raw = value.toString();
  return raw.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
