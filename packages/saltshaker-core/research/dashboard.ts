import { runResearch, type ResearchOptions, type ResearchProgress, type ResearchResult } from "./harness";

type Benchmark = ResearchResult["benchmarks"][number];
type ResultView = "recorded" | "local";
type RunState = "idle" | "running" | "stopping" | "complete" | "cancelled" | "failed";

interface RecordedEnvelope {
  status: "done";
  result: ResearchResult;
}

interface AdapterInfoLike {
  vendor?: string;
  architecture?: string;
  device?: string;
  description?: string;
}

declare global {
  interface Window {
    __dashboardTimer?: number;
  }
}

function requiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Missing dashboard element: ${selector}`);
  return element;
}

const form = requiredElement<HTMLFormElement>("#research-form");
const startButton = requiredElement<HTMLButtonElement>("#start-button");
const stopButton = requiredElement<HTMLButtonElement>("#stop-button");
const retryButton = requiredElement<HTMLButtonElement>("#retry-button");
const recordedViewButton = requiredElement<HTMLButtonElement>("#recorded-view");
const localViewButton = requiredElement<HTMLButtonElement>("#local-view");
const exportButton = requiredElement<HTMLButtonElement>("#export-button");
const compareBaseline = requiredElement<HTMLInputElement>("#compare-baseline");
const dispatchX = requiredElement<HTMLInputElement>("#dispatch-x");
const trials = requiredElement<HTMLInputElement>("#trials");
const warmups = requiredElement<HTMLInputElement>("#warmups");
const capabilityBadge = requiredElement<HTMLElement>("#capability-badge");
const adapterName = requiredElement<HTMLElement>("#adapter-name");
const adapterType = requiredElement<HTMLElement>("#adapter-type");
const timestampSupport = requiredElement<HTMLElement>("#timestamp-support");
const capabilityHelp = requiredElement<HTMLElement>("#capability-help");
const openNewTab = requiredElement<HTMLAnchorElement>("#open-new-tab");
const sourceBanner = requiredElement<HTMLElement>("#result-source");
const sourceTitle = requiredElement<HTMLElement>("#source-title");
const sourceDescription = requiredElement<HTMLElement>("#source-description");
const sourceStatus = requiredElement<HTMLElement>("#source-status");
const summaryDate = requiredElement<HTMLElement>("#summary-date");
const summaryCorrectness = requiredElement<HTMLElement>("#summary-correctness");
const summaryDispatch = requiredElement<HTMLElement>("#summary-dispatch");
const summaryPlan = requiredElement<HTMLElement>("#summary-plan");
const resultsBody = requiredElement<HTMLTableSectionElement>("#results-body");
const stageIndicator = requiredElement<HTMLElement>("#stage-indicator");
const stageMessage = requiredElement<HTMLElement>("#stage-message");
const runProgress = requiredElement<HTMLProgressElement>("#run-progress");
const correctnessProgress = requiredElement<HTMLElement>("#correctness-progress");
const elapsed = requiredElement<HTMLElement>("#elapsed");
const activityLog = requiredElement<HTMLOListElement>("#activity-log");
const runError = requiredElement<HTMLElement>("#run-error");
const runErrorMessage = requiredElement<HTMLElement>("#run-error-message");

let recordedEnvelope: RecordedEnvelope | undefined;
let localResult: ResearchResult | undefined;
let liveBenchmarks: Benchmark[] = [];
let currentView: ResultView = "recorded";
let runState: RunState = "idle";
let capabilityReady = false;
let activeController: AbortController | undefined;
let activeOptions: ResearchOptions | undefined;
let runStartedAt = 0;
let elapsedTimer: number | undefined;
let correctness: { passed: number; total: number; workload: string; variant: string } | undefined;

function textOrUnavailable(value: string | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "Not reported";
}

function formatDate(value: string | undefined): string {
  if (!value) return "Unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDuration(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatMetric(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return "Unavailable";
  return value < 10 ? value.toFixed(3) : value.toFixed(2);
}

function addLog(message: string): void {
  const entry = document.createElement("li");
  const time = document.createElement("time");
  const content = document.createElement("span");
  time.dateTime = new Date().toISOString();
  time.textContent = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date());
  content.textContent = message;
  entry.append(time, content);
  activityLog.append(entry);
  while (activityLog.children.length > 100) activityLog.firstElementChild?.remove();
  activityLog.scrollTop = activityLog.scrollHeight;
}

function setStage(state: RunState, message: string): void {
  runState = state;
  stageMessage.textContent = message;
  stageIndicator.className = `status-dot ${state}`;
  runProgress.hidden = state !== "running" && state !== "stopping";
}

function updateElapsed(): void {
  if (runStartedAt === 0) return;
  elapsed.textContent = `Elapsed ${formatDuration(performance.now() - runStartedAt)}`;
}

function startElapsedTimer(): void {
  runStartedAt = performance.now();
  updateElapsed();
  elapsedTimer = window.setInterval(updateElapsed, 100);
}

function stopElapsedTimer(): void {
  if (elapsedTimer !== undefined) window.clearInterval(elapsedTimer);
  elapsedTimer = undefined;
  updateElapsed();
}

function setBadge(element: HTMLElement, text: string, kind: "pending" | "good" | "bad" | "neutral"): void {
  element.textContent = text;
  element.className = `badge badge-${kind}`;
}

function classifyAdapter(info: AdapterInfoLike): "Software" | "Hardware" | "Unknown" {
  const description = [info.vendor, info.architecture, info.device, info.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/swiftshader|llvmpipe|lavapipe|software|microsoft basic render/.test(description)) return "Software";
  if (/nvidia|amd|radeon|intel|apple|qualcomm|adreno|arm|mali|imagination|powervr/.test(description)) return "Hardware";
  return "Unknown";
}

function displayAdapter(info: AdapterInfoLike, hasTimestamp: boolean): void {
  const details = [info.vendor, info.architecture, info.device, info.description]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  adapterName.textContent =
    details.length > 0 ? [...new Set(details)].join(" · ") : "Adapter available; details not exposed";
  adapterType.textContent = classifyAdapter(info);
  timestampSupport.textContent = hasTimestamp ? "Supported" : "Wall clock only";
}

function adapterInfo(adapter: GPUAdapter): AdapterInfoLike {
  const candidate = adapter as GPUAdapter & { info?: AdapterInfoLike };
  return candidate.info ?? {};
}

async function detectCapability(): Promise<void> {
  const framed = window.self !== window.top;
  if (framed) {
    openNewTab.href = window.location.href;
    openNewTab.hidden = false;
  }

  if (!window.isSecureContext) {
    capabilityBadge.textContent = "HTTPS required";
    capabilityBadge.className = "badge badge-bad";
    adapterName.textContent = "WebGPU requires a secure context";
    adapterType.textContent = "Unknown";
    timestampSupport.textContent = "Unavailable";
    capabilityHelp.hidden = false;
    addLog("Live runs are unavailable because this page is not in a secure context.");
    return;
  }

  if (!("gpu" in navigator)) {
    setBadge(capabilityBadge, "Unavailable", "bad");
    adapterName.textContent = "WebGPU is not exposed by this browser";
    adapterType.textContent = "Unknown";
    timestampSupport.textContent = "Unavailable";
    capabilityHelp.hidden = false;
    addLog("WebGPU is not available. The recorded sample can still be inspected.");
    return;
  }

  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (adapter === null) {
      setBadge(capabilityBadge, "No adapter", "bad");
      adapterName.textContent = "No compatible GPU adapter was returned";
      adapterType.textContent = "Unknown";
      timestampSupport.textContent = "Unavailable";
      capabilityHelp.hidden = false;
      addLog("No WebGPU adapter was returned. The recorded sample remains available.");
      return;
    }

    const info = adapterInfo(adapter);
    displayAdapter(info, adapter.features.has("timestamp-query"));
    setBadge(capabilityBadge, "WebGPU ready", "good");
    capabilityReady = true;
    startButton.disabled = false;
    addLog(`WebGPU adapter detected (${classifyAdapter(info).toLowerCase()} type).`);
  } catch (error) {
    setBadge(capabilityBadge, "Detection failed", "bad");
    adapterName.textContent = "Adapter detection failed";
    adapterType.textContent = "Unknown";
    timestampSupport.textContent = "Unavailable";
    capabilityHelp.hidden = false;
    addLog(`GPU capability detection failed: ${errorMessage(error)}`);
  }
}

function setTextSummary(result: ResearchResult): void {
  summaryDate.textContent = formatDate(result.generatedAt);
  summaryCorrectness.textContent = result.correctness.passed
    ? `${result.correctness.count.toLocaleString()} passed`
    : "Incomplete";
  summaryDispatch.textContent = `${result.options.dispatchX.toLocaleString()} × ${result.options.dispatchY.toLocaleString()}`;
  summaryPlan.textContent = `${result.options.trials.toLocaleString()} trials · ${result.options.warmups.toLocaleString()} warmups`;
}

function setLiveSummary(): void {
  summaryDate.textContent = "In progress";
  summaryCorrectness.textContent = correctness ? `${correctness.passed}/${correctness.total} checked` : "Pending";
  summaryDispatch.textContent = `${activeOptions?.dispatchX} × 1`;
  summaryPlan.textContent = `${activeOptions?.trials} trials · ${activeOptions?.warmups} warmups`;
}

function setIncompleteSummary(): void {
  summaryDate.textContent = "Not completed";
  summaryCorrectness.textContent = correctness
    ? `${correctness.passed}/${correctness.total} checked · incomplete`
    : "Incomplete";
  summaryDispatch.textContent = `${activeOptions?.dispatchX} × 1`;
  summaryPlan.textContent = `${activeOptions?.trials} trials · ${activeOptions?.warmups} warmups`;
}

function validTiming(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value) && value > 0;
}

function timingFor(benchmark: Benchmark): {
  baseline?: number;
  current?: number;
  source: "GPU" | "Wall";
} {
  const baseline = benchmark.variants.baseline;
  const current = benchmark.variants.current;
  const reportedVariants = [baseline, current].filter((variant) => variant !== undefined);
  const useGpu = reportedVariants.length > 0 && reportedVariants.every((variant) => validTiming(variant.medianGpuMs));
  return {
    baseline: useGpu
      ? (baseline?.medianGpuMs ?? undefined)
      : validTiming(baseline?.medianWallMs)
        ? baseline.medianWallMs
        : undefined,
    current: useGpu
      ? (current?.medianGpuMs ?? undefined)
      : validTiming(current?.medianWallMs)
        ? current.medianWallMs
        : undefined,
    source: useGpu ? "GPU" : "Wall",
  };
}

function metricCell(value: number | undefined, source: "GPU" | "Wall"): HTMLTableCellElement {
  const cell = document.createElement("td");
  const metric = document.createElement("span");
  metric.className = "metric";
  metric.textContent = formatMetric(value);
  cell.append(metric);
  if (validTiming(value)) {
    const label = document.createElement("span");
    label.className = "metric-source";
    label.textContent = source;
    cell.append(label);
  }
  return cell;
}

function renderRows(benchmarks: Benchmark[], incomplete: boolean): void {
  resultsBody.replaceChildren();
  if (benchmarks.length === 0) {
    const row = document.createElement("tr");
    row.className = "empty-row";
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.textContent =
      currentView === "local" && (runState === "running" || runState === "stopping")
        ? "Waiting for the first benchmark result… compilation can take some time."
        : currentView === "local"
          ? "No complete local benchmark results are available."
          : "Recorded results are unavailable.";
    row.append(cell);
    resultsBody.append(row);
    return;
  }

  for (const benchmark of benchmarks) {
    const row = document.createElement("tr");
    const workloadCell = document.createElement("td");
    const workload = document.createElement("span");
    workload.className = "workload-name";
    workload.append(document.createTextNode(benchmark.workload));
    if (incomplete) {
      const state = document.createElement("span");
      state.className = "row-state";
      state.textContent = "Incomplete";
      workload.append(state);
    }
    workloadCell.append(workload);

    const timing = timingFor(benchmark);
    const speedupCell = document.createElement("td");
    const speedup =
      validTiming(timing.baseline) && validTiming(timing.current) ? timing.baseline / timing.current : undefined;
    speedupCell.className = validTiming(speedup) && speedup > 1 ? "metric speedup-positive" : "metric";
    speedupCell.textContent = validTiming(speedup) ? `${speedup.toFixed(2)}×` : "Unavailable";
    row.append(
      workloadCell,
      metricCell(timing.baseline, timing.source),
      metricCell(timing.current, timing.source),
      speedupCell,
    );
    resultsBody.append(row);
  }
}

function renderSelectedView(): void {
  const recorded = currentView === "recorded";
  recordedViewButton.setAttribute("aria-pressed", String(recorded));
  localViewButton.setAttribute("aria-pressed", String(!recorded));

  if (recorded) {
    sourceBanner.className = "source-banner source-recorded";
    sourceTitle.textContent = "Recorded SwiftShader results — not this device";
    setBadge(sourceStatus, "Recorded", "neutral");
    if (recordedEnvelope === undefined) {
      sourceDescription.textContent = "Loading the checked-in research sample…";
      summaryDate.textContent = "—";
      summaryCorrectness.textContent = "—";
      summaryDispatch.textContent = "—";
      summaryPlan.textContent = "—";
      renderRows([], false);
      exportButton.disabled = true;
      return;
    }
    const result = recordedEnvelope.result;
    sourceDescription.textContent = `${textOrUnavailable(result.adapter.vendor)} / ${textOrUnavailable(result.adapter.architecture)} · checked-in sample`;
    setTextSummary(result);
    renderRows(result.benchmarks, false);
    exportButton.disabled = false;
    return;
  }

  const incomplete = runState === "failed" || runState === "cancelled";
  sourceBanner.className = `source-banner ${incomplete ? "source-incomplete" : "source-local"}`;
  if (runState === "running" || runState === "stopping") {
    sourceTitle.textContent = runState === "stopping" ? "Stopping local run" : "Local run in progress — this device";
    sourceDescription.textContent = "Rows appear only after each workload benchmark finishes.";
    setBadge(sourceStatus, runState === "stopping" ? "Stopping" : "Live", "good");
    setLiveSummary();
    renderRows(liveBenchmarks, false);
    exportButton.disabled = true;
  } else if (localResult !== undefined) {
    sourceTitle.textContent = "Local results — this device";
    sourceDescription.textContent = `${textOrUnavailable(localResult.adapter.vendor)} / ${textOrUnavailable(localResult.adapter.architecture)} · completed in this browser`;
    setBadge(sourceStatus, "Complete", "good");
    setTextSummary(localResult);
    renderRows(localResult.benchmarks, false);
    exportButton.disabled = false;
  } else {
    sourceTitle.textContent = incomplete ? "Local run incomplete — this device" : "No local run yet — this device";
    sourceDescription.textContent = incomplete
      ? "Partial rows are diagnostic only and are not a passing result."
      : "Configure a scope and start research to measure this browser’s adapter.";
    setBadge(sourceStatus, incomplete ? "Incomplete" : "Not run", incomplete ? "bad" : "neutral");
    if (incomplete) setIncompleteSummary();
    else {
      summaryDate.textContent = "Not run";
      summaryCorrectness.textContent = "Not run";
      summaryDispatch.textContent = "—";
      summaryPlan.textContent = "—";
    }
    renderRows(liveBenchmarks, incomplete);
    exportButton.disabled = true;
  }
}

async function loadRecordedResults(): Promise<void> {
  try {
    const response = await fetch("./results/swiftshader-specialized.json");
    if (!response.ok) throw new Error(`Request returned ${response.status}`);
    const envelope = (await response.json()) as RecordedEnvelope;
    if (envelope.status !== "done" || !envelope.result || !Array.isArray(envelope.result.benchmarks)) {
      throw new Error("Recorded result file has an unexpected shape");
    }
    recordedEnvelope = envelope;
    addLog(`Recorded SwiftShader sample loaded (${envelope.result.benchmarks.length} workloads).`);
    if (currentView === "recorded") renderSelectedView();
  } catch (error) {
    sourceDescription.textContent = `Could not load the recorded sample: ${errorMessage(error)}`;
    setBadge(sourceStatus, "Load failed", "bad");
    renderRows([], false);
    addLog(`Recorded sample failed to load: ${errorMessage(error)}`);
  }
}

function readInteger(input: HTMLInputElement): number {
  return Number.parseInt(input.value, 10);
}

function selectedScope(): string {
  return new FormData(form).get("scope")?.toString() ?? "quick";
}

function researchOptions(): ResearchOptions {
  const scope = selectedScope();
  const options: ResearchOptions = {
    variants: compareBaseline.checked ? ["baseline", "current"] : ["current"],
    warmups: readInteger(warmups),
    trials: readInteger(trials),
    dispatchX: readInteger(dispatchX),
    dispatchY: 1,
    timestamps: true,
  };
  if (scope === "quick") options.workloads = ["create2"];
  if (scope === "pair") options.workloads = ["create2", "safe"];
  return options;
}

function renderProgress(event: ResearchProgress): void {
  switch (event.type) {
    case "status":
      setStage(
        runState === "stopping" ? "stopping" : "running",
        runState === "stopping" ? "Stopping after current GPU operation…" : event.message,
      );
      addLog(event.message);
      break;
    case "adapter":
      displayAdapter(event.adapter, event.adapter.timestampQuery);
      addLog("Research run acquired the reported GPU adapter.");
      break;
    case "correctness":
      correctness = event;
      correctnessProgress.textContent = `${event.passed.toLocaleString()}/${event.total.toLocaleString()} checks · ${event.workload} / ${event.variant}`;
      if (currentView === "local") setLiveSummary();
      break;
    case "benchmark": {
      const existingIndex = liveBenchmarks.findIndex((benchmark) => benchmark.workload === event.benchmark.workload);
      if (existingIndex === -1) liveBenchmarks.push(event.benchmark);
      else liveBenchmarks[existingIndex] = event.benchmark;
      addLog(`Benchmark finished: ${event.benchmark.workload}.`);
      if (currentView === "local") renderSelectedView();
      break;
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

function resetButtons(): void {
  startButton.disabled = !capabilityReady;
  stopButton.disabled = true;
}

async function startRun(): Promise<void> {
  if (!capabilityReady || runState === "running" || runState === "stopping") return;
  if (!form.reportValidity()) return;

  activeOptions = researchOptions();
  localResult = undefined;
  liveBenchmarks = [];
  correctness = undefined;
  currentView = "local";
  localViewButton.disabled = false;
  activeController = new AbortController();
  startButton.disabled = true;
  stopButton.disabled = false;
  runError.hidden = true;
  correctnessProgress.textContent = "Correctness checks pending.";
  setStage("running", "Preparing GPU research…");
  startElapsedTimer();
  renderSelectedView();
  addLog(`Local research started with ${selectedScope()} scope.`);

  try {
    const result = await runResearch(activeOptions, {
      signal: activeController.signal,
      onProgress: renderProgress,
    });
    if (activeController.signal.aborted) {
      setStage("cancelled", "Run stopped — partial results incomplete");
      addLog("Local research stopped. Partial rows are marked incomplete.");
    } else {
      localResult = result;
      liveBenchmarks = [...result.benchmarks];
      correctnessProgress.textContent = `${result.correctness.count.toLocaleString()} correctness checks passed.`;
      setStage("complete", "Research complete");
      addLog(`Local research completed with ${result.benchmarks.length} benchmark results.`);
    }
  } catch (error) {
    if (activeController.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
      setStage("cancelled", "Run stopped — partial results incomplete");
      addLog("Local research stopped. Partial rows are marked incomplete.");
    } else {
      const message = errorMessage(error);
      setStage("failed", "Run failed — partial results incomplete");
      runErrorMessage.textContent = message;
      runError.hidden = false;
      addLog(`Local research failed: ${message}`);
      console.error(error);
    }
  } finally {
    stopElapsedTimer();
    activeController = undefined;
    resetButtons();
    renderSelectedView();
  }
}

function stopRun(): void {
  if (activeController === undefined || runState !== "running") return;
  activeController.abort();
  setStage("stopping", "Stopping after current GPU operation…");
  stopButton.disabled = true;
  startButton.disabled = true;
  addLog("Stop requested. An in-flight GPU compilation or dispatch cannot be interrupted.");
  if (currentView === "local") renderSelectedView();
}

function downloadSelected(): void {
  const envelope =
    currentView === "recorded"
      ? recordedEnvelope
      : localResult
        ? { status: "done" as const, result: localResult }
        : undefined;
  if (envelope === undefined) return;
  const prefix = currentView === "recorded" ? "saltshaker-recorded-swiftshader" : "saltshaker-local";
  const date = envelope.result.generatedAt.slice(0, 10) || "result";
  const blob = new Blob([`${JSON.stringify(envelope, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${prefix}-${date}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  void startRun();
});
stopButton.addEventListener("click", stopRun);
retryButton.addEventListener("click", () => {
  runError.hidden = true;
  void startRun();
});
recordedViewButton.addEventListener("click", () => {
  currentView = "recorded";
  renderSelectedView();
});
localViewButton.addEventListener("click", () => {
  currentView = "local";
  renderSelectedView();
});
exportButton.addEventListener("click", downloadSelected);

document.documentElement.dataset.dashboardReady = "true";
if (window.__dashboardTimer !== undefined) window.clearTimeout(window.__dashboardTimer);
requiredElement<HTMLElement>("#module-error").hidden = true;
renderSelectedView();
void loadRecordedResults();
void detectCapability();
