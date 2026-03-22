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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { EmptyState, HeroPanel, ReadOnlyField, StatCard } from "@/components/miner/shared";

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
    <div className="flex flex-1 flex-col gap-4 py-8">
      <HeroPanel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <p className="text-sm font-medium tracking-[0.24em] text-muted-foreground uppercase">
              Standardized Benchmark
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Fixed CREATE2 inputs, repeatable GPU throughput.
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
              Benchmark mode always runs the versioned preset{" "}
              <span className="font-mono">{STANDARDIZED_CREATE2_BENCHMARK_PRESET.version}</span>. It uses the same
              CREATE2 mining shader as the app, with the benchmark matcher fixed to leading zeros = 20.
            </p>
          </div>
          <StatCard
            label="WebGPU"
            value={support.supported ? "Ready" : "Required"}
            accent={support.adapterLabel ?? support.message}
          />
        </div>
      </HeroPanel>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardDescription>Preset</CardDescription>
            <CardTitle className="text-xl font-semibold text-foreground">CREATE2 Standard v1</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ReadOnlyField
              label="Deployer"
              value={STANDARDIZED_CREATE2_BENCHMARK_PRESET.job.deployer}
            />
            <ReadOnlyField
              label="Fixed Salt Prefix"
              value={STANDARDIZED_CREATE2_BENCHMARK_PRESET.job.fixedSaltPrefix}
            />
            <ReadOnlyField
              label="Init Code Hash"
              value={STANDARDIZED_CREATE2_BENCHMARK_PRESET.job.initCodeHash}
            />
            <ReadOnlyField
              label="Matcher"
              value="Leading zeros = 20"
            />
            <Separator />
            <Field>
              <FieldLabel>Duration (ms)</FieldLabel>
              <Input
                value={durationMs}
                onChange={(event) => setDurationMs(event.target.value)}
                className="font-mono"
              />
              <FieldDescription>Standardized run length for this benchmark pass.</FieldDescription>
            </Field>
            <Button
              onClick={handleRun}
              disabled={running || !support.supported}
            >
              {running ? "Running benchmark..." : "Run Benchmark"}
            </Button>
            {error !== null ? <p className="text-sm text-destructive">{error}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Results</CardDescription>
            <CardTitle className="text-xl font-semibold text-foreground">Standard CREATE2 throughput</CardTitle>
          </CardHeader>
          <CardContent>
            {result === null ? (
              <EmptyState>No benchmark runs yet.</EmptyState>
            ) : (
              <Card>
                <CardHeader className="gap-0">
                  <CardDescription className="text-xs font-medium tracking-[0.18em] uppercase">
                    {result.preset}
                  </CardDescription>
                  <CardTitle className="mt-2 text-2xl font-semibold text-foreground">
                    {formatHashrate(result.hashrate)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="mt-4 grid gap-4 text-sm">
                    <Metric
                      label="Duration"
                      value={`${(result.durationMs / 1000).toFixed(2)}s`}
                    />
                    <Metric
                      label="Total Hashes"
                      value={formatBigInt(result.totalHashes)}
                    />
                    <Metric
                      label="Dispatch"
                      value={`${result.dispatchX} x ${result.dispatchY} x ${result.workgroupSize}`}
                    />
                    <Metric
                      label="Adapter"
                      value={result.adapterLabel ?? "Unknown"}
                    />
                  </dl>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </section>
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
