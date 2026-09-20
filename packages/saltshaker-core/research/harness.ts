import { concat, encodeAbiParameters, getAddress, keccak256, pad, toHex, type Address, type Hex } from "viem";

import type { PreparedJob } from "../src/internal/types";
import type { MiningJob } from "../src/types";

import { buildConstantsWords, createEmptyResultWords } from "../src/gpu/packing";
import currentCore from "../src/gpu/shaders/common/core.wgsl?raw";
import productionKernel from "../src/gpu/shaders/common/kernel.wgsl?raw";
import leadingZerosMatcher from "../src/gpu/shaders/matchers/leading-zeros.wgsl?raw";
import create2Protocol from "../src/gpu/shaders/protocols/create2.wgsl?raw";
import createXProtocol from "../src/gpu/shaders/protocols/createx.wgsl?raw";
import safeProtocol from "../src/gpu/shaders/protocols/safe.wgsl?raw";
import { prepareJob, deriveResult } from "../src/internal/jobs";
import { prepareMatcher } from "../src/internal/matchers/prepare";
import { splitBigIntToU32, toGpuBufferSource } from "../src/internal/words";
import { experimentCore, type Experiment } from "./experiments";
import "./autoresearch";

type Variant = "baseline" | "current";
type Protocol = PreparedJob["protocol"];

export interface ResearchOptions {
  variants?: Variant[];
  warmups?: number;
  trials?: number;
  dispatchX?: number;
  dispatchY?: number;
  powerPreference?: GPUPowerPreference;
  timestamps?: boolean;
  experiment?: Experiment;
  workloads?: string[];
}

interface NormalizedOptions {
  variants: Variant[];
  warmups: number;
  trials: number;
  dispatchX: number;
  dispatchY: number;
  powerPreference: GPUPowerPreference;
  timestamps: boolean;
  experiment?: Experiment;
  workloads?: string[];
}

interface Workload {
  name: string;
  job: PreparedJob;
}

interface CompileMeasurement {
  variant: Variant;
  protocol: Protocol;
  entrypoint: "verify" | "production-main";
  ms: number;
}

interface RawSample {
  trial: number;
  order: number;
  wallMs: number;
  gpuMs: number | null;
}

interface BenchmarkVariantResult {
  medianWallMs: number;
  medianGpuMs: number | null;
  samples: RawSample[];
}

interface BenchmarkResult {
  workload: string;
  protocol: Protocol;
  invocations: number;
  variants: Partial<Record<Variant, BenchmarkVariantResult>>;
}

export interface ResearchResult {
  schemaVersion: 1;
  generatedAt: string;
  page: string;
  options: NormalizedOptions;
  environment: {
    userAgent: string;
    coreSha256: Partial<Record<Variant, string>>;
  };
  adapter: {
    vendor: string;
    architecture: string;
    device: string;
    description: string;
    features: string[];
    timestampQuery: boolean;
    limits: {
      maxComputeInvocationsPerWorkgroup: number;
      maxComputeWorkgroupsPerDimension: number;
      maxStorageBufferBindingSize: number;
    };
  };
  compileMs: CompileMeasurement[];
  correctness: {
    passed: true;
    count: number;
    casesPerVariant: number;
    nonces: string[];
    workloads: string[];
  };
  benchmarks: BenchmarkResult[];
}

const WORKGROUP_SIZE = 64;
const VERIFY_INVOCATIONS = 4;
const VERIFY_BASE_NONCE = 0x1234_5678_ffff_fffen;
const MAX_DISPATCH_INVOCATIONS = 1_048_576;
const VERIFY_RESULT_WORDS = 7;
const VERIFY_RESULT_BYTES = VERIFY_INVOCATIONS * VERIFY_RESULT_WORDS * 4;

const protocolSources: Record<Protocol, string> = {
  create2: create2Protocol,
  createx: createXProtocol,
  safe: safeProtocol,
};

