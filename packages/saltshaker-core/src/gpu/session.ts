import {
  DEFAULT_DISPATCH_X,
  DEFAULT_DISPATCH_Y,
  DEFAULT_WORKGROUP_SIZE,
  MAX_RESULTS,
  STANDARDIZED_CREATE2_BENCHMARK_PRESET,
} from "../constants";
import { matchesAddress, mergeCandidate, prepareMatcher } from "../matchers";
import { deriveCandidate, prepareJob } from "../jobs";
import type {
  AddressMatcherSpec,
  CheckWebGpuSupportResult,
  Create2BenchmarkOptions,
  Create2BenchmarkResult,
  MatcherKind,
  PreparedAddressMatcher,
  PreparedMiningJob,
  WebGpuMiningSession,
  WebGpuMiningSessionOptions,
  MiningSessionState,
} from "../types";
import { packBytesToWordsLE, splitBigIntToU32 } from "../utils";
import { getMiningShader } from "./shaders";

interface GpuResources {
  adapterLabel?: string;
  device: GPUDevice;
  paramsBuffer: GPUBuffer;
  constantsBuffer: GPUBuffer;
  resultsBuffer: GPUBuffer;
  readbackBuffer: GPUBuffer;
  pipeline: GPUComputePipeline;
  bindGroup: GPUBindGroup;
}

interface DispatchResources {
  device: GPUDevice;
  pipeline: GPUComputePipeline;
  bindGroup: GPUBindGroup;
}

interface SessionInternals {
  listeners: Set<(state: MiningSessionState) => void>;
  state: MiningSessionState;
  options: Required<Pick<WebGpuMiningSessionOptions, "dispatchX" | "dispatchY" | "maxResults">> & WebGpuMiningSessionOptions;
  matcher: PreparedAddressMatcher;
  job: PreparedMiningJob;
  resources: GpuResources | null;
  loopPromise: Promise<void> | null;
  stopRequested: boolean;
  pauseRequested: boolean;
  startedAt: number | null;
  currentNonce: bigint;
}

const RESULT_WORDS = 8;
const LEADING_ZERO_MATCHER_WORDS = 4;
const PATTERN_MATCHER_WORDS = 9;
const DEFAULT_MATCHER_SPEC: AddressMatcherSpec = { type: "leadingZeros", value: 0 };

function toGpuBufferSource(words: Uint32Array): ArrayBufferView<ArrayBuffer> {
  const buffer = new ArrayBuffer(words.byteLength);
  new Uint8Array(buffer).set(new Uint8Array(words.buffer, words.byteOffset, words.byteLength));
  return new Uint8Array(buffer) as ArrayBufferView<ArrayBuffer>;
}

