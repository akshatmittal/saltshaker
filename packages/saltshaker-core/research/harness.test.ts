import { afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => vi.stubGlobal("window", {}));
import { runResearch } from "./harness";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.stubGlobal("window", {});
});

describe("research run controls", () => {
  it("rejects an already cancelled run before touching WebGPU, and releases its lock", async () => {
    const requestAdapter = vi.fn().mockResolvedValue(null);
    vi.stubGlobal("navigator", { gpu: { requestAdapter } });
    const controller = new AbortController();
    controller.abort();
    const onProgress = vi.fn();
    await expect(runResearch({}, { signal: controller.signal, onProgress })).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(requestAdapter).not.toHaveBeenCalled();
    expect(onProgress).not.toHaveBeenCalled();
    await expect(runResearch({ variants: ["current"] })).rejects.toThrow("No WebGPU adapter");
    expect(requestAdapter).toHaveBeenCalledOnce();
  });

  it("keeps the lock until pending GPU work settles, then permits a new run", async () => {
    let finishAdapter!: (adapter: null) => void;
    const requestAdapter = vi.fn(
      () =>
        new Promise<null>((resolve) => {
          finishAdapter = resolve;
        }),
    );
    vi.stubGlobal("navigator", { gpu: { requestAdapter } });
    const controller = new AbortController();
    const onProgress = vi.fn();
    const pending = runResearch({ variants: ["current"] }, { signal: controller.signal, onProgress });
    const cancelled = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(requestAdapter).toHaveBeenCalledOnce());
    expect(onProgress).toHaveBeenCalledWith({
      type: "status",
      message: expect.stringContaining("requesting a GPU adapter"),
    });
    controller.abort();
    await expect(runResearch()).rejects.toThrow("already active");
    finishAdapter(null);
    await cancelled;
    requestAdapter.mockImplementation(async () => null);
    await expect(runResearch({ variants: ["current"] })).rejects.toThrow("No WebGPU adapter");
    expect(requestAdapter).toHaveBeenCalledTimes(2);
  });
});
