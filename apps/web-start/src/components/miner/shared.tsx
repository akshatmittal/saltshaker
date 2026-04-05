import type { ReactNode } from "react";

import type { MiningSessionState, CheckWebGpuSupportResult } from "@akshatmittal/saltshaker";
import type { LucideIcon } from "lucide-react";

import { Play, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function StatCard({ label, value, highlight }: { label: string; value: ReactNode; highlight?: boolean }) {
  return (
    <Card className={cn("transition-all duration-300", highlight && "bg-primary/5 ring-primary/25")}>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-semibold tabular-nums">{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

export function EmptyState({ children, icon: Icon }: { children: ReactNode; icon?: LucideIcon }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        {Icon && <Icon className="size-8 text-muted-foreground/50" />}
        <p className="text-sm text-muted-foreground">{children}</p>
      </CardContent>
    </Card>
  );
}

export function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <Input
        value={value}
        readOnly
        disabled
        className="font-mono"
      />
    </Field>
  );
}

export function TelemetryCard({
  sessionState,
  support,
  error,
  active,
  startLabel = "Start",
  emptyMessage,
  onStart,
  onStop,
}: {
  sessionState: MiningSessionState | null;
  support: CheckWebGpuSupportResult;
  error: string | null;
  active: boolean;
  startLabel?: string;
  emptyMessage?: string;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle>Telemetry</CardTitle>
              {active && (
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
              )}
            </div>
            <CardDescription className={cn((error !== null || !support.supported) && "text-destructive")}>
              {error ??
                (!support.supported
                  ? "WebGPU is not supported in this browser."
                  : (sessionState?.statusDetail ??
                    (sessionState?.status
                      ? sessionState.status.charAt(0).toUpperCase() + sessionState.status.slice(1)
                      : "Idle")))}
            </CardDescription>
          </div>
          <Button
            variant={active ? "destructive" : "default"}
            disabled={!support.supported}
            onClick={active ? onStop : onStart}
            className="w-full sm:w-auto"
          >
            {active ? <Square className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
            {active ? "Stop" : startLabel}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sessionState === null && emptyMessage ? (
          <EmptyState>{emptyMessage}</EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <StatCard
              label="Status"
              value={sessionState?.status ?? "idle"}
              highlight={active}
            />
            <StatCard
              label="Hash Rate"
              value={formatHashRate(sessionState?.hashrate ?? 0)}
              highlight={active}
            />
            <StatCard
              label="Elapsed"
              value={formatDuration(sessionState?.elapsedMs ?? 0)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function formatHashRate(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)} GH/s`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)} MH/s`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)} KH/s`;
  return `${value.toFixed(0)} H/s`;
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}