const verificationKernel = /* wgsl */ `
struct Constants {
    protocol: ProtocolData,
}

struct Params {
    nonce_low: u32,
    nonce_high: u32,
    count: u32,
    _padding: u32,
}

struct VerificationResult {
    nonce_low: u32,
    nonce_high: u32,
    address: array<u32, 5>,
}

@group(0) @binding(0)
var<storage, read> constants: Constants;
@group(0) @binding(1)
var<uniform> params: Params;
@group(0) @binding(2)
var<storage, read_write> verification_results: array<VerificationResult>;

@compute @workgroup_size(64)
fn verify(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= params.count) {
        return;
    }

    let nonce = add_u64(make_u64(params.nonce_low, params.nonce_high), make_u64(index, 0u));
    verification_results[index].nonce_low = nonce.x;
    verification_results[index].nonce_high = nonce.y;
    verification_results[index].address = protocol_address(constants.protocol, nonce);
}
`;

function assertCondition(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function integerOption(
  value: number | undefined,
  fallback: number,
  name: string,
  minimum: number,
  maximum: number,
): number {
  const resolved = value ?? fallback;
  assertCondition(Number.isInteger(resolved), `${name} must be an integer`);
  assertCondition(resolved >= minimum && resolved <= maximum, `${name} must be between ${minimum} and ${maximum}`);
  return resolved;
}

function normalizeOptions(options: ResearchOptions = {}): NormalizedOptions {
  const variants = options.variants ?? ["baseline", "current"];
  assertCondition(variants.length > 0, "variants must contain baseline, current, or both");
  assertCondition(
    variants.every((variant) => variant === "baseline" || variant === "current"),
    "Unknown variant",
  );
  assertCondition(new Set(variants).size === variants.length, "variants must not contain duplicates");

  const dispatchX = integerOption(options.dispatchX, 8, "dispatchX", 1, 65_535);
  const dispatchY = integerOption(options.dispatchY, 1, "dispatchY", 1, 65_535);
  assertCondition(
    dispatchX * dispatchY * WORKGROUP_SIZE <= MAX_DISPATCH_INVOCATIONS,
    `dispatch is limited to ${MAX_DISPATCH_INVOCATIONS.toLocaleString()} invocations`,
  );

  return {
    variants: [...variants],
    warmups: integerOption(options.warmups, 2, "warmups", 0, 20),
    trials: integerOption(options.trials, 7, "trials", 1, 50),
    dispatchX,
    dispatchY,
    powerPreference: options.powerPreference ?? "high-performance",
    timestamps: options.timestamps ?? true,
    experiment: options.experiment,
    workloads: options.workloads,
  };
}

function fixedPrefix(sender: Address, flag: "00" | "01", suffix: string): Hex {
  assertCondition(/^[0-9a-f]{6}$/i.test(suffix), "CreateX prefix suffix must be three bytes");
  return `${sender}${flag}${suffix}` as Hex;
}

function createWorkloads(): Workload[] {
  const zero = "0x0000000000000000000000000000000000000000";
  const caller = "0x1111111111111111111111111111111111111111";
  const factory = "0x2222222222222222222222222222222222222222";
  const hash = "0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const commonStart = VERIFY_BASE_NONCE;

  const inputs: Array<{ name: string; input: MiningJob }> = [
    {
      name: "create2",
      input: {
        protocol: "create2",
        deployer: "0x3333333333333333333333333333333333333333",
        fixedSaltPrefix: "0x00112233445566778899aabbccddeeff0123456789abcdef",
        initCodeHash: hash,
        startNonce: commonStart,
      },
    },
    {
      name: "safe",
      input: {
        protocol: "safe",
        owners: [caller, "0x4444444444444444444444444444444444444444"],
        threshold: 2n,
        to: zero,
        data: "0x1234",
        fallbackHandler: "0x5555555555555555555555555555555555555555",
        paymentToken: zero,
        payment: 0n,
        paymentReceiver: zero,
        factory,
        proxyCreationCodeHash: hash,
        startNonce: commonStart,
      },
    },
  ];

  const guardInputs = [
    { mode: 0, prefix: fixedPrefix(zero, "00", "a0b0c0") },
    { mode: 1, prefix: fixedPrefix(caller, "00", "a1b1c1"), caller },
    { mode: 2, prefix: fixedPrefix(zero, "01", "a2b2c2"), chainId: 0x0102_0304_0506_0708n },
    {
      mode: 3,
      prefix: fixedPrefix(caller, "01", "a3b3c3"),
      caller,
      chainId: 0x0102_0304_0506_0708n,
    },
  ] as const;

  for (const guard of guardInputs) {
    for (const operation of ["create2", "create3"] as const) {
      inputs.push({
        name: `createx-${operation}-guard${guard.mode}`,
        input: {
          protocol: "createx",
          createOperation: operation,
          factory,
          fixedSaltPrefix: guard.prefix,
          caller: "caller" in guard ? guard.caller : undefined,
          chainId: "chainId" in guard ? guard.chainId : undefined,
          initCodeHash: operation === "create2" ? hash : undefined,
          startNonce: commonStart,
        },
      });
    }
  }

  return inputs.map(({ name, input }) => {
    const job = prepareJob(input);
    if (job.protocol === "createx") {
      const expectedMode = Number(name.at(-1));
      assertCondition(job.guardMode === expectedMode, `${name} prepared unexpected guard mode ${job.guardMode}`);
    }
    return { name, job };
  });
}

function addressFromHash(hash: Hex): Address {
  return getAddress(`0x${hash.slice(-40)}`);
}

function directCpuAddress(job: PreparedJob, nonce: bigint): Address {
  if (job.protocol === "create2") {
    const salt = concat([toHex(job.fixedSaltPrefixBytes), toHex(nonce, { size: 8 })]);
    return addressFromHash(keccak256(concat(["0xff", job.deployer, salt, job.initCodeHash])));
  }

  if (job.protocol === "safe") {
    const salt = keccak256(concat([job.initializerHash, pad(toHex(nonce), { size: 32 })]));
    return addressFromHash(keccak256(concat(["0xff", job.factory, salt, job.proxyCreationCodeHash])));
  }

  const unguardedSalt = concat([toHex(job.fixedSaltPrefixBytes), toHex(nonce, { size: 8 })]);
  let guardedSalt: Hex;
  if (job.guardMode === 0) {
    guardedSalt = keccak256(unguardedSalt);
  } else if (job.guardMode === 1) {
    assertCondition(job.caller !== null, "Guard mode 1 requires caller");
    guardedSalt = keccak256(
      encodeAbiParameters([{ type: "address" }, { type: "bytes32" }], [job.caller, unguardedSalt]),
    );
  } else if (job.guardMode === 2) {
    assertCondition(job.chainId !== null, "Guard mode 2 requires chain ID");
    guardedSalt = keccak256(
      encodeAbiParameters([{ type: "uint256" }, { type: "bytes32" }], [job.chainId, unguardedSalt]),
    );
  } else {
    assertCondition(job.caller !== null && job.chainId !== null, "Guard mode 3 requires caller and chain ID");
    guardedSalt = keccak256(
      encodeAbiParameters(
        [{ type: "address" }, { type: "uint256" }, { type: "bytes32" }],
        [job.caller, job.chainId, unguardedSalt],
      ),
    );
  }

  const proxy = addressFromHash(keccak256(concat(["0xff", job.factory, guardedSalt, job.proxyChildCodeHash])));
  if (job.createOperation === "create3") {
    return addressFromHash(keccak256(concat(["0xd6", "0x94", proxy, "0x01"])));
  }
  return addressFromHash(keccak256(concat(["0xff", job.factory, guardedSalt, job.initCodeHash])));
}

function decodeAddress(words: Uint32Array, offset: number): Address {
  const bytes = new Uint8Array(20);
  for (let wordIndex = 0; wordIndex < 5; wordIndex += 1) {
    const word = words[offset + wordIndex]!;
    for (let byteIndex = 0; byteIndex < 4; byteIndex += 1) {
      bytes[wordIndex * 4 + byteIndex] = (word >>> (byteIndex * 8)) & 0xff;
    }
  }
  return getAddress(toHex(bytes));
}

function median(values: number[]): number {
  assertCondition(values.length > 0, "Cannot take median of an empty sample set");
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

async function sha256(source: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

class GpuGuard {
  readonly errors: string[] = [];

  constructor(readonly device: GPUDevice) {
    device.addEventListener("uncapturederror", (event) => {
      this.errors.push(`Uncaptured GPU error: ${event.error.message}`);
    });
    void device.lost.then((info) => {
      if (info.reason !== "destroyed") {
        this.errors.push(`GPU device lost (${info.reason}): ${info.message}`);
      }
    });
  }

  assertHealthy(label: string): void {
    assertCondition(this.errors.length === 0, `${label}: ${this.errors.join("; ")}`);
  }

  async scoped<T>(label: string, operation: () => Promise<T> | T): Promise<T> {
    const filters: GPUErrorFilter[] = ["validation", "out-of-memory", "internal"];
    for (const filter of filters) this.device.pushErrorScope(filter);
    let value: T | undefined;
    let operationError: unknown;
    try {
      value = await operation();
    } catch (error) {
      operationError = error;
    }

    const scopeErrors: string[] = [];
    for (let index = filters.length - 1; index >= 0; index -= 1) {
      const error = await this.device.popErrorScope();
      if (error !== null) scopeErrors.push(error.message);
    }
    if (operationError !== undefined) throw operationError;
    assertCondition(scopeErrors.length === 0, `${label}: ${scopeErrors.join("; ")}`);
    this.assertHealthy(label);
    return value as T;
  }
}

async function loadCores(variants: Variant[], experiment?: Experiment): Promise<Record<Variant, string | undefined>> {
  let baseline: string | undefined;
  if (variants.includes("baseline") || experiment !== undefined) {
    const response = await fetch("./baseline.wgsl", { cache: "no-store" });
    const body = await response.text();
    assertCondition(
      response.ok && body.includes("fn keccakf"),
      "baseline.wgsl is missing or invalid; copy the pre-change production core as described in research/README.md",
    );
    baseline = body;
  }
  return { baseline, current: experiment === undefined ? currentCore : experimentCore(baseline!, experiment) };
}

async function compilePipeline(
  guard: GpuGuard,
  source: string,
  entryPoint: "verify" | "main",
  label: string,
): Promise<{ pipeline: GPUComputePipeline; ms: number }> {
  window.researchProgress = `Compiling ${label}`;
  const started = performance.now();
  const pipeline = await guard.scoped(`Compile ${label}`, async () => {
    const module = guard.device.createShaderModule({ label, code: source });
    const info = await module.getCompilationInfo();
    const errors = info.messages.filter((message) => message.type === "error");
    assertCondition(
      errors.length === 0,
      `${label} WGSL compilation failed:\n${errors
        .map((message) => `${message.lineNum}:${message.linePos} ${message.message}`)
        .join("\n")}`,
    );
    return guard.device.createComputePipelineAsync({
      label,
      layout: "auto",
      compute: { module, entryPoint },
    });
  });
  return { pipeline, ms: performance.now() - started };
}

function createBuffer(device: GPUDevice, label: string, size: number, usage: GPUBufferUsageFlags): GPUBuffer {
  return device.createBuffer({ label, size, usage });
}

function writeWords(device: GPUDevice, buffer: GPUBuffer, words: Uint32Array): void {
  device.queue.writeBuffer(buffer, 0, toGpuBufferSource(words));
}

async function verifyWorkload(
  guard: GpuGuard,
  pipeline: GPUComputePipeline,
  workload: Workload,
  variant: Variant,
): Promise<number> {
  const buffers: GPUBuffer[] = [];
  try {
    const { bindGroup, outputBuffer, readbackBuffer } = await guard.scoped(
      `Allocate ${variant}/${workload.name} verification resources`,
      () => {
        const constants = buildConstantsWords(workload.job, prepareMatcher({ type: "leadingZeros", value: 16 }));
        const constantsBuffer = createBuffer(
          guard.device,
          `${variant}-${workload.name}-verify-constants`,
          constants.byteLength,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        );
        const paramsBuffer = createBuffer(
          guard.device,
          `${variant}-${workload.name}-verify-params`,
          16,
          GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        );
        const outputBuffer = createBuffer(
          guard.device,
          `${variant}-${workload.name}-verify-output`,
          VERIFY_RESULT_BYTES,
          GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
        );
        const readbackBuffer = createBuffer(
          guard.device,
          `${variant}-${workload.name}-verify-readback`,
          VERIFY_RESULT_BYTES,
          GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        );
        buffers.push(constantsBuffer, paramsBuffer, outputBuffer, readbackBuffer);

        writeWords(guard.device, constantsBuffer, constants);
        const [low, high] = splitBigIntToU32(VERIFY_BASE_NONCE);
        writeWords(guard.device, paramsBuffer, new Uint32Array([low, high, VERIFY_INVOCATIONS, 0]));
        const bindGroup = guard.device.createBindGroup({
          label: `${variant}-${workload.name}-verify-bind-group`,
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: constantsBuffer } },
            { binding: 1, resource: { buffer: paramsBuffer } },
            { binding: 2, resource: { buffer: outputBuffer } },
          ],
        });
        return { bindGroup, outputBuffer, readbackBuffer };
      },
    );

    await guard.scoped(`Verify ${variant}/${workload.name}`, async () => {
      const encoder = guard.device.createCommandEncoder();
      const pass = encoder.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.ceil(VERIFY_INVOCATIONS / WORKGROUP_SIZE));
      pass.end();
      encoder.copyBufferToBuffer(outputBuffer, 0, readbackBuffer, 0, VERIFY_RESULT_BYTES);
      guard.device.queue.submit([encoder.finish()]);
      await guard.device.queue.onSubmittedWorkDone();
    });

    await readbackBuffer.mapAsync(GPUMapMode.READ);
    const words = new Uint32Array(readbackBuffer.getMappedRange().slice(0));
    readbackBuffer.unmap();

    for (let index = 0; index < VERIFY_INVOCATIONS; index += 1) {
      const offset = index * VERIFY_RESULT_WORDS;
      const gpuNonce = (BigInt(words[offset + 1]!) << 32n) | BigInt(words[offset]!);
      const expectedNonce = VERIFY_BASE_NONCE + BigInt(index);
      assertCondition(gpuNonce === expectedNonce, `${variant}/${workload.name}: GPU returned nonce ${toHex(gpuNonce)}`);

      const directAddress = directCpuAddress(workload.job, expectedNonce);
      const apiAddress = deriveResult(workload.job, expectedNonce, 0).address;
      assertCondition(
        apiAddress === directAddress,
        `${workload.name}: production CPU derivation ${apiAddress} != direct viem derivation ${directAddress}`,
      );
      const gpuAddress = decodeAddress(words, offset + 2);
      assertCondition(
        gpuAddress === directAddress,
        `${variant}/${workload.name}/${toHex(expectedNonce)}: GPU ${gpuAddress} != viem ${directAddress}`,
      );
    }
    return VERIFY_INVOCATIONS;
  } finally {
    for (const buffer of buffers) buffer.destroy();
  }
}

