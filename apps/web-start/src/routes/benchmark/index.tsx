import { createFileRoute } from "@tanstack/react-router";

import { BenchmarkConsole } from "@/components/miner/benchmark-console";

export const Route = createFileRoute("/benchmark/")({
  component: BenchmarkPage,
});

function BenchmarkPage() {
  return <BenchmarkConsole />;
}
