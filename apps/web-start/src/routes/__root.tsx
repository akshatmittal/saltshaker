import type { PropsWithChildren } from "react";

import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";
import { TriangleAlert } from "lucide-react";

import { Header } from "@/components/layout/header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Saltshaker",
      },
      {
        name: "description",
        content: "Extremely Fast WebGPU based CREATE2 Vanity Miner for Create2, CreateX and Safe deployments",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: PropsWithChildren) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className="antialiased"
    >
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider>
          <TooltipProvider>
            <div className="min-h-svh bg-background">
              <Header />
              <main className="flex min-h-svh flex-col pt-26 sm:pt-16">
                <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-3 pb-4 sm:px-4 sm:pb-6">
                  <MobileDesktopNotice />
                  {children}
                </div>
              </main>
              <Toaster />
            </div>
          </TooltipProvider>
        </ThemeProvider>
        <Scripts />
      </body>
    </html>
  );
}

function MobileDesktopNotice() {
  return (
    <div className="sm:hidden">
      <div className="mt-3 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <p>
          Saltshaker works on mobile for quick checks, but it is designed for desktop use. For the best experience, use
          a desktop browser.
        </p>
      </div>
    </div>
  );
}
