"use client";

import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function HeroPanel({ children }: { children: ReactNode }) {
  return (
    <Card>
      <CardContent className="p-6">{children}</CardContent>
    </Card>
  );
}

export function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <Card size="sm">
      <CardHeader className="gap-0">
        <CardDescription>{label}</CardDescription>
        <CardTitle>{value}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{accent}</p>
      </CardContent>
    </Card>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <Card>
      <CardContent className="text-sm text-muted-foreground">{children}</CardContent>
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
        className="font-mono"
      />
    </Field>
  );
}
