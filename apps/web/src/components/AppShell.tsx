import { Compass, LayoutGrid, ListChecks, LogOut, Sparkles, Sun, UserCog } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { cn } from "@/components/ui";
import { useAuth } from "@/lib/auth";

const NAV = [
  { to: "/", label: "Home", icon: LayoutGrid, end: true },
  { to: "/today", label: "Today", icon: Sun, end: false },
  { to: "/plan", label: "Plan", icon: ListChecks, end: false },
  { to: "/character", label: "Character", icon: UserCog, end: false },
  { to: "/protocol", label: "Protocol", icon: Compass, end: false },
] as const;

/** Sidebar on desktop, bottom navigation on mobile. More destinations arrive with later phases. */
export function AppShell({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-surface px-4 py-6 lg:flex">
        <div className="flex items-center gap-2.5 px-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="size-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">Alter Ego OS</span>
        </div>
        <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Primary">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  isActive
                    ? "bg-card text-foreground shadow-soft"
                    : "text-muted-foreground hover:bg-card hover:text-foreground",
                )
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => void signOut()}
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition hover:bg-card hover:text-foreground"
        >
          <LogOut className="size-4" />
          Sign out
        </button>
      </aside>

      <main className="pb-24 lg:pb-12 lg:pl-64">
        <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8 sm:py-12">{children}</div>
      </main>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-background/95 backdrop-blur lg:hidden"
      >
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium",
                isActive ? "text-accent" : "text-muted-foreground",
              )
            }
          >
            <item.icon className="size-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
