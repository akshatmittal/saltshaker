"use client";

import { useEffect, useRef, useState } from "react";
import {
  checkWebGpuSupport,
  createWebGpuMiningSession,
  DEFAULT_SAFE_FACTORY,
  DEFAULT_SAFE_FALLBACK_HANDLER,
  DEFAULT_SAFE_PROXY_CREATION_CODE_HASH,
  prepareJob,
  STANDARDIZED_CREATE2_BENCHMARK_PRESET,
  type AddressMatcherSpec,
  type CheckWebGpuSupportResult,
  type MatcherKind,
  type MiningJob,
  type MiningSessionState,
  type WebGpuMiningSession,
} from "saltshaker";

import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";

type Protocol = "create2" | "safe";

type Create2FormState = {
  deployer: string;
  fixedSaltPrefix: string;
  initCodeHash: string;
  startNonce: string;
};

type SafeFormState = {
  owners: string;
  threshold: string;
  to: string;
  data: string;
  fallbackHandler: string;
  paymentToken: string;
  payment: string;
  paymentReceiver: string;
  factory: string;
  proxyCreationCodeHash: string;
  startNonce: string;
};

const defaultCreate2: Create2FormState = {
  deployer: STANDARDIZED_CREATE2_BENCHMARK_PRESET.job.deployer,
  fixedSaltPrefix: STANDARDIZED_CREATE2_BENCHMARK_PRESET.job.fixedSaltPrefix,
  initCodeHash: STANDARDIZED_CREATE2_BENCHMARK_PRESET.job.initCodeHash,
  startNonce: "0",
};

const defaultSafe: SafeFormState = {
  owners: [
    "0x0000000000000000000000000000000000000001",
    "0x0000000000000000000000000000000000000002",
  ].join("\n"),
  threshold: "2",
  to: "",
  data: "0x",
  fallbackHandler: DEFAULT_SAFE_FALLBACK_HANDLER,
  paymentToken: "",
  payment: "0",
  paymentReceiver: "",
  factory: DEFAULT_SAFE_FACTORY,
  proxyCreationCodeHash: DEFAULT_SAFE_PROXY_CREATION_CODE_HASH,
  startNonce: "0",
};

type MatcherFormState = {
  type: MatcherKind;
  value: string;
};

const defaultMatcher: MatcherFormState = {
  type: "none",
  value: "",
};

