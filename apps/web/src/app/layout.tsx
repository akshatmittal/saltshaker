import { Geist, Geist_Mono } from "next/font/google";

import { Header } from "@/components/layout/header";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import "./globals.css";

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, fontSans.variable)}
    >
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
      </body>
    </html>
  );
}
