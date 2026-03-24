import { DEFAULT_DISPATCH_X, DEFAULT_DISPATCH_Y, MAX_RESULTS } from "./constants";
import { prepareJob } from "./internal/jobs";
import { prepareMatcher } from "./internal/matchers/prepare";
import type { SessionConfig } from "./internal/types";
import { createGpuMiningSession } from "./gpu/runtime";
import type { AddressMatcherSpec, CheckWebGpuSupportResult, CreateMiningSessionInput, MiningSession } from "./types";

const DEFAULT_MATCHER_SPEC: AddressMatcherSpec = { type: "leadingZeros", value: 8 };

function adapterLabel(adapter: GPUAdapter): string | undefined {
  const pieces = [adapter.info.vendor, adapter.info.architecture].filter(Boolean);
  return pieces.length > 0 ? pieces.join(" ") : undefined;
}

function resolveConfig(input: CreateMiningSessionInput): SessionConfig {
  return {
    dispatchX: input.dispatch?.x ?? DEFAULT_DISPATCH_X,
    dispatchY: input.dispatch?.y ?? DEFAULT_DISPATCH_Y,
    maxResults: input.maxResults ?? MAX_RESULTS,
    powerPreference: input.powerPreference,
  };
}

export async function checkWebGpuSupport(
  powerPreference: GPUPowerPreference = "high-performance",
): Promise<CheckWebGpuSupportResult> {
  if (typeof navigator === "undefined" || navigator.gpu === undefined) {
    return { supported: false, message: "WebGPU is not available in this environment" };
  }

  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference });
    if (adapter === null) {
      return { supported: false, message: "No WebGPU adapter was found" };
    }

    return {
      supported: true,
      message: "WebGPU ready",
      adapterLabel: adapterLabel(adapter),
    };
  } catch (error) {
    return {
      supported: false,
      message: error instanceof Error ? error.message : "Failed to initialize WebGPU",
    };
  }
}

export function createMiningSession(input: CreateMiningSessionInput): MiningSession {
  return createGpuMiningSession(
    prepareJob(input.job),
    prepareMatcher(input.matcher ?? DEFAULT_MATCHER_SPEC),
    resolveConfig(input),
  );
}
