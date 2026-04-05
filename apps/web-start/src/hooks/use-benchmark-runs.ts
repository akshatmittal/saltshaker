import { useEffect, useRef, useState } from "react";

import type { MiningSession, MiningSessionState } from "@akshatmittal/saltshaker";

import { createMiningSession } from "@akshatmittal/saltshaker";

import { STANDARDIZED_CREATE2_BENCHMARK_PRESET } from "@/lib/standardized-create2-benchmark-preset";

const MAX_BENCHMARK_RUNS = 50;

/** Subset of `useMiningSession` needed to drive timed multi-run benchmarks. */
export type BenchmarkMiningApi = {
  support: { supported: boolean };
  setError: (message: string | null) => void;
  subscribeToSession: (session: MiningSession, onState?: (state: MiningSessionState) => void) => void;
  setActiveSession: (session: MiningSession | null) => void;
  stopSession: (options?: { clearState?: boolean }) => void;
  unsubscribeOnly: () => void;
};

export function useBenchmarkRuns(mining: BenchmarkMiningApi, durationSeconds: string, runsInput: string) {
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
    mining.setError(null);

    if (!mining.support.supported) {
      mining.setError("Benchmark mode requires WebGPU.");
      return;
    }

    const parsedRuns = Number.parseInt(runsInput, 10);
    const totalRuns = Number.isFinite(parsedRuns) && parsedRuns >= 1 ? Math.min(parsedRuns, MAX_BENCHMARK_RUNS) : 3;

    userAbortedRef.current = false;
    mining.unsubscribeOnly();
    clearTimer();
    mining.stopSession();

    sequenceRef.current = { active: true, total: totalRuns, completed: 0 };

    const startSingleRun = () => {
      const seq = sequenceRef.current;
      setRunProgress({ current: seq.completed + 1, total: seq.total });

      try {
        const session = createMiningSession({
          job: STANDARDIZED_CREATE2_BENCHMARK_PRESET.job,
          matcher: STANDARDIZED_CREATE2_BENCHMARK_PRESET.matcher,
        });
        mining.setActiveSession(session);

        mining.subscribeToSession(session, (nextState) => {
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

          if (nextState.status === "stopped" && sequenceRef.current.active && !userAbortedRef.current) {
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
          mining.setError(startError instanceof Error ? startError.message : "Benchmark failed");
        });
      } catch (startError) {
        sequenceRef.current.active = false;
        mining.setError(startError instanceof Error ? startError.message : "Benchmark failed");
      }
    };

    startSingleRun();
  }

  function handleStop() {
    userAbortedRef.current = true;
    sequenceRef.current.active = false;
    clearTimer();
    mining.stopSession();
  }

  return { runProgress, handleRun, handleStop };
}
