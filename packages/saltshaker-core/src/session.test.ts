import { afterEach, describe, expect, it, vi } from "vitest";

import type { CreateMiningSessionInput, MiningSessionState } from "./types";

import { createMiningSession } from "./session";

/** Stable CREATE2 job + matcher for session unit tests (mirrors app benchmark preset). */
const TEST_MINING_SESSION_INPUT: Pick<CreateMiningSessionInput, "job" | "matcher"> = {
  job: {
    protocol: "create2",
    deployer: "0x4e59b44847b379578588920cA78FbF26c0B4956C",
    fixedSaltPrefix: "0x73616c747368616b65725f62656e63686d61726b5f763121",
    initCodeHash: "0x6e1cce4955d4b57d9569397925551f2fb36c34f1cfe0f2e8c0c727c44bd08b90",
    startNonce: 0n,
  },
  matcher: { type: "leadingZeros", value: 40 },
};

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
      job: TEST_MINING_SESSION_INPUT.job,
      matcher: TEST_MINING_SESSION_INPUT.matcher,
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
      job: TEST_MINING_SESSION_INPUT.job,
      matcher: TEST_MINING_SESSION_INPUT.matcher,
    });
    const states: MiningSessionState[] = [];

    session.subscribe((state) => states.push(state));
    session.stop();

    expect(states.at(-1)?.status).toBe("stopped");
  });

  it("emits an error state and rejects when webgpu is unavailable", async () => {
    setNavigator(undefined);

    const session = createMiningSession({
      job: TEST_MINING_SESSION_INPUT.job,
      matcher: TEST_MINING_SESSION_INPUT.matcher,
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