interface BenchmarkResources {
  bindGroup: GPUBindGroup;
  bestBuffer: GPUBuffer;
  buffers: GPUBuffer[];
  querySet: GPUQuerySet | null;
  queryResolveBuffer: GPUBuffer | null;
  queryReadBuffer: GPUBuffer | null;
}

function createBenchmarkResources(
  device: GPUDevice,
  pipeline: GPUComputePipeline,
  workload: Workload,
  variant: Variant,
  useTimestamps: boolean,
): BenchmarkResources {
  const buffers: GPUBuffer[] = [];
  const constants = buildConstantsWords(workload.job, prepareMatcher({ type: "leadingZeros", value: 16 }));
  const constantsBuffer = createBuffer(
    device,
    `${variant}-${workload.name}-constants`,
    constants.byteLength,
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  );
  const paramsBuffer = createBuffer(
    device,
    `${variant}-${workload.name}-params`,
    16,
    GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  );
  const bestBuffer = createBuffer(
    device,
    `${variant}-${workload.name}-best`,
    32,
    GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  );
  buffers.push(constantsBuffer, paramsBuffer, bestBuffer);
  writeWords(device, constantsBuffer, constants);
  const [low, high] = splitBigIntToU32(workload.job.startNonce);
  writeWords(device, paramsBuffer, new Uint32Array([low, high, 0, 0]));
  writeWords(device, bestBuffer, createEmptyResultWords());

  let querySet: GPUQuerySet | null = null;
  let queryResolveBuffer: GPUBuffer | null = null;
  let queryReadBuffer: GPUBuffer | null = null;
  if (useTimestamps) {
    querySet = device.createQuerySet({ label: `${variant}-${workload.name}-timestamps`, type: "timestamp", count: 2 });
    queryResolveBuffer = createBuffer(
      device,
      `${variant}-${workload.name}-timestamp-resolve`,
      16,
      GPUBufferUsage.QUERY_RESOLVE | GPUBufferUsage.COPY_SRC,
    );
    queryReadBuffer = createBuffer(
      device,
      `${variant}-${workload.name}-timestamp-read`,
      16,
      GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    );
    buffers.push(queryResolveBuffer, queryReadBuffer);
  }

  return {
    bindGroup: device.createBindGroup({
      label: `${variant}-${workload.name}-benchmark-bind-group`,
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: constantsBuffer } },
        { binding: 1, resource: { buffer: paramsBuffer } },
        { binding: 2, resource: { buffer: bestBuffer } },
      ],
    }),
    bestBuffer,
    buffers,
    querySet,
    queryResolveBuffer,
    queryReadBuffer,
  };
}

