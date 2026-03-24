import type { PreparedJob, PreparedMatcher, SessionConfig } from "../internal/types";
import { toGpuBufferSource } from "../internal/words";
import { buildConstantsWords, createEmptyResultWords, RESULT_BUFFER_SIZE } from "./packing";
import { getMiningShader } from "./shaders";

export interface GpuResources {
  adapterLabel?: string;
  device: GPUDevice;
  paramsBuffer: GPUBuffer;
  resultsBuffer: GPUBuffer;
  readbackBuffer: GPUBuffer;
  pipeline: GPUComputePipeline;
  bindGroup: GPUBindGroup;
  constantsBuffer: GPUBuffer;
}

function adapterLabel(adapter: GPUAdapter): string | undefined {
  const pieces = [adapter.info.vendor, adapter.info.architecture].filter(Boolean);
  return pieces.length > 0 ? pieces.join(" ") : undefined;
}

export async function initializeGpuResources(
  job: PreparedJob,
  matcher: PreparedMatcher,
  config: SessionConfig,
): Promise<GpuResources> {
  if (typeof navigator === "undefined" || navigator.gpu === undefined) {
    throw new Error("WebGPU is not available in this browser");
  }

  const adapter = await navigator.gpu.requestAdapter({
    powerPreference: config.powerPreference ?? "high-performance",
  });

  if (adapter === null) {
    throw new Error("No WebGPU adapter was found");
  }

  const device = await adapter.requestDevice();
  const module = device.createShaderModule({
    code: getMiningShader(job.protocol, matcher.type),
  });
  const constantsData = buildConstantsWords(job, matcher);

  const constantsBuffer = device.createBuffer({
    size: constantsData.byteLength,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(constantsBuffer, 0, toGpuBufferSource(constantsData));

  const paramsBuffer = device.createBuffer({
    size: 8,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const resultsBuffer = device.createBuffer({
    size: RESULT_BUFFER_SIZE,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(resultsBuffer, 0, toGpuBufferSource(createEmptyResultWords()));

  const readbackBuffer = device.createBuffer({
    size: RESULT_BUFFER_SIZE,
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
    resultsBuffer,
    readbackBuffer,
    pipeline,
    bindGroup,
    constantsBuffer,
  };
}

export async function runDispatch(resources: GpuResources, dispatchX: number, dispatchY: number): Promise<void> {
  const encoder = resources.device.createCommandEncoder();
  const pass = encoder.beginComputePass();
  pass.setPipeline(resources.pipeline);
  pass.setBindGroup(0, resources.bindGroup);
  pass.dispatchWorkgroups(dispatchX, dispatchY);
  pass.end();
  resources.device.queue.submit([encoder.finish()]);
  await resources.device.queue.onSubmittedWorkDone();
}

export async function readDispatchResult(resources: GpuResources): Promise<Uint32Array> {
  const encoder = resources.device.createCommandEncoder();
  encoder.copyBufferToBuffer(resources.resultsBuffer, 0, resources.readbackBuffer, 0, RESULT_BUFFER_SIZE);
  resources.device.queue.submit([encoder.finish()]);
  await resources.device.queue.onSubmittedWorkDone();
  await resources.readbackBuffer.mapAsync(GPUMapMode.READ);
  const words = new Uint32Array(resources.readbackBuffer.getMappedRange().slice(0));
  resources.readbackBuffer.unmap();
  return words;
}

export function resetResultsBuffer(resources: GpuResources): void {
  resources.device.queue.writeBuffer(resources.resultsBuffer, 0, toGpuBufferSource(createEmptyResultWords()));
}

export function destroyGpuResources(resources: GpuResources | null): void {
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
