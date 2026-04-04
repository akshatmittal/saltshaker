import { afterEach, describe, expect, it, vi } from "vitest";

import type { MiningSessionState } from "./types";

import { STANDARDIZED_CREATE2_BENCHMARK_PRESET } from "./constants";
import { createMiningSession } from "./session";

const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");

function setNavigator(value: Navigator | undefined) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  if (navigatorDescriptor) {
    Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "navigator");
  }
  vi.restoreAllMocks();
});

describe("createMiningSession", () => {
  it("emits an initial idle snapshot on subscribe", () => {
    const session = createMiningSession({
      job: STANDARDIZED_CREATE2_BENCHMARK_PRESET.job,
      matcher: STANDARDIZED_CREATE2_BENCHMARK_PRESET.matcher,
    });
    const states: MiningSessionState[] = [];

    const unsubscribe = session.subscribe((state) => states.push(state));
    unsubscribe();

    expect(states).toEqual([
      {
        status: "idle",
        statusDetail: null,
        error: null,
        hashrate: 0,
        elapsedMs: 0,
        results: [],
      },
    ]);
  });

  it("moves to stopped when stopped before start", () => {
    const session = createMiningSession({
      job: STANDARDIZED_CREATE2_BENCHMARK_PRESET.job,
      matcher: STANDARDIZED_CREATE2_BENCHMARK_PRESET.matcher,
    });
    const states: MiningSessionState[] = [];

    session.subscribe((state) => states.push(state));
    session.stop();

    expect(states.at(-1)?.status).toBe("stopped");
  });

  it("emits an error state and rejects when webgpu is unavailable", async () => {
    setNavigator(undefined);

    const session = createMiningSession({
      job: STANDARDIZED_CREATE2_BENCHMARK_PRESET.job,
      matcher: STANDARDIZED_CREATE2_BENCHMARK_PRESET.matcher,
    });
    const states: MiningSessionState[] = [];

    session.subscribe((state) => states.push(state));

    await expect(session.start()).rejects.toThrow("WebGPU is not available in this browser");
    expect(states.at(-1)).toMatchObject({
      status: "error",
      statusDetail: null,
      error: "WebGPU is not available in this browser",
    });
  });
});
