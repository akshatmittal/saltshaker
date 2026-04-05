import React, { useEffect, useState } from "react";

import {
  createMiningSession,
  type AddressMatcherSpec,
  type CreateXOperation,
  type MatcherKind,
  type MiningJob,
} from "@akshatmittal/saltshaker";
import { AlignLeft, AlignRight, ChevronDown, ChevronUp, Copy, Hash, Search, Settings } from "lucide-react";
import { toHex, type Hex } from "viem";

import { EmptyState, TelemetryCard } from "@/components/miner/shared";
import { WorkbenchLayout } from "@/components/miner/workbench-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useMiningSession } from "@/hooks/use-mining-session";
import { STANDARDIZED_CREATE2_BENCHMARK_PRESET } from "@/lib/standardized-create2-benchmark-preset";
import { cn } from "@/lib/utils";

type Protocol = MiningJob["protocol"];

const MATCHER_OPTIONS: { type: MatcherKind; icon: React.ElementType; label: string }[] = [
  { type: "leadingZeros", icon: Hash, label: "Leading Zeros" },
  { type: "prefix", icon: AlignLeft, label: "Prefix" },
  { type: "suffix", icon: AlignRight, label: "Suffix" },
  { type: "contains", icon: Search, label: "Contains" },
];

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;
const DEFAULT_CREATEX_FACTORY = "0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed" as const;
const DEFAULT_SAFE_FACTORY = "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2" as const;
const DEFAULT_SAFE_FALLBACK_HANDLER = "0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4" as const;
const DEFAULT_SAFE_PROXY_CREATION_CODE_HASH =
  "0xcaf2dc2f91b804b2fcf1ed3a965a1ff4404b840b80c124277b00a43b4634b2ce" as const;
const CREATE2_FIXED_SALT_PREFIX_BYTES = 24;

type Create2FormState = {
  deployer: string;
  fixedSaltPrefix: string;
  initCodeHash: string;
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
};

type CreateXFormState = {
  createOperation: CreateXOperation;
  factory: string;
  caller: string;
  crosschainReplayProtection: boolean;
  chainId: string;
  initCodeHash: string;
};

const defaultCreate2: Create2FormState = {
  deployer: STANDARDIZED_CREATE2_BENCHMARK_PRESET.job.deployer,
  fixedSaltPrefix: "",
  initCodeHash: STANDARDIZED_CREATE2_BENCHMARK_PRESET.job.initCodeHash,
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
};

const defaultCreateX: CreateXFormState = {
  createOperation: "create2",
  factory: DEFAULT_CREATEX_FACTORY,
  caller: "",
  crosschainReplayProtection: false,
  chainId: "",
  initCodeHash: STANDARDIZED_CREATE2_BENCHMARK_PRESET.job.initCodeHash,
};

type MatcherFormState = {
  type: MatcherKind;
  value: string;
};

const defaultMatcher: MatcherFormState = {
  type: "leadingZeros",
  value: "8",
};

