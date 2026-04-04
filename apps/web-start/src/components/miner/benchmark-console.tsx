import { useState } from "react";

import { ReadOnlyField, TelemetryCard } from "@/components/miner/shared";
import { WorkbenchLayout } from "@/components/miner/workbench-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useBenchmarkRuns } from "@/hooks/use-benchmark-runs";
import { useMiningSession } from "@/hooks/use-mining-session";
import { STANDARDIZED_CREATE2_BENCHMARK_PRESET } from "@/lib/standardized-create2-benchmark-preset";

export function BenchmarkConsole() {
  const mining = useMiningSession();
  const { support, sessionState, error, active } = mining;

  const [durationSeconds, setDurationSeconds] = useState("10");
  const [runsInput, setRunsInput] = useState("3");

  const { runProgress, handleRun, handleStop } = useBenchmarkRuns(
    {
      support,
      setError: mining.setError,
      subscribeToSession: mining.subscribeToSession,
      setActiveSession: mining.setActiveSession,
      stopSession: mining.stopSession,
      unsubscribeOnly: mining.unsubscribeOnly,
    },
    durationSeconds,
    runsInput,
  );

  return (
    <WorkbenchLayout
      sidebar={
        <>
          <Card>
            <CardHeader>
              <CardTitle>Benchmark Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>Duration (s)</FieldLabel>
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
        </>
      }
    >
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
    </WorkbenchLayout>
  );
}
