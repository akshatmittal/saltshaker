import { useEffect, useRef, useState } from "react";

import { createMiningSession } from "saltshaker";

import { ReadOnlyField, TelemetryCard } from "@/components/miner/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useMiningSession } from "@/hooks/use-mining-session";
import { STANDARDIZED_CREATE2_BENCHMARK_PRESET } from "@/lib/standardized-create2-benchmark-preset";

const MAX_BENCHMARK_RUNS = 50;

export function BenchmarkConsole() {
  const {
    support,
    sessionState,
    error,
    setError,
    subscribeToSession,
    setActiveSession,
    stopSession,
    unsubscribeOnly,
  } = useMiningSession();

  const [durationSeconds, setDurationSeconds] = useState("10");
  const [runsInput, setRunsInput] = useState("3");
  const [runProgress, setRunProgress] = useState<{ current: number; total: number } | null>(null);

  const durationSecondsRef = useRef(durationSeconds);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequenceRef = useRef({ active: false, total: 1, completed: 0 });
  const userAbortedRef = useRef(false);

  durationSecondsRef.current = durationSeconds;

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  function clearTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handleRun() {
    setError(null);

    if (!support.supported) {
      setError("Benchmark mode requires WebGPU. There is no CPU fallback.");
      return;
    }

    const parsedRuns = Number.parseInt(runsInput, 10);
    const totalRuns =
      Number.isFinite(parsedRuns) && parsedRuns >= 1 ? Math.min(parsedRuns, MAX_BENCHMARK_RUNS) : 3;

    userAbortedRef.current = false;
    unsubscribeOnly();
    clearTimer();
    stopSession();

    sequenceRef.current = { active: true, total: totalRuns, completed: 0 };

    const startSingleRun = () => {
      const seq = sequenceRef.current;
      setRunProgress({ current: seq.completed + 1, total: seq.total });

      try {
        const session = createMiningSession({
          job: STANDARDIZED_CREATE2_BENCHMARK_PRESET.job,
          matcher: STANDARDIZED_CREATE2_BENCHMARK_PRESET.matcher,
        });
        setActiveSession(session);

        subscribeToSession(session, (nextState) => {
          if (nextState.status === "running" && timerRef.current === null) {
            const sec = Number.parseFloat(durationSecondsRef.current);
            const seconds = Number.isFinite(sec) && sec > 0 ? sec : 10;
            const ms = Math.max(100, seconds * 1000);
            timerRef.current = setTimeout(() => {
              session.stop();
            }, ms);
          }
          if (nextState.status !== "running" && timerRef.current !== null) {
            clearTimer();
          }

          if (nextState.status === "error") {
            sequenceRef.current.active = false;
          }

          if (
            nextState.status === "stopped" &&
            sequenceRef.current.active &&
            !userAbortedRef.current
          ) {
            const s = sequenceRef.current;
            s.completed += 1;
            if (s.completed < s.total) {
              queueMicrotask(() => {
                startSingleRun();
              });
            } else {
              s.active = false;
            }
          }
        });

        void session.start().catch((startError) => {
          sequenceRef.current.active = false;
          setError(startError instanceof Error ? startError.message : "Benchmark failed");
        });
      } catch (startError) {
        sequenceRef.current.active = false;
        setError(startError instanceof Error ? startError.message : "Benchmark failed");
      }
    };

    startSingleRun();
  }

  function handleStop() {
    userAbortedRef.current = true;
    sequenceRef.current.active = false;
    clearTimer();
    stopSession();
  }

  const active = sessionState?.status === "preparing" || sessionState?.status === "running";

  return (
    <div className="flex flex-1 flex-col gap-2 py-4">
      <section className="grid grid-cols-3 gap-4">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Benchmark Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>Duration (seconds)</FieldLabel>
                  <Input
                    value={durationSeconds}
                    onChange={(event) => setDurationSeconds(event.target.value)}
                    className="font-mono"
                    inputMode="decimal"
                  />
                </Field>
                <Field>
                  <FieldLabel>Runs</FieldLabel>
                  <Input
                    value={runsInput}
                    onChange={(event) => setRunsInput(event.target.value)}
                    className="font-mono"
                    inputMode="numeric"
                  />
                </Field>
              </div>
              {runProgress !== null && active ? (
                <p className="text-sm text-muted-foreground">
                  Run {runProgress.current} of {runProgress.total}
                </p>
              ) : null}
              {error !== null ? <p className="text-sm text-destructive">{error}</p> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Benchmark Preset</CardTitle>
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
            </CardContent>
          </Card>
        </div>

        <div className="col-span-2">
          <TelemetryCard
            sessionState={sessionState}
            support={support}
            error={error}
            active={active}
            startLabel="Run Benchmark"
            emptyMessage="No benchmark runs yet. Hit Run Benchmark to measure GPU throughput (multiple runs average out warm-up noise)."
            onStart={handleRun}
            onStop={handleStop}
          />
        </div>
      </section>
    </div>
  );
}
