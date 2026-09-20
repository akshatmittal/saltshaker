import type { Experiment } from "./experiments";
import type { ResearchOptions, ResearchResult } from "./harness";

interface Attempt {
  experiment: Experiment;
  result?: ResearchResult;
  error?: string;
  geometricSpeedup?: number;
  worstSpeedup?: number;
}

// Bounded, sequential experiments: correctness gates timing; each attempt is
// checkpointed so a later compiler/device failure does not lose earlier results.
export async function runAutoresearch(
  options: Omit<ResearchOptions, "experiment" | "variants"> = {},
  experiments: Experiment[] = [
    { create2ZeroInit: true },
    { implicitZeroInit: true },
    { staticIO: true },
    ...[1, 2, 4, 6, 8, 12].map((roundsPerIteration) => ({ roundsPerIteration, staticIO: true })),
  ],
): Promise<Attempt[]> {
  if (experiments.length < 1 || experiments.length > 16) throw new Error("Choose 1–16 experiments");
  const attempts: Attempt[] = [];
  window.autoresearchAttempts = attempts;
  for (const experiment of experiments) {
    const attempt: Attempt = { experiment };
    try {
      const result = await window.runResearch({ ...options, variants: ["baseline", "current"], experiment });
      attempt.result = result;
      const speedups = result.benchmarks.map((benchmark) => {
        const baseline = benchmark.variants.baseline!;
        const current = benchmark.variants.current!;
        return (baseline.medianGpuMs ?? baseline.medianWallMs) / (current.medianGpuMs ?? current.medianWallMs);
      });
      if (speedups.every((value) => Number.isFinite(value) && value > 0)) {
        attempt.geometricSpeedup = Math.exp(
          speedups.reduce((sum, value) => sum + Math.log(value), 0) / speedups.length,
        );
        attempt.worstSpeedup = Math.min(...speedups);
      }
    } catch (error) {
      attempt.error = String(error);
    }
    attempts.push(attempt);
    localStorage.setItem("saltshaker-autoresearch", JSON.stringify(attempts));
  }
  return attempts;
}

declare global {
  interface Window {
    runAutoresearch: typeof runAutoresearch;
    autoresearchAttempts: Attempt[];
  }
}

window.runAutoresearch = runAutoresearch;