function destroyBenchmarkResources(resources: BenchmarkResources): void {
  resources.querySet?.destroy();
  for (const buffer of resources.buffers) buffer.destroy();
}

async function dispatchBenchmark(
  guard: GpuGuard,
  pipeline: GPUComputePipeline,
  resources: BenchmarkResources,
  options: NormalizedOptions,
  timed: boolean,
): Promise<{ wallMs: number; gpuMs: number | null }> {
  let timestampWrites: GPUComputePassTimestampWrites | undefined;
  const wallMs = await guard.scoped("Benchmark dispatch", async () => {
    writeWords(guard.device, resources.bestBuffer, createEmptyResultWords());
    const encoder = guard.device.createCommandEncoder();
    timestampWrites =
      timed && resources.querySet !== null
        ? { querySet: resources.querySet, beginningOfPassWriteIndex: 0, endOfPassWriteIndex: 1 }
        : undefined;
    const pass = encoder.beginComputePass({ timestampWrites });
    pass.setPipeline(pipeline);
    pass.setBindGroup(0, resources.bindGroup);
    pass.dispatchWorkgroups(options.dispatchX, options.dispatchY);
    pass.end();
    if (
      timestampWrites !== undefined &&
      resources.querySet !== null &&
      resources.queryResolveBuffer !== null &&
      resources.queryReadBuffer !== null
    ) {
      encoder.resolveQuerySet(resources.querySet, 0, 2, resources.queryResolveBuffer, 0);
      encoder.copyBufferToBuffer(resources.queryResolveBuffer, 0, resources.queryReadBuffer, 0, 16);
    }

    const started = performance.now();
    guard.device.queue.submit([encoder.finish()]);
    await guard.device.queue.onSubmittedWorkDone();
    return performance.now() - started;
  });

  let gpuMs: number | null = null;
  if (timestampWrites !== undefined && resources.queryReadBuffer !== null) {
    await resources.queryReadBuffer.mapAsync(GPUMapMode.READ);
    const timestamps = new BigUint64Array(resources.queryReadBuffer.getMappedRange().slice(0));
    resources.queryReadBuffer.unmap();
    assertCondition(timestamps.length === 2 && timestamps[1]! >= timestamps[0]!, "Invalid GPU timestamps");
    gpuMs = Number(timestamps[1]! - timestamps[0]!) / 1_000_000;
  }
  return { wallMs, gpuMs };
}