function adapterLabel(adapter: GPUAdapter): string | undefined {
  const pieces = [adapter.info.vendor, adapter.info.architecture].filter(Boolean);
  return pieces.length > 0 ? pieces.join(" ") : undefined;
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

function initialState(job: PreparedMiningJob): MiningSessionState {
  return {
    protocol: job.protocol,
    status: "idle",
    error: null,
    totalHashes: 0n,
    hashrate: 0,
    elapsedMs: 0,
    currentWindowStart: job.startNonce,
    dispatchesCompleted: 0,
    top: [],
  };
}

function notify(state: MiningSessionState, listeners: Set<(state: MiningSessionState) => void>): void {
  for (const listener of listeners) {
    listener({ ...state, top: [...state.top] });
  }
}

function setState(internals: SessionInternals, partial: Partial<MiningSessionState>): void {
  internals.state = { ...internals.state, ...partial };
  notify(internals.state, internals.listeners);
}

function buildMatcherPatternBlock(matcher: PreparedAddressMatcher): Uint32Array {
  const out = new Uint32Array(PATTERN_MATCHER_WORDS);
  out.set(packBytesToWordsLE(matcher.valueBytes, 5), 0);
  out[5] = matcher.valueBytes.length;
  return out;
}

function buildMatcherBlock(matcher: PreparedAddressMatcher): Uint32Array {
  switch (matcher.type) {
    case "prefix":
    case "suffix":
    case "contains":
      return buildMatcherPatternBlock(matcher);
    case "leadingZeros": {
      const out = new Uint32Array(LEADING_ZERO_MATCHER_WORDS);
      out[0] = matcher.leadingZeroNibbles;
      return out;
    }
  }
}

function buildBaseConstants(job: PreparedMiningJob): Uint32Array {
  if (job.protocol === "create2") {
    const base = new Uint32Array(19);
    base.set(packBytesToWordsLE(job.deployerBytes, 5), 0);
    base.set(packBytesToWordsLE(job.fixedSaltPrefixBytes, 6), 5);
    base.set(packBytesToWordsLE(job.initCodeHashBytes, 8), 11);
    return base;
  }

  const base = new Uint32Array(21);
  base.set(packBytesToWordsLE(job.initializerHashBytes, 8), 0);
  base.set(packBytesToWordsLE(job.factoryBytes, 5), 8);
  base.set(packBytesToWordsLE(job.proxyCreationCodeHashBytes, 8), 13);
  return base;
}

function buildConstants(job: PreparedMiningJob, matcher: PreparedAddressMatcher): Uint32Array {
  const base = buildBaseConstants(job);
  const matcherBlock = buildMatcherBlock(matcher);
  const out = new Uint32Array(base.length + matcherBlock.length);
  out.set(base, 0);
  out.set(matcherBlock, base.length);
  return out;
}

function getShaderForMatcher(job: PreparedMiningJob, matcherKind: MatcherKind): string {
  return getMiningShader(job.protocol, matcherKind);
}

function createEmptyResultWords(): Uint32Array {
  const words = new Uint32Array(RESULT_WORDS);
  words.fill(0xffff_ffff);
  words[7] = 0;
  return words;
}

async function initializeGpuResources(
  job: PreparedMiningJob,
  matcher: PreparedAddressMatcher,
  options: Pick<WebGpuMiningSessionOptions, "dispatchX" | "dispatchY" | "powerPreference">,
): Promise<GpuResources> {
  if (navigator.gpu === undefined) {
    throw new Error("WebGPU is not available in this browser");
  }

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: options.powerPreference ?? "high-performance",
  });

  if (adapter === null) {
    throw new Error("No WebGPU adapter was found");
  }

  const device = await adapter.requestDevice();
  const module = device.createShaderModule({
    code: getShaderForMatcher(job, matcher.type),
  });
  const constantsData = buildConstants(job, matcher);

  const constantsBuffer = device.createBuffer({
    size: constantsData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(constantsBuffer, 0, toGpuBufferSource(constantsData));

  const paramsBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const resultsBuffer = device.createBuffer({
    size: RESULT_WORDS * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(resultsBuffer, 0, toGpuBufferSource(createEmptyResultWords()));

  const readbackBuffer = device.createBuffer({
    size: RESULT_WORDS * 4,
    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
  });

  const pipeline = device.createComputePipeline({
    layout: "auto",
    compute: { module, entryPoint: "main" },
  });

  const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
      { binding: 0, resource: { buffer: constantsBuffer } },
      { binding: 1, resource: { buffer: paramsBuffer } },
      { binding: 2, resource: { buffer: resultsBuffer } },
    ],
  });

  return {
    adapterLabel: adapterLabel(adapter),
    device,
    paramsBuffer,
    constantsBuffer,
    resultsBuffer,
    readbackBuffer,
    pipeline,
    bindGroup,
  };
}

