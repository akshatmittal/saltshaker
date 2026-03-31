import { HeadContent, Scripts, createRootRoute } from "@tanstack/react-router";

import { Header } from "@/components/layout/header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { PropsWithChildren } from "react";

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
        title: "Salt Shaker",
      },
      {
        name: "description",
        content: "WebGPU based CREATE2 vanity address mining in the browser.",
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
              <main className="flex min-h-svh flex-col pt-16">
                <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4">{children}</div>
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
