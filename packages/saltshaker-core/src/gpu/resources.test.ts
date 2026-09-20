import { afterEach, describe, expect, it, vi } from "vitest";

import { prepareJob } from "../internal/jobs";
import { prepareMatcher } from "../internal/matchers/prepare";
import { destroyGpuResources, initializeGpuResources } from "./resources";

const caller = "0x88c6C46EBf353A52Bdbab708c23D0c81dAA8134A";
const zero = "0x0000000000000000000000000000000000000000";
const hash = "0x6e1cce4955d4b57d9569397925551f2fb36c34f1cfe0f2e8c0c727c44bd08b90";
const matcher = prepareMatcher({ type: "leadingZeros", value: 8 });
const config = { dispatchX: 1, dispatchY: 1, maxResults: 1 };

function mockGpu() {
  const device = {
    createShaderModule: vi.fn(() => ({})),
    createComputePipelineAsync: vi.fn(async (_descriptor: GPUComputePipelineDescriptor) => ({
      getBindGroupLayout: () => ({}),
    })),
    createBuffer: vi.fn(() => ({ destroy: vi.fn() })),
    createBindGroup: vi.fn(() => ({})),
    queue: { writeBuffer: vi.fn() },
    destroy: vi.fn(),
  };
  vi.stubGlobal("navigator", {
    gpu: { requestAdapter: async () => ({ info: {}, requestDevice: async () => device }) },
  });
  vi.stubGlobal("GPUBufferUsage", { MAP_READ: 1, COPY_SRC: 4, COPY_DST: 8, UNIFORM: 64, STORAGE: 128 });
  return device;
}

afterEach(() => vi.unstubAllGlobals());

describe("pipeline specialization", () => {
  it("passes each CreateX guard and operation to the actual pipeline descriptor", async () => {
    const device = mockGpu();
    for (const guard of [0, 1, 2, 3]) {
      for (const operation of ["create2", "create3"] as const) {
        const protectedCaller = guard === 1 || guard === 3;
        const crosschain = guard >= 2;
        const job = prepareJob({
          protocol: "createx",
          createOperation: operation,
          factory: "0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed",
          fixedSaltPrefix: `${protectedCaller ? caller : zero}${crosschain ? "01" : "00"}a1b2c3`,
          caller: protectedCaller ? caller : undefined,
          chainId: crosschain ? 8453n : undefined,
          initCodeHash: operation === "create2" ? hash : undefined,
        });
        const resources = await initializeGpuResources(job, matcher, config);
        expect(device.createComputePipelineAsync).toHaveBeenLastCalledWith({
          layout: "auto",
          compute: {
            module: {},
            entryPoint: "main",
            constants: { createx_guard_mode: guard, createx_operation: operation === "create3" ? 1 : 0 },
          },
        });
        destroyGpuResources(resources);
      }
    }
  });

  it("does not send CreateX overrides to a CREATE2 shader", async () => {
    const device = mockGpu();
    const job = prepareJob({
      protocol: "create2",
      deployer: caller,
      initCodeHash: hash,
      fixedSaltPrefix: "0x00112233445566778899aabbccddeeff0123456789abcdef",
    });
    const resources = await initializeGpuResources(job, matcher, config);
    expect(device.createComputePipelineAsync.mock.calls[0]![0].compute.constants).toEqual({});
    destroyGpuResources(resources);
  });
});