async function readDispatchWinner(resources: GpuResources): Promise<Uint32Array> {
  const commandEncoder = resources.device.createCommandEncoder();
  commandEncoder.copyBufferToBuffer(resources.resultsBuffer, 0, resources.readbackBuffer, 0, RESULT_WORDS * 4);
  resources.device.queue.submit([commandEncoder.finish()]);
  await resources.device.queue.onSubmittedWorkDone();
  await resources.readbackBuffer.mapAsync(GPUMapMode.READ);
  const result = new Uint32Array(resources.readbackBuffer.getMappedRange().slice(0));
  resources.readbackBuffer.unmap();
  return result;
}

function resetResultsBuffer(resources: GpuResources): void {
  resources.device.queue.writeBuffer(resources.resultsBuffer, 0, toGpuBufferSource(createEmptyResultWords()));
}

async function runDispatch(resources: DispatchResources, dispatchX: number, dispatchY: number): Promise<void> {
  const commandEncoder = resources.device.createCommandEncoder();
  const pass = commandEncoder.beginComputePass();
  pass.setPipeline(resources.pipeline);
  pass.setBindGroup(0, resources.bindGroup);
  pass.dispatchWorkgroups(dispatchX, dispatchY);
  pass.end();
  resources.device.queue.submit([commandEncoder.finish()]);
  await resources.device.queue.onSubmittedWorkDone();
}

function updateMetrics(internals: SessionInternals): void {
  if (internals.startedAt === null) {
    return;
  }
  const elapsedMs = performance.now() - internals.startedAt;
  const elapsedSeconds = elapsedMs / 1000;
  setState(internals, {
    elapsedMs,
    hashrate: elapsedSeconds > 0 ? Number(internals.state.totalHashes) / elapsedSeconds : 0,
  });
}

