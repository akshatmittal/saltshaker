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
    <div className={cn("flex flex-1 flex-col gap-3 py-3 sm:gap-4 sm:py-4", className)}>
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">{sidebar}</div>
        <div className="space-y-4 lg:col-span-2">{children}</div>
      </section>
    </div>
  );
}