export function MinerConsole() {
  const {
    support,
    sessionState,
    error,
    setError,
    sessionRef,
    active,
    subscribeToSession,
    setActiveSession,
    stopSession,
  } = useMiningSession();

  const [protocol, setProtocol] = useState<Protocol>("create2");
  const [create2Form, setCreate2Form] = useState(defaultCreate2);
  const [safeForm, setSafeForm] = useState(defaultSafe);
  const [createXForm, setCreateXForm] = useState(defaultCreateX);
  const [matcher, setMatcher] = useState(defaultMatcher);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [maxResults, setMaxResults] = useState(10);
  const [stopWhenFound, setStopWhenFound] = useState(true);

  useEffect(() => {
    if (
      stopWhenFound &&
      sessionState !== null &&
      sessionState.results.length > 0 &&
      (sessionState.status === "running" || sessionState.status === "preparing")
    ) {
      sessionRef.current?.stop();
    }
  }, [stopWhenFound, sessionState, sessionRef]);

  function updateCreate2<K extends keyof Create2FormState>(key: K, value: Create2FormState[K]) {
    setCreate2Form((current) => ({ ...current, [key]: value }));
  }

  function updateSafe<K extends keyof SafeFormState>(key: K, value: SafeFormState[K]) {
    setSafeForm((current) => ({ ...current, [key]: value }));
  }

  function updateCreateX<K extends keyof CreateXFormState>(key: K, value: CreateXFormState[K]) {
    setCreateXForm((current) => ({ ...current, [key]: value }));
  }

  function updateMatcher<K extends keyof MatcherFormState>(key: K, value: MatcherFormState[K]) {
    setMatcher((current) => ({ ...current, [key]: value }));
  }

  function normalizeHexInput(value: string): `0x${string}` | undefined {
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    return (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`) as `0x${string}`;
  }

  function normalizeAddressInput(value: string): `0x${string}` | undefined {
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    return trimmed as `0x${string}`;
  }

  function normalizeBigIntInput(value: string): bigint | undefined {
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    return BigInt(trimmed);
  }

  function buildFixedSaltPrefix(value: string): `0x${string}` {
    const normalized = normalizeHexInput(value) ?? "0x";
    const raw = normalized.slice(2);

    if (!/^[0-9a-fA-F]*$/.test(raw)) {
      throw new Error("Fixed salt prefix must be a hex string");
    }

    if (raw.length % 2 !== 0) {
      throw new Error("Fixed salt prefix must have an even number of hex characters");
    }

    const providedBytes = raw.length / 2;
    if (providedBytes > CREATE2_FIXED_SALT_PREFIX_BYTES) {
      throw new Error(`Fixed salt prefix must be ${CREATE2_FIXED_SALT_PREFIX_BYTES} bytes or shorter`);
    }

    const randomBytes = new Uint8Array(CREATE2_FIXED_SALT_PREFIX_BYTES - providedBytes);

    return `0x${raw}${toHex(crypto.getRandomValues(randomBytes)).slice(2)}` as Hex;
  }

  function buildCreateXFixedSaltPrefix(): `0x${string}` {
    const caller = normalizeAddressInput(createXForm.caller) ?? ZERO_ADDRESS;
    const replayProtectionFlag = createXForm.crosschainReplayProtection ? "01" : "00";
    return buildFixedSaltPrefix(`0x${caller.slice(2)}${replayProtectionFlag}`);
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
        fixedSaltPrefix: buildFixedSaltPrefix(create2Form.fixedSaltPrefix),
        initCodeHash: normalizeHexInput(create2Form.initCodeHash),
      };
    }

    if (protocol === "createx") {
      return {
        protocol: "createx",
        createOperation: createXForm.createOperation,
        factory: createXForm.factory.trim() === "" ? DEFAULT_CREATEX_FACTORY : (createXForm.factory as `0x${string}`),
        fixedSaltPrefix: buildCreateXFixedSaltPrefix(),
        caller: normalizeAddressInput(createXForm.caller),
        chainId: createXForm.crosschainReplayProtection ? normalizeBigIntInput(createXForm.chainId) : undefined,
        initCodeHash:
          createXForm.createOperation === "create2" ? normalizeHexInput(createXForm.initCodeHash) : undefined,
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
    };
  }

  function handleStart() {
    setError(null);

    if (!support.supported) {
      setError("WebGPU is required for mining in this app.");
      return;
    }

    try {
      stopSession();
      const session = createMiningSession({ job: buildJob(), matcher: buildMatcher(), maxResults });
      setActiveSession(session);
      subscribeToSession(session);
      void session.start().catch((startError: unknown) => {
        setError(startError instanceof Error ? startError.message : "Failed to start mining");
      });
    } catch (startError: unknown) {
      setError(startError instanceof Error ? startError.message : "Failed to start mining");
    }
  }

  function handleStop() {
    stopSession({ clearState: true });
  }

  const topResults = sessionState?.results ?? [];

  function protocolLabel(value: Protocol): string {
    switch (value) {
      case "create2":
        return "CREATE2";
      case "createx":
        return "CreateX";
      case "safe":
        return "Safe";
    }

    return value;
  }

  return (
    <WorkbenchLayout
      sidebar={
        <>
          <Card>
            <CardHeader>
              <CardTitle>Protocol</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-1 rounded-xl border bg-muted p-1">
                {(["create2", "createx", "safe"] as Protocol[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
                      protocol === p
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => setProtocol(p)}
                  >
                    {protocolLabel(p)}
                  </button>
                ))}
              </div>
              <Separator />
              {protocol === "create2" ? (
                <div className="grid gap-4">
                  <Field>
                    <FieldLabel>Factory</FieldLabel>
                    <Input
                      value={create2Form.deployer}
                      onChange={(event) => updateCreate2("deployer", event.target.value)}
                      className="font-mono"
                    />
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
                    <FieldLabel>Salt Prefix</FieldLabel>
                    <Input
                      value={create2Form.fixedSaltPrefix}
                      onChange={(event) => updateCreate2("fixedSaltPrefix", event.target.value)}
                      className="font-mono"
                      placeholder="Optional hex prefix"
                    />
                  </Field>
                </div>
              ) : protocol === "createx" ? (
                <div className="grid gap-4">
                  <Field>
                    <FieldLabel>CreateX Mode</FieldLabel>
                    <NativeSelect
                      value={createXForm.createOperation}
                      onChange={(event) => updateCreateX("createOperation", event.target.value as CreateXOperation)}
                      className="w-full"
                    >
                      <NativeSelectOption value="create2">CREATE2</NativeSelectOption>
                      <NativeSelectOption value="create3">CREATE3</NativeSelectOption>
                    </NativeSelect>
                  </Field>
                  <Field>
                    <FieldLabel>Factory</FieldLabel>
                    <Input
                      value={createXForm.factory}
                      onChange={(event) => updateCreateX("factory", event.target.value)}
                      className="font-mono"
                    />
                  </Field>
                  {createXForm.createOperation === "create2" ? (
                    <Field>
                      <FieldLabel>Init Code Hash</FieldLabel>
                      <Input
                        value={createXForm.initCodeHash}
                        onChange={(event) => updateCreateX("initCodeHash", event.target.value)}
                        className="font-mono"
                      />
                    </Field>
                  ) : null}
                  <Field>
                    <FieldLabel>Caller</FieldLabel>
                    <Input
                      value={createXForm.caller}
                      onChange={(event) => updateCreateX("caller", event.target.value)}
                      className="font-mono"
                      placeholder="Leave blank for zero-address salt"
                    />
                    <FieldDescription>
                      This populates the caller bytes in the CreateX salt. Leave blank for permissionless deployment
                      salts.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel>Cross-Chain Replay Protection</FieldLabel>
                    <NativeSelect
                      value={createXForm.crosschainReplayProtection ? "enabled" : "disabled"}
                      onChange={(event) =>
                        updateCreateX("crosschainReplayProtection", event.target.value === "enabled")
                      }
                      className="w-full"
                    >
                      <NativeSelectOption value="disabled">Disabled</NativeSelectOption>
                      <NativeSelectOption value="enabled">Enabled</NativeSelectOption>
                    </NativeSelect>
                    <FieldDescription>
                      When enabled, CreateX guards the salt with the chain ID before address derivation.
                    </FieldDescription>
                  </Field>
                  {createXForm.crosschainReplayProtection ? (
                    <Field>
                      <FieldLabel>Chain ID</FieldLabel>
                      <Input
                        value={createXForm.chainId}
                        onChange={(event) => updateCreateX("chainId", event.target.value)}
                        className="font-mono"
                        placeholder="Required when replay protection is enabled"
                      />
                    </Field>
                  ) : null}
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
                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1.5 px-2 text-muted-foreground"
                      onClick={() => setShowAdvanced((v) => !v)}
                    >
                      {showAdvanced ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      Advanced
                    </Button>
                    {showAdvanced && (
                      <div className="mt-4 grid gap-4">
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
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Matcher</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <Field>
                  <div className="grid grid-cols-2 gap-2">
                    {MATCHER_OPTIONS.map(({ type, icon: Icon, label }) => (
                      <button
                        key={type}
                        type="button"
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-all duration-150",
                          matcher.type === type
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-muted-foreground/40 hover:bg-muted/50",
                        )}
                        onClick={() => updateMatcher("type", type)}
                      >
                        <Icon
                          className={cn(
                            "size-4 shrink-0",
                            matcher.type === type ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                        <span
                          className={cn(
                            "text-xs font-semibold",
                            matcher.type === type ? "text-primary" : "text-foreground",
                          )}
                        >
                          {label}
                        </span>
                      </button>
                    ))}
                  </div>
                </Field>
                <Field>
                  <FieldLabel>{matcher.type === "leadingZeros" ? "Minimum Leading Zeros" : "Matcher Value"}</FieldLabel>
                  <Input
                    value={matcher.value}
                    onChange={(event) => updateMatcher("value", event.target.value)}
                    className="font-mono"
                  />
                </Field>
              </div>
            </CardContent>
          </Card>
        </>
      }
    >
      <TelemetryCard
        sessionState={sessionState}
        support={support}
        error={error}
        active={active}
        onStart={handleStart}
        onStop={handleStop}
      />
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1">
              <CardTitle>Ranked Results</CardTitle>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="secondary">
                  <Settings className="size-4" />
                  <span>Settings</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Results Settings</DialogTitle>
                  <DialogDescription>Configure how results are collected during the mining session.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-5">
                  <Field>
                    <FieldLabel>Max Results</FieldLabel>
                    <div className="flex items-center gap-2">
                      {[10, 25, 50, 100].map((n) => (
                        <button
                          key={n}
                          type="button"
                          className={cn(
                            "flex h-8 min-w-10 items-center justify-center rounded-lg border px-2 text-sm font-medium transition-all",
                            maxResults === n
                              ? "border-primary bg-primary/5 text-primary"
                              : "border-border text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground",
                          )}
                          onClick={() => setMaxResults(n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                    <FieldDescription>Number of top results to keep ranked during the session.</FieldDescription>
                  </Field>
                  <Field>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={stopWhenFound}
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-all",
                        stopWhenFound
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-muted-foreground/40 hover:bg-muted/50",
                      )}
                      onClick={() => setStopWhenFound((v) => !v)}
                    >
                      <span className={cn("font-medium", stopWhenFound ? "text-primary" : "text-foreground")}>
                        Stop on first match
                      </span>
                      <div
                        className={cn(
                          "relative h-5 w-9 rounded-full border transition-colors",
                          stopWhenFound ? "border-primary bg-primary" : "border-border bg-muted",
                        )}
                      >
                        <div
                          className={cn(
                            "absolute top-0.5 size-3.5 rounded-full bg-white shadow-sm transition-transform",
                            stopWhenFound ? "translate-x-4.5" : "translate-x-0.5",
                          )}
                        />
                      </div>
                    </button>
                    <FieldDescription>Automatically stop mining as soon as one valid result is found.</FieldDescription>
                  </Field>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {topResults.length === 0 ? (
            <EmptyState>No GPU-verified winners yet. Start mining to populate the ranked address table.</EmptyState>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">#</TableHead>
                  <TableHead className="w-16">Score</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topResults.map((result: (typeof topResults)[number], index: number) => (
                  <TableRow key={`${result.address}-${result.nonce.toString()}`}>
                    <TableCell className="text-xs text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium">{result.score}</TableCell>
                    <TableCell className="min-w-0">
                      <div className="">
                        <div className="flex min-w-0 items-center gap-2">
                          <HighlightedAddress
                            address={result.address}
                            zeros={result.leadingZeroNibbles}
                          />
                          <CopyValueButton
                            value={result.address}
                            label="Copy address"
                          />
                        </div>
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate font-mono text-sm text-muted-foreground">{result.salt}</p>
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
    </WorkbenchLayout>
  );
}

function HighlightedAddress({ address, zeros }: { address: string; zeros: number }) {
  const zeroPart = address.slice(0, 2 + zeros);
  const rest = address.slice(2 + zeros);
  return (
    <p className="truncate font-mono text-sm">
      <span className="font-semibold text-primary">{zeroPart}</span>
      <span className="text-foreground">{rest}</span>
    </p>
  );
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
