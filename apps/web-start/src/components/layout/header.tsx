import { Link, useRouterState } from "@tanstack/react-router";
import { Gauge, Moon, Pickaxe, Stone, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import { useScroll } from "@/hooks/use-scroll";
import { cn } from "@/lib/utils";

const navItems = [
  {
    title: "Miner",
    href: "/",
    icon: Pickaxe,
  },
  {
    title: "Benchmark",
    href: "/benchmark",
    icon: Gauge,
  },
];

const GITHUB_REPO_URL = "https://github.com/akshatmittal/saltshaker";

export function Header() {
  const scrolled = useScroll(10);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/80",
        {
          "shadow-sm": scrolled,
        },
      )}
    >
      <nav className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-3 py-2 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6 sm:py-0">
        <div className="flex items-center justify-between gap-3 sm:min-w-0">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
          >
            <Stone className="size-5" />
            <span className="text-base font-semibold">Saltshaker</span>
          </Link>
          <HeaderActions
            className="sm:hidden"
            resolvedTheme={resolvedTheme}
            setTheme={setTheme}
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:min-w-0 sm:flex-1 sm:justify-start sm:pb-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Button
                key={item.href}
                asChild
                variant={isActive ? "secondary" : "ghost"}
                className={cn("h-9 flex-1 gap-2 px-3 sm:flex-none", isActive && "text-primary")}
              >
                <Link to={item.href}>
                  <Icon className={cn("size-4", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span>{item.title}</span>
                </Link>
              </Button>
            );
          })}
        </div>

        <HeaderActions
          className="hidden sm:flex"
          resolvedTheme={resolvedTheme}
          setTheme={setTheme}
        />
      </nav>
    </header>
  );
}

function HeaderActions({
  className,
  resolvedTheme,
  setTheme,
}: {
  className?: string;
  resolvedTheme: string | undefined;
  setTheme: (theme: string) => void;
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs text-muted-foreground">
        <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
        WebGPU
      </div>
      <Button
        asChild
        variant="ghost"
        size="icon"
      >
        <a
          href={GITHUB_REPO_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Open GitHub repository"
        >
          <GitHubMark className="size-4" />
        </a>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle theme"
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      >
        {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
    </div>
  );
}

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-1.95c-3.2.7-3.88-1.36-3.88-1.36-.52-1.34-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.95.1-.75.4-1.25.72-1.53-2.55-.29-5.24-1.28-5.24-5.67 0-1.25.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a10.9 10.9 0 0 1 5.78 0c2.2-1.5 3.17-1.18 3.17-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.09 0 4.4-2.69 5.38-5.25 5.66.41.36.78 1.08.78 2.18v3.23c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}
