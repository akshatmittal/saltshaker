"use client";

import { useEffect, useRef, useState } from "react";
import { Copy } from "lucide-react";
import {
  checkWebGpuSupport,
  createWebGpuMiningSession,
  STANDARDIZED_CREATE2_BENCHMARK_PRESET,
  type AddressMatcherSpec,
  type CheckWebGpuSupportResult,
  type MatcherKind,
  type MiningJob,
  type MiningSessionState,
  type WebGpuMiningSession,
} from "saltshaker";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { EmptyState, HeroPanel, StatCard } from "@/components/miner/shared";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type Protocol = "create2" | "safe";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const DEFAULT_SAFE_FACTORY = "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2" as const;
const DEFAULT_SAFE_FALLBACK_HANDLER = "0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4" as const;
const DEFAULT_SAFE_PROXY_CREATION_CODE_HASH =
  "0xcaf2dc2f91b804b2fcf1ed3a965a1ff4404b840b80c124277b00a43b4634b2ce" as const;

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
  owners: ["0x0000000000000000000000000000000000000001", "0x0000000000000000000000000000000000000002"].join("\n"),
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
  type: "leadingZeros",
  value: "0",
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
      to: safeForm.to.trim() === "" ? ZERO_ADDRESS : (safeForm.to as `0x${string}`),
      data: normalizeHexInput(safeForm.data) ?? "0x",
      fallbackHandler:
        safeForm.fallbackHandler.trim() === ""
          ? DEFAULT_SAFE_FALLBACK_HANDLER
          : (safeForm.fallbackHandler as `0x${string}`),
      paymentToken: safeForm.paymentToken.trim() === "" ? ZERO_ADDRESS : (safeForm.paymentToken as `0x${string}`),
      payment: BigInt(safeForm.payment || "0"),
      paymentReceiver:
        safeForm.paymentReceiver.trim() === "" ? ZERO_ADDRESS : (safeForm.paymentReceiver as `0x${string}`),
      factory: safeForm.factory.trim() === "" ? DEFAULT_SAFE_FACTORY : (safeForm.factory as `0x${string}`),
      proxyCreationCodeHash: (normalizeHexInput(safeForm.proxyCreationCodeHash) ??
        DEFAULT_SAFE_PROXY_CREATION_CODE_HASH) as `0x${string}`,
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
      sessionRef.current?.stop();
      const session = createWebGpuMiningSession(buildJob(), buildMatcher());
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
    <div className="flex flex-1 flex-col gap-4 py-8">
      <HeroPanel>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl space-y-3">
            <p className="text-sm font-medium tracking-[0.24em] text-muted-foreground uppercase">WebGPU Salt Miner</p>
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              GPU-only CREATE2 and Safe mining, directly in the browser.
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
              Each dispatch scans 67,107,840 candidates on the GPU. The core keeps the browser path generic enough for
              protocol adapters while the UI stays focused on CREATE2 and Safe.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="GPU Status"
              value={support.supported ? "Ready" : "Unavailable"}
              accent={support.message}
            />
            <StatCard
              label="Adapter"
              value={support.adapterLabel ?? "Unknown"}
              accent={sessionState?.status ? `Session: ${sessionState.status}` : "Idle"}
            />
          </div>
        </div>
      </HeroPanel>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardDescription>Preset</CardDescription>
              <CardTitle>Protocol</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  variant={protocol === "create2" ? "default" : "outline"}
                  onClick={() => setProtocol("create2")}
                >
                  CREATE2
                </Button>
                <Button
                  variant={protocol === "safe" ? "default" : "outline"}
                  onClick={() => setProtocol("safe")}
                >
                  Safe
                </Button>
              </div>
              <Separator />
              {protocol === "create2" ? (
                <div className="grid gap-4">
                  <Field>
                    <FieldLabel>Deployer / Factory</FieldLabel>
                    <Input
                      value={create2Form.deployer}
                      onChange={(event) => updateCreate2("deployer", event.target.value)}
                      className="font-mono"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Fixed Salt Prefix</FieldLabel>
                    <Input
                      value={create2Form.fixedSaltPrefix}
                      onChange={(event) => updateCreate2("fixedSaltPrefix", event.target.value)}
                      className="font-mono"
                    />
                    <FieldDescription>
                      Exactly 24 bytes. The miner scans the final 8 bytes as the nonce window.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel>Init Code Hash</FieldLabel>
                    <Input
                      value={create2Form.initCodeHash}
                      onChange={(event) => updateCreate2("initCodeHash", event.target.value)}
                      className="font-mono"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Start Nonce</FieldLabel>
                    <Input
                      value={create2Form.startNonce}
                      onChange={(event) => updateCreate2("startNonce", event.target.value)}
                      className="font-mono"
                    />
                  </Field>
                </div>
              ) : (
                <div className="grid gap-4">
                  <Field>
                    <FieldLabel>Owners</FieldLabel>
                    <Textarea
                      rows={4}
                      value={safeForm.owners}
                      onChange={(event) => updateSafe("owners", event.target.value)}
                      className="font-mono"
                    />
                    <FieldDescription>One address per line or comma-separated.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel>Threshold</FieldLabel>
                    <Input
                      value={safeForm.threshold}
                      onChange={(event) => updateSafe("threshold", event.target.value)}
                      className="font-mono"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Factory</FieldLabel>
                    <Input
                      value={safeForm.factory}
                      onChange={(event) => updateSafe("factory", event.target.value)}
                      className="font-mono"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Proxy Creation Code Hash</FieldLabel>
                    <Input
                      value={safeForm.proxyCreationCodeHash}
                      onChange={(event) => updateSafe("proxyCreationCodeHash", event.target.value)}
                      className="font-mono"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Fallback Handler</FieldLabel>
                    <Input
                      value={safeForm.fallbackHandler}
                      onChange={(event) => updateSafe("fallbackHandler", event.target.value)}
                      className="font-mono"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>To</FieldLabel>
                    <Input
                      value={safeForm.to}
                      onChange={(event) => updateSafe("to", event.target.value)}
                      className="font-mono"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Data</FieldLabel>
                    <Input
                      value={safeForm.data}
                      onChange={(event) => updateSafe("data", event.target.value)}
                      className="font-mono"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Payment Token</FieldLabel>
                    <Input
                      value={safeForm.paymentToken}
                      onChange={(event) => updateSafe("paymentToken", event.target.value)}
                      className="font-mono"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Payment</FieldLabel>
                    <Input
                      value={safeForm.payment}
                      onChange={(event) => updateSafe("payment", event.target.value)}
                      className="font-mono"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Payment Receiver</FieldLabel>
                    <Input
                      value={safeForm.paymentReceiver}
                      onChange={(event) => updateSafe("paymentReceiver", event.target.value)}
                      className="font-mono"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Start Nonce</FieldLabel>
                    <Input
                      value={safeForm.startNonce}
                      onChange={(event) => updateSafe("startNonce", event.target.value)}
                      className="font-mono"
                    />
                  </Field>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Filters</CardDescription>
              <CardTitle>Matcher</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <Field>
                  <FieldLabel>Matcher Type</FieldLabel>
                  <NativeSelect
                    className="w-full"
                    value={matcher.type}
                    onChange={(event) => updateMatcher("type", event.target.value as MatcherKind)}
                  >
                    <NativeSelectOption value="prefix">Prefix</NativeSelectOption>
                    <NativeSelectOption value="suffix">Suffix</NativeSelectOption>
                    <NativeSelectOption value="contains">Contains</NativeSelectOption>
                    <NativeSelectOption value="leadingZeros">Leading zeros</NativeSelectOption>
                  </NativeSelect>
                </Field>
                <Field>
                  <FieldLabel>
                    {matcher.type === "leadingZeros" ? "Minimum Leading Zero Nibbles" : "Matcher Value"}
                  </FieldLabel>
                  <Input
                    value={matcher.value}
                    onChange={(event) => updateMatcher("value", event.target.value)}
                    className="font-mono"
                  />
                  <FieldDescription>
                    {matcher.type === "leadingZeros"
                      ? "Whole number of leading zero hex nibbles. Use 0 for no filtering."
                      : "Hex string, with or without 0x prefix."}
                  </FieldDescription>
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Session</CardDescription>
              <CardTitle>Controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleStart}
                  disabled={!support.supported}
                >
                  {paused ? "Resume" : "Start"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handlePause}
                  disabled={!running}
                >
                  Pause
                </Button>
                <Button
                  variant="outline"
                  onClick={handleStop}
                  disabled={sessionRef.current === null}
                >
                  Stop
                </Button>
              </div>
              <Separator />
              {error !== null ? <p className="text-sm text-destructive">{error}</p> : null}
              {!support.supported ? (
                <p className="text-sm text-muted-foreground">
                  This app does not fall back to CPU mining. It requires a browser with WebGPU enabled.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardDescription>Telemetry</CardDescription>
              <CardTitle>Live Session</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="Status"
                  value={sessionState?.status ?? "idle"}
                  accent={sessionState?.error ?? "No errors"}
                />
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardDescription>Top 25</CardDescription>
              <CardTitle>Ranked Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {topResults.length === 0 ? (
                <EmptyState>No GPU-verified winners yet. Start mining to populate the ranked address table.</EmptyState>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Zeros</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topResults.map((result) => (
                      <TableRow key={`${result.address}-${result.nonce.toString()}`}>
                        <TableCell className="font-medium">{result.leadingZeroNibbles}</TableCell>
                        <TableCell className="min-w-0">
                          <div className="">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate font-mono">{result.address}</p>
                              <CopyValueButton
                                value={result.address}
                                label="Copy address"
                              />
                            </div>
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate font-mono text-muted-foreground">{result.salt}</p>
                              <CopyValueButton
                                value={result.salt}
                                label="Copy salt"
                              />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </section>
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

function CopyValueButton({ value, label }: { value: string; label: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      onClick={() => void navigator.clipboard.writeText(value)}
    >
      <Copy />
    </Button>
  );
}
