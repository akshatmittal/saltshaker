"use client";

import { useEffect, useRef, useState } from "react";

import {
  checkWebGpuSupport,
  createMiningSession,
  STANDARDIZED_CREATE2_BENCHMARK_PRESET,
  type CheckWebGpuSupportResult,
  type MiningSession,
  type MiningSessionState,
} from "saltshaker";

import { ReadOnlyField, TelemetryCard } from "@/components/miner/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

export function BenchmarkConsole() {
  const [support, setSupport] = useState<CheckWebGpuSupportResult>({
    supported: false,
    message: "Checking WebGPU support...",
  });
  const [durationMs, setDurationMs] = useState("10000");
  const [sessionState, setSessionState] = useState<MiningSessionState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<MiningSession | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    checkWebGpuSupport().then(setSupport);
    return () => {
      unsubscribeRef.current?.();
      sessionRef.current?.stop();
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  function handleRun() {
    setError(null);

    if (!support.supported) {
      setError("Benchmark mode requires WebGPU. There is no CPU fallback.");
      return;
    }

    try {
      sessionRef.current?.stop();
      if (timerRef.current !== null) clearTimeout(timerRef.current);

      const session = createMiningSession({
        job: STANDARDIZED_CREATE2_BENCHMARK_PRESET.job,
        matcher: STANDARDIZED_CREATE2_BENCHMARK_PRESET.matcher,
      });
      sessionRef.current = session;

      unsubscribeRef.current?.();
      unsubscribeRef.current = session.subscribe((nextState) => {
        setSessionState(nextState);
        if (nextState.error !== null) {
          setError(nextState.error);
        }
        if (nextState.status === "running" && timerRef.current === null) {
          const limit = Number.parseInt(durationMs, 10) || 10_000;
          timerRef.current = setTimeout(() => {
            session.stop();
          }, limit);
        }
        if (nextState.status !== "running" && timerRef.current !== null) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
      });

      void session.start().catch((startError) => {
        setError(startError instanceof Error ? startError.message : "Benchmark failed");
      });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Benchmark failed");
    }
  }

  function handleStop() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    sessionRef.current?.stop();
  }

  const active = sessionState?.status === "preparing" || sessionState?.status === "running";

  return (
    <div className="flex flex-1 flex-col gap-4 py-8">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardDescription>Preset</CardDescription>
            <CardTitle>CREATE2 Standard v1</CardTitle>
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
              value="Leading zeros = 40"
            />
            <Separator />
            <Field>
              <FieldLabel>Duration (ms)</FieldLabel>
              <Input
                value={durationMs}
                onChange={(event) => setDurationMs(event.target.value)}
                className="font-mono"
              />
              <FieldDescription>The session auto-stops after this duration.</FieldDescription>
            </Field>
            {error !== null ? <p className="text-sm text-destructive">{error}</p> : null}
          </CardContent>
        </Card>

        <TelemetryCard
          sessionState={sessionState}
          support={support}
          error={error}
          active={active}
          startLabel="Run Benchmark"
          emptyMessage="No benchmark runs yet. Hit Run Benchmark to measure GPU throughput."
          onStart={handleRun}
          onStop={handleStop}
        />
      </section>
    </div>
  );
}
