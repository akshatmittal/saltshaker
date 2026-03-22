"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Satellite, TrophyIcon, UserRoundIcon } from "lucide-react";

import { useScroll } from "@/hooks/use-scroll";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navItems = [
  {
    title: "Benchmark",
    href: "/benchmark",
    icon: TrophyIcon,
  },
];

export function Header() {
  const scrolled = useScroll(10);
  const pathname = usePathname();
  const profileIsActive = pathname === "/profile";

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/80",
        {
          "shadow-sm": scrolled,
        },
      )}
    >
      <nav className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-2 transition-colors hover:bg-muted"
          >
            <Satellite className="size-5!" />
            <span className="text-base font-semibold">Salt Shaker</span>
          </Link>
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/profile"
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Button
                  key={item.href}
                  asChild
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn("h-9 gap-2 px-3", isActive && "text-primary")}
                >
                  <Link href={item.href}>
                    <Icon className={cn("size-4", isActive ? "text-primary" : "text-muted-foreground")} />
                    <span>{item.title}</span>
                  </Link>
                </Button>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant={profileIsActive ? "secondary" : "ghost"}
            className={cn("h-9 gap-2 px-3", profileIsActive && "text-primary")}
          >
            <Link href="/profile">
              <UserRoundIcon className={cn("size-4", profileIsActive ? "text-primary" : "text-muted-foreground")} />
              <span>Profile</span>
            </Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