function pipelineKey(variant: Variant, protocol: Protocol, entrypoint: "verify" | "production-main"): string {
  return `${variant}/${protocol}/${entrypoint}`;
}

async function run(optionsInput: ResearchOptions = {}): Promise<ResearchResult> {
  const options = normalizeOptions(optionsInput);
  assertCondition(navigator.gpu !== undefined, "WebGPU is not available in this browser");
  const cores = await loadCores(options.variants, options.experiment);
  const coreSha256: Partial<Record<Variant, string>> = {};
  for (const variant of options.variants) coreSha256[variant] = await sha256(cores[variant]!);
  const allWorkloads = createWorkloads();
  const workloads = allWorkloads.filter(
    (workload) => options.workloads === undefined || options.workloads.includes(workload.name),
  );
  assertCondition(
    workloads.length > 0 &&
      (options.workloads === undefined ||
        options.workloads.every((name) => allWorkloads.some((workload) => workload.name === name))),
    "Unknown or empty workload selection",
  );
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: options.powerPreference });
  assertCondition(adapter !== null, "No WebGPU adapter was found");
  assertCondition(
    options.dispatchX <= adapter.limits.maxComputeWorkgroupsPerDimension,
    "dispatchX exceeds adapter limit",
  );
  assertCondition(
    options.dispatchY <= adapter.limits.maxComputeWorkgroupsPerDimension,
    "dispatchY exceeds adapter limit",
  );

  const timestampQuery = options.timestamps && adapter.features.has("timestamp-query");
  const device = await adapter.requestDevice({ requiredFeatures: timestampQuery ? ["timestamp-query"] : [] });
  const guard = new GpuGuard(device);
  const compileMs: CompileMeasurement[] = [];
  const pipelines = new Map<string, GPUComputePipeline>();

  const getPipeline = async (
    variant: Variant,
    protocol: Protocol,
    entrypoint: "verify" | "production-main",
  ): Promise<GPUComputePipeline> => {
    const key = pipelineKey(variant, protocol, entrypoint);
    const existing = pipelines.get(key);
    if (existing !== undefined) return existing;
    const core = cores[variant];
    assertCondition(core !== undefined, `No core source loaded for ${variant}`);
    const source =
      entrypoint === "verify"
        ? [core, protocolSources[protocol], verificationKernel].join("\n")
        : [core, leadingZerosMatcher, protocolSources[protocol], productionKernel].join("\n");
    const compiled = await compilePipeline(
      guard,
      source,
      entrypoint === "verify" ? "verify" : "main",
      `${variant}-${protocol}-${entrypoint}`,
    );
    pipelines.set(key, compiled.pipeline);
    compileMs.push({ variant, protocol, entrypoint, ms: compiled.ms });
    return compiled.pipeline;
  };

  try {
    let correctnessCount = 0;
    for (const variant of options.variants) {
      for (const workload of workloads) {
        const pipeline = await getPipeline(variant, workload.job.protocol, "verify");
        correctnessCount += await verifyWorkload(guard, pipeline, workload, variant);
      }
    }

    const benchmarks: BenchmarkResult[] = [];
    for (const workload of workloads) {
      window.researchProgress = `Benchmarking ${workload.name}`;
      const resources = new Map<Variant, BenchmarkResources>();
      const productionPipelines = new Map<Variant, GPUComputePipeline>();
      const samples = new Map<Variant, RawSample[]>();
      try {
        for (const variant of options.variants) {
          const pipeline = await getPipeline(variant, workload.job.protocol, "production-main");
          productionPipelines.set(variant, pipeline);
          resources.set(
            variant,
            await guard.scoped(`Allocate ${variant}/${workload.name} benchmark resources`, () =>
              createBenchmarkResources(device, pipeline, workload, variant, timestampQuery),
            ),
          );
          samples.set(variant, []);
        }

        for (let warmup = 0; warmup < options.warmups; warmup += 1) {
          const order = warmup % 2 === 0 ? options.variants : [...options.variants].reverse();
          for (const variant of order) {
            await dispatchBenchmark(guard, productionPipelines.get(variant)!, resources.get(variant)!, options, false);
          }
        }

        for (let trial = 0; trial < options.trials; trial += 1) {
          const order = trial % 2 === 0 ? options.variants : [...options.variants].reverse();
          for (let orderIndex = 0; orderIndex < order.length; orderIndex += 1) {
            const variant = order[orderIndex]!;
            const timing = await dispatchBenchmark(
              guard,
              productionPipelines.get(variant)!,
              resources.get(variant)!,
              options,
              true,
            );
            samples.get(variant)!.push({ trial, order: orderIndex, ...timing });
          }
        }

        const variants: Partial<Record<Variant, BenchmarkVariantResult>> = {};
        for (const variant of options.variants) {
          const raw = samples.get(variant)!;
          const gpuSamples = raw.flatMap((sample) => (sample.gpuMs === null ? [] : [sample.gpuMs]));
          variants[variant] = {
            medianWallMs: median(raw.map((sample) => sample.wallMs)),
            medianGpuMs: gpuSamples.length === 0 ? null : median(gpuSamples),
            samples: raw,
          };
        }
        benchmarks.push({
          workload: workload.name,
          protocol: workload.job.protocol,
          invocations: options.dispatchX * options.dispatchY * WORKGROUP_SIZE,
          variants,
        });
      } finally {
        for (const resource of resources.values()) destroyBenchmarkResources(resource);
      }
    }

    guard.assertHealthy("Research run");
    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      page: window.location.href,
      options,
      environment: {
        userAgent: navigator.userAgent,
        coreSha256,
      },
      adapter: {
        vendor: adapter.info.vendor,
        architecture: adapter.info.architecture,
        device: adapter.info.device,
        description: adapter.info.description,
        features: [...adapter.features].sort(),
        timestampQuery,
        limits: {
          maxComputeInvocationsPerWorkgroup: adapter.limits.maxComputeInvocationsPerWorkgroup,
          maxComputeWorkgroupsPerDimension: adapter.limits.maxComputeWorkgroupsPerDimension,
          maxStorageBufferBindingSize: adapter.limits.maxStorageBufferBindingSize,
        },
      },
      compileMs,
      correctness: {
        passed: true,
        count: correctnessCount,
        casesPerVariant: workloads.length * VERIFY_INVOCATIONS,
        nonces: Array.from({ length: VERIFY_INVOCATIONS }, (_, index) => toHex(VERIFY_BASE_NONCE + BigInt(index))),
        workloads: workloads.map((workload) => workload.name),
      },
      benchmarks,
    };
  } finally {
    device.destroy();
  }
}

declare global {
  interface Window {
    runResearch: (options?: ResearchOptions) => Promise<ResearchResult>;
    researchProgress: string;
  }
}

window.runResearch = run;

const button = document.querySelector<HTMLButtonElement>("#run");
const optionsElement = document.querySelector<HTMLTextAreaElement>("#options");
const output = document.querySelector<HTMLElement>("#output");
if (button !== null && optionsElement !== null && output !== null) {
  button.addEventListener("click", async () => {
    button.disabled = true;
    output.textContent = "Running…";
    try {
      const options = JSON.parse(optionsElement.value) as ResearchOptions;
      const result = await run(options);
      output.textContent = JSON.stringify(result, null, 2);
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      output.textContent = message;
      console.error(error);
    } finally {
      button.disabled = false;
    }
  });
}
