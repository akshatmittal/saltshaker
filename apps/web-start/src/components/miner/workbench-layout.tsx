import type { PropsWithChildren, ReactNode } from "react";

import { cn } from "@/lib/utils";

type WorkbenchLayoutProps = {
  sidebar: ReactNode;
  className?: string;
};

/**
 * Shared shell for miner and benchmark: sidebar column + wide main column with telemetry/results.
 */
export function WorkbenchLayout({ sidebar, className, children }: PropsWithChildren<WorkbenchLayoutProps>) {
  return (
    <div className={cn("flex flex-1 flex-col gap-2 py-4", className)}>
      <section className="grid grid-cols-3 gap-4">
        <div className="space-y-4">{sidebar}</div>
        <div className="col-span-2 space-y-4">{children}</div>
      </section>
    </div>
  );
}
