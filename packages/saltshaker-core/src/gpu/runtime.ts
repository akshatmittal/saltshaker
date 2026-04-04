import type { PreparedJob, PreparedMatcher, SessionConfig } from "../internal/types";
import type { MiningSession, MiningSessionState } from "../types";

import { DEFAULT_WORKGROUP_SIZE } from "../constants";
import { deriveResult } from "../internal/jobs";
import { mergeResult } from "../internal/matchers/results";
import { scoreAddress } from "../internal/matchers/score";
import { yieldToBrowser } from "../internal/gpu-browser";
import { splitBigIntToU32, toGpuBufferSource } from "../internal/words";
import { decodeResultWords } from "./packing";
import {
  destroyGpuResources,
  initializeGpuResources,
  readDispatchResult,
  resetResultsBuffer,
  runDispatch,
  type GpuResources,
} from "./resources";

interface SessionRuntime {
  listeners: Set<(state: MiningSessionState) => void>;
  state: MiningSessionState;
  config: SessionConfig;
  matcher: PreparedMatcher;
  job: PreparedJob;
  resources: GpuResources | null;
  loopPromise: Promise<void> | null;
  stopRequested: boolean;
  startedAt: number | null;
  currentNonce: bigint;
  totalHashes: bigint;
}

function initialState(): MiningSessionState {
  return {
    status: "idle",
    statusDetail: null,
    error: null,
    hashrate: 0,
    elapsedMs: 0,
    results: [],
  };
}

function snapshot(state: MiningSessionState): MiningSessionState {
  return { ...state, results: [...state.results] };
}

function setState(runtime: SessionRuntime, partial: Partial<MiningSessionState>): void {
  runtime.state = { ...runtime.state, ...partial };
  const next = snapshot(runtime.state);
  for (const listener of runtime.listeners) {
    listener(next);
  }
}

function updateMetrics(runtime: SessionRuntime): void {
  if (runtime.startedAt === null) {
    return;
  }

  const elapsedMs = performance.now() - runtime.startedAt;
  const elapsedSeconds = elapsedMs / 1000;
  setState(runtime, {
    elapsedMs,
    hashrate: elapsedSeconds > 0 ? Number(runtime.totalHashes) / elapsedSeconds : 0,
  });
}

function resetRunState(runtime: SessionRuntime): void {
  runtime.currentNonce = runtime.job.startNonce;
  runtime.totalHashes = 0n;
  runtime.startedAt = null;
  runtime.state = initialState();
}

async function ensureResources(runtime: SessionRuntime): Promise<GpuResources> {
  if (runtime.resources === null) {
    runtime.resources = await initializeGpuResources(runtime.job, runtime.matcher, runtime.config, {
      onStatus(detail) {
        setState(runtime, { status: "preparing", statusDetail: detail });
      },
    });
  }

  return runtime.resources;
}

async function runLoop(runtime: SessionRuntime): Promise<void> {
  const resources = await ensureResources(runtime);
  if (runtime.stopRequested) {
    return;
  }

  runtime.startedAt = performance.now();
  setState(runtime, { status: "running", statusDetail: null });
  const batchSize = BigInt(runtime.config.dispatchX * runtime.config.dispatchY * DEFAULT_WORKGROUP_SIZE);

  while (!runtime.stopRequested) {
    const [nonceLow, nonceHigh] = splitBigIntToU32(runtime.currentNonce);
    resources.device.queue.writeBuffer(
      resources.paramsBuffer,
      0,
      toGpuBufferSource(new Uint32Array([nonceLow, nonceHigh])),
    );

    await runDispatch(resources, runtime.config.dispatchX, runtime.config.dispatchY);
    const result = decodeResultWords(await readDispatchResult(resources));

    if (result !== null) {
      const mined = deriveResult(runtime.job, result.nonce, result.score);
      const score = scoreAddress(mined.address, runtime.matcher);

      if (score === result.score && score > 0) {
        setState(runtime, {
          results: mergeResult(runtime.state.results, mined, runtime.config.maxResults),
        });
      }
    }

    resetResultsBuffer(resources);
    runtime.currentNonce += batchSize;
    runtime.totalHashes += batchSize;
    updateMetrics(runtime);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

export function createGpuMiningSession(
  job: PreparedJob,
  matcher: PreparedMatcher,
  config: SessionConfig,
): MiningSession {
  const runtime: SessionRuntime = {
    listeners: new Set(),
    state: initialState(),
    config,
    matcher,
    job,
    resources: null,
    loopPromise: null,
    stopRequested: false,
    startedAt: null,
    currentNonce: job.startNonce,
    totalHashes: 0n,
  };

  return {
    async start() {
      if (runtime.state.status === "preparing" || runtime.state.status === "running") {
        return;
      }

      if (runtime.resources === null) {
        resetRunState(runtime);
      }

      runtime.stopRequested = false;
      runtime.startedAt = null;
      setState(runtime, { status: "preparing", statusDetail: "Preparing GPU miner", error: null });
      await yieldToBrowser();

      try {
        runtime.loopPromise = runLoop(runtime);
        await runtime.loopPromise;
        destroyGpuResources(runtime.resources);
        runtime.resources = null;
        setState(runtime, { status: "stopped", statusDetail: null });
      } catch (error) {
        destroyGpuResources(runtime.resources);
        runtime.resources = null;
        setState(runtime, {
          status: "error",
          statusDetail: null,
          error: error instanceof Error ? error.message : "WebGPU mining failed",
        });
        throw error;
      }
    },
    stop() {
      runtime.stopRequested = true;

      if (runtime.state.status !== "running") {
        destroyGpuResources(runtime.resources);
        runtime.resources = null;
        setState(runtime, { status: "stopped", statusDetail: null });
      }
    },
    subscribe(listener) {
      runtime.listeners.add(listener);
      listener(snapshot(runtime.state));
      return () => runtime.listeners.delete(listener);
    },
  };
}