export function MinerConsole() {
  const [protocol, setProtocol] = useState<Protocol>("create2");
  const [create2Form, setCreate2Form] = useState(defaultCreate2);
  const [safeForm, setSafeForm] = useState(defaultSafe);
  const [matcher, setMatcher] = useState(defaultMatcher);
  const [support, setSupport] = useState<CheckWebGpuSupportResult>({
    supported: false,
    message: "Checking WebGPU support...",
  });
  const [sessionState, setSessionState] = useState<MiningSessionState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<WebGpuMiningSession | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    checkWebGpuSupport().then(setSupport);
    return () => {
      unsubscribeRef.current?.();
      sessionRef.current?.stop();
    };
  }, []);

  function updateCreate2<K extends keyof Create2FormState>(key: K, value: Create2FormState[K]) {
    setCreate2Form((current) => ({ ...current, [key]: value }));
  }

  function updateSafe<K extends keyof SafeFormState>(key: K, value: SafeFormState[K]) {
    setSafeForm((current) => ({ ...current, [key]: value }));
  }

  function updateMatcher<K extends keyof MatcherFormState>(key: K, value: MatcherFormState[K]) {
    setMatcher((current) => ({ ...current, [key]: value }));
  }

  function normalizeHexInput(value: string): `0x${string}` | undefined {
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    return (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`) as `0x${string}`;
  }

  function buildMatcher(): AddressMatcherSpec {
    if (matcher.type === "none") {
      return { type: "none" };
    }

    if (matcher.type === "leadingZeros") {
      return {
        type: "leadingZeros",
        value: Number.parseInt(matcher.value || "0", 10),
      };
    }

    return {
      type: matcher.type,
      value: normalizeHexInput(matcher.value) ?? "0x",
    };
  }

  function buildJob(): MiningJob {
    if (protocol === "create2") {
      return {
        protocol: "create2",
        deployer: create2Form.deployer as `0x${string}`,
        fixedSaltPrefix: normalizeHexInput(create2Form.fixedSaltPrefix) ?? "0x",
        initCodeHash: normalizeHexInput(create2Form.initCodeHash),
        startNonce: BigInt(create2Form.startNonce || "0"),
      };
    }

    const owners = safeForm.owners
      .split(/[\n,]+/)
      .map((owner) => owner.trim())
      .filter(Boolean) as `0x${string}`[];

    return {
      protocol: "safe",
      owners,
      threshold: BigInt(safeForm.threshold || "1"),
      to: safeForm.to.trim() === "" ? undefined : (safeForm.to as `0x${string}`),
      data: normalizeHexInput(safeForm.data) ?? "0x",
      fallbackHandler:
        safeForm.fallbackHandler.trim() === "" ? undefined : (safeForm.fallbackHandler as `0x${string}`),
      paymentToken: safeForm.paymentToken.trim() === "" ? undefined : (safeForm.paymentToken as `0x${string}`),
      payment: BigInt(safeForm.payment || "0"),
      paymentReceiver:
        safeForm.paymentReceiver.trim() === "" ? undefined : (safeForm.paymentReceiver as `0x${string}`),
      factory: safeForm.factory.trim() === "" ? undefined : (safeForm.factory as `0x${string}`),
      proxyCreationCodeHash:
        safeForm.proxyCreationCodeHash.trim() === ""
          ? undefined
          : (normalizeHexInput(safeForm.proxyCreationCodeHash) as `0x${string}`),
      startNonce: BigInt(safeForm.startNonce || "0"),
    };
  }

  function attachSession(session: WebGpuMiningSession) {
    unsubscribeRef.current?.();
    unsubscribeRef.current = session.subscribe((nextState) => {
      setSessionState(nextState);
      if (nextState.error !== null) {
        setError(nextState.error);
      }
    });
  }

  function handleStart() {
    setError(null);

    if (!support.supported) {
      setError("WebGPU is required for mining in this app.");
      return;
    }

    if (sessionState?.status === "paused" && sessionRef.current !== null) {
      void sessionRef.current.start().catch((startError) => {
        setError(startError instanceof Error ? startError.message : "Failed to resume mining");
      });
      return;
    }

    try {
      const preparedJob = prepareJob(buildJob());
      sessionRef.current?.stop();
      const session = createWebGpuMiningSession(preparedJob, buildMatcher());
      sessionRef.current = session;
      attachSession(session);
      void session.start().catch((startError) => {
        setError(startError instanceof Error ? startError.message : "Failed to start mining");
      });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Failed to start mining");
    }
  }

  function handlePause() {
    sessionRef.current?.pause();
  }

  function handleStop() {
    sessionRef.current?.stop();
    setSessionState(null);
  }

  const topResults = sessionState?.top ?? [];
  const running = sessionState?.status === "running";
  const paused = sessionState?.status === "paused";

  return (
    <div className="flex flex-1 flex-col gap-6 py-8">
      <section className="relative overflow-hidden rounded-3xl border border-border bg-[linear-gradient(135deg,rgba(17,94,89,0.08),rgba(251,191,36,0.10),rgba(15,23,42,0.02))] p-6 shadow-sm">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(13,148,136,0.14),transparent_36%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">WebGPU Salt Miner</p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              GPU-only CREATE2 and Safe mining, directly in the browser.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Each dispatch scans 67,107,840 candidates on the GPU. The core keeps the browser path generic enough
              for protocol adapters while the UI stays focused on CREATE2 and Safe.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="GPU Status" value={support.supported ? "Ready" : "Unavailable"} accent={support.message} />
            <StatCard
              label="Adapter"
              value={support.adapterLabel ?? "Unknown"}
              accent={sessionState?.status ? `Session: ${sessionState.status}` : "Idle"}
            />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title="Protocol" eyebrow="Preset">
            <div className="flex gap-2">
              <Button variant={protocol === "create2" ? "default" : "outline"} onClick={() => setProtocol("create2")}>
                CREATE2
              </Button>
              <Button variant={protocol === "safe" ? "default" : "outline"} onClick={() => setProtocol("safe")}>
                Safe
              </Button>
            </div>
            {protocol === "create2" ? (
              <div className="grid gap-4">
                <Field
                  label="Deployer / Factory"
                  value={create2Form.deployer}
                  onChange={(value) => updateCreate2("deployer", value)}
                />
                <Field
                  label="Fixed Salt Prefix"
                  hint="Exactly 24 bytes. The miner scans the final 8 bytes as the nonce window."
                  value={create2Form.fixedSaltPrefix}
                  onChange={(value) => updateCreate2("fixedSaltPrefix", value)}
                />
                <Field
                  label="Init Code Hash"
                  value={create2Form.initCodeHash}
                  onChange={(value) => updateCreate2("initCodeHash", value)}
                />
                <Field
                  label="Start Nonce"
                  value={create2Form.startNonce}
                  onChange={(value) => updateCreate2("startNonce", value)}
                />
              </div>
            ) : (
              <div className="grid gap-4">
                <TextAreaField
                  label="Owners"
                  hint="One address per line or comma-separated."
                  rows={4}
                  value={safeForm.owners}
                  onChange={(value) => updateSafe("owners", value)}
                />
                <Field label="Threshold" value={safeForm.threshold} onChange={(value) => updateSafe("threshold", value)} />
                <Field label="Factory" value={safeForm.factory} onChange={(value) => updateSafe("factory", value)} />
                <Field
                  label="Proxy Creation Code Hash"
                  value={safeForm.proxyCreationCodeHash}
                  onChange={(value) => updateSafe("proxyCreationCodeHash", value)}
                />
                <Field
                  label="Fallback Handler"
                  value={safeForm.fallbackHandler}
                  onChange={(value) => updateSafe("fallbackHandler", value)}
                />
                <Field label="To" value={safeForm.to} onChange={(value) => updateSafe("to", value)} />
                <Field label="Data" value={safeForm.data} onChange={(value) => updateSafe("data", value)} />
                <Field
                  label="Payment Token"
                  value={safeForm.paymentToken}
                  onChange={(value) => updateSafe("paymentToken", value)}
                />
                <Field label="Payment" value={safeForm.payment} onChange={(value) => updateSafe("payment", value)} />
                <Field
                  label="Payment Receiver"
                  value={safeForm.paymentReceiver}
                  onChange={(value) => updateSafe("paymentReceiver", value)}
                />
                <Field
                  label="Start Nonce"
                  value={safeForm.startNonce}
                  onChange={(value) => updateSafe("startNonce", value)}
                />
              </div>
            )}
          </Panel>

          <Panel title="Matcher" eyebrow="Filters">
            <div className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-foreground">Matcher Type</span>
                <NativeSelect
                  className="w-full"
                  value={matcher.type}
                  onChange={(event) => updateMatcher("type", event.target.value as MatcherKind)}
                >
                  <NativeSelectOption value="none">Best address only</NativeSelectOption>
                  <NativeSelectOption value="prefix">Prefix</NativeSelectOption>
                  <NativeSelectOption value="suffix">Suffix</NativeSelectOption>
                  <NativeSelectOption value="contains">Contains</NativeSelectOption>
                  <NativeSelectOption value="leadingZeros">Leading zeros</NativeSelectOption>
                </NativeSelect>
              </label>
              {matcher.type !== "none" ? (
                <Field
                  label={matcher.type === "leadingZeros" ? "Minimum Leading Zero Nibbles" : "Matcher Value"}
                  hint={
                    matcher.type === "leadingZeros"
                      ? "Whole number of leading zero hex nibbles."
                      : "Hex string, with or without 0x prefix."
                  }
                  value={matcher.value}
                  onChange={(value) => updateMatcher("value", value)}
                />
              ) : null}
            </div>
          </Panel>

          <Panel title="Controls" eyebrow="Session">
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleStart} disabled={!support.supported}>
                {paused ? "Resume" : "Start"}
              </Button>
              <Button variant="outline" onClick={handlePause} disabled={!running}>
                Pause
              </Button>
              <Button variant="outline" onClick={handleStop} disabled={sessionRef.current === null}>
                Stop
              </Button>
            </div>
            {error !== null ? <p className="text-sm text-destructive">{error}</p> : null}
            {!support.supported ? (
              <p className="text-sm text-muted-foreground">
                This app does not fall back to CPU mining. It requires a browser with WebGPU enabled.
              </p>
            ) : null}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Live Session" eyebrow="Telemetry">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Status" value={sessionState?.status ?? "idle"} accent={sessionState?.error ?? "No errors"} />
              <StatCard
                label="Hashrate"
                value={formatHashrate(sessionState?.hashrate ?? 0)}
                accent={`${formatBigInt(sessionState?.totalHashes ?? 0n)} hashes`}
              />
              <StatCard
                label="Elapsed"
                value={formatDuration(sessionState?.elapsedMs ?? 0)}
                accent={`Dispatches ${sessionState?.dispatchesCompleted ?? 0}`}
              />
              <StatCard
                label="Window Start"
                value={(sessionState?.currentWindowStart ?? 0n).toString()}
                accent={sessionState?.adapterLabel ?? support.adapterLabel ?? "Adapter unknown"}
              />
            </div>
          </Panel>

          <Panel title="Ranked Results" eyebrow="Top 25">
            {topResults.length === 0 ? (
              <EmptyState>
                No GPU-verified winners yet. Start mining to populate the ranked address table.
              </EmptyState>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-border">
                <div className="grid grid-cols-[88px_minmax(0,1fr)_132px_108px] gap-3 border-b border-border bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  <span>Zeros</span>
                  <span>Address</span>
                  <span>Nonce</span>
                  <span>Salt</span>
                </div>
                <div className="divide-y divide-border/70">
                  {topResults.map((result) => (
                    <div
                      key={`${result.address}-${result.nonce.toString()}`}
                      className="grid grid-cols-[88px_minmax(0,1fr)_132px_108px] gap-3 px-4 py-3 text-sm"
                    >
                      <span className="font-medium text-foreground">{result.leadingZeroNibbles}</span>
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs text-foreground sm:text-sm">{result.address}</p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">{result.salt}</p>
                      </div>
                      <span className="truncate font-mono text-xs text-muted-foreground">{result.nonce.toString()}</span>
                      <button
                        type="button"
                        className="text-left text-xs font-medium text-primary underline-offset-4 hover:underline"
                        onClick={() => void navigator.clipboard.writeText(result.address)}
                      >
                        Copy
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </div>
      </section>
    </div>
  );
}

function Panel({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-4 space-y-1">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-2xl border border-input bg-background px-3 font-mono text-sm outline-none transition focus:border-primary"
      />
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  hint?: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-input bg-background px-3 py-3 font-mono text-sm outline-none transition focus:border-primary"
      />
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-border/80 bg-background/80 p-4 backdrop-blur-sm">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{accent}</p>
    </div>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function formatHashrate(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)} GH/s`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)} MH/s`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)} KH/s`;
  return `${value.toFixed(0)} H/s`;
}

function formatBigInt(value: bigint): string {
  const raw = value.toString();
  return raw.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}