async function miningLoop(internals: SessionInternals): Promise<void> {
  if (internals.resources === null) {
    internals.resources = await initializeGpuResources(internals.job, internals.matcher, internals.options);
    setState(internals, { adapterLabel: internals.resources.adapterLabel });
  }

  const resources = internals.resources;
  const batchSize = BigInt(internals.options.dispatchX * internals.options.dispatchY * DEFAULT_WORKGROUP_SIZE);

  while (!internals.stopRequested && !internals.pauseRequested) {
    const [nonceLow, nonceHigh] = splitBigIntToU32(internals.currentNonce);
    resources.device.queue.writeBuffer(resources.paramsBuffer, 0, new Uint32Array([nonceLow, nonceHigh, 0, 0]));

    await runDispatch(resources, internals.options.dispatchX, internals.options.dispatchY);
    const resultWords = await readDispatchWinner(resources);

    if (resultWords[7] === 1) {
      const nonce = (BigInt(resultWords[1]!) << 32n) | BigInt(resultWords[0]!);
      const candidate = deriveCandidate(internals.job, nonce);
      if (matchesAddress(candidate.address, internals.matcher)) {
        const top = mergeCandidate(internals.state.top, candidate, internals.options.maxResults);
        setState(internals, { top });
      }
    }

    resetResultsBuffer(resources);

    internals.currentNonce += batchSize;
    setState(internals, {
      totalHashes: internals.state.totalHashes + batchSize,
      dispatchesCompleted: internals.state.dispatchesCompleted + 1,
      currentWindowStart: internals.currentNonce,
    });
    updateMetrics(internals);

    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  if (internals.pauseRequested) {
    setState(internals, { status: "paused" });
    return;
  }

  destroyResources(internals.resources);
  internals.resources = null;
  setState(internals, { status: internals.state.status === "error" ? "error" : "stopped" });
}

function destroyResources(resources: GpuResources | null): void {
  if (resources === null) {
    return;
  }
  try {
    resources.constantsBuffer.destroy();
    resources.paramsBuffer.destroy();
    resources.resultsBuffer.destroy();
    resources.readbackBuffer.destroy();
    resources.device.destroy();
  } catch {
    // Ignore cleanup failures from partially initialized devices.
  }
}

export function createWebGpuMiningSession(
  job: PreparedMiningJob,
  matcherSpec: AddressMatcherSpec = DEFAULT_MATCHER_SPEC,
  options: WebGpuMiningSessionOptions = {},
): WebGpuMiningSession {
  const matcher = prepareMatcher(matcherSpec);
  const internals: SessionInternals = {
    listeners: new Set(),
    state: initialState(job),
    options: {
      ...options,
      dispatchX: options.dispatchX ?? DEFAULT_DISPATCH_X,
      dispatchY: options.dispatchY ?? DEFAULT_DISPATCH_Y,
      maxResults: options.maxResults ?? MAX_RESULTS,
    },
    matcher,
    job,
    resources: null,
    loopPromise: null,
    stopRequested: false,
    pauseRequested: false,
    startedAt: null,
    currentNonce: job.startNonce,
  };

  return {
    async start() {
      if (internals.state.status === "running") {
        return;
      }
      if (internals.resources === null) {
        internals.currentNonce = job.startNonce;
        internals.state = initialState(job);
      }

      internals.stopRequested = false;
      internals.pauseRequested = false;
      internals.startedAt = performance.now() - internals.state.elapsedMs;
      setState(internals, { status: "running", error: null });

      internals.loopPromise = miningLoop(internals).catch((error) => {
        setState(internals, {
          status: "error",
          error: error instanceof Error ? error.message : "WebGPU mining failed",
        });
      });

      await internals.loopPromise;
    },
    pause() {
      if (internals.state.status === "running") {
        internals.pauseRequested = true;
      }
    },
    stop() {
      internals.stopRequested = true;
      internals.pauseRequested = false;
      if (internals.state.status !== "running") {
        destroyResources(internals.resources);
        internals.resources = null;
        setState(internals, { status: "stopped" });
      }
    },
    getState() {
      return { ...internals.state, top: [...internals.state.top] };
    },
    subscribe(listener) {
      internals.listeners.add(listener);
      listener({ ...internals.state, top: [...internals.state.top] });
      return () => internals.listeners.delete(listener);
    },
  };
}

export async function runCreate2Benchmark(
  options: Create2BenchmarkOptions = {},
): Promise<Create2BenchmarkResult> {
  const dispatchX = options.dispatchX ?? DEFAULT_DISPATCH_X;
  const dispatchY = options.dispatchY ?? DEFAULT_DISPATCH_Y;
  const durationMs = options.durationMs ?? 10_000;
  const itemsPerDispatch = BigInt(dispatchX * dispatchY * DEFAULT_WORKGROUP_SIZE);
  const job = prepareJob(STANDARDIZED_CREATE2_BENCHMARK_PRESET.job);
  const matcher = prepareMatcher(STANDARDIZED_CREATE2_BENCHMARK_PRESET.matcher);
  const resources = await initializeGpuResources(job, matcher, options);

  let totalHashes = 0n;
  let currentNonce = job.startNonce;
  const startedAt = performance.now();

  while (performance.now() - startedAt < durationMs) {
    const [nonceLow, nonceHigh] = splitBigIntToU32(currentNonce);
    resources.device.queue.writeBuffer(resources.paramsBuffer, 0, toGpuBufferSource(new Uint32Array([nonceLow, nonceHigh, 0, 0])));
    await runDispatch(resources, dispatchX, dispatchY);
    resetResultsBuffer(resources);
    currentNonce += itemsPerDispatch;
    totalHashes += itemsPerDispatch;
  }

  destroyResources(resources);

  const elapsedMs = performance.now() - startedAt;
  const hashrate = elapsedMs > 0 ? Number(totalHashes) / (elapsedMs / 1000) : 0;

  return {
    preset: STANDARDIZED_CREATE2_BENCHMARK_PRESET.version,
    durationMs: elapsedMs,
    totalHashes,
    hashrate,
    dispatchX,
    dispatchY,
    workgroupSize: DEFAULT_WORKGROUP_SIZE,
    adapterLabel: resources.adapterLabel,
  };
}
