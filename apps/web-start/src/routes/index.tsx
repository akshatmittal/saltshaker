import { createFileRoute } from "@tanstack/react-router";

import { MinerConsole } from "@/components/miner/miner-console";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return <MinerConsole />;
}
