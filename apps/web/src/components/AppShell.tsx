import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Compass,
  LayoutGrid,
  ListChecks,
  LogOut,
  MessageSquare,
  Settings,
  Sparkles,
  Sun,
  Timer,
  UserCog,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { LanguageSelector } from "@/components/ui/language-selector";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", key: "nav_dashboard", fallback: "Dashboard", icon: LayoutGrid },
  { to: "/daily", key: "nav_daily_os", fallback: "Daily OS", icon: Sun },
  { to: "/plan", key: "nav_plan", fallback: "Plan", icon: ListChecks },
  { to: "/protocol", key: "nav_protocol", fallback: "Protocol", icon: Compass },
  { to: "/mentor", key: "nav_mentor", fallback: "AI Mentor", icon: MessageSquare },
  { to: "/character", key: "nav_character", fallback: "Character", icon: UserCog },
  { to: "/knowledge", key: "nav_knowledge", fallback: "Knowledge", icon: BookOpen },
  { to: "/legacy", key: "nav_legacy", fallback: "Legacy", icon: Timer },
  { to: "/settings", key: "nav_settings", fallback: "Settings", icon: Settings },
] as const;

const MOBILE = new Set(["/dashboard", "/daily", "/mentor", "/protocol", "/settings"]);

/** Sidebar on desktop, bottom navigation on mobile (design direction). */
export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { api, signOut } = useAuth();
  const { t } = useLanguage();

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data } = await api.GET("/api/v1/me");
      return data ?? null;
    },
    staleTime: 60_000,
  });

  const items = NAV.map((i) => ({ ...i, label: t(i.key, i.fallback) }));
  const mobileItems = items.filter((i) => MOBILE.has(i.to));
  const active = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  return (
    <div className="min-h-screen w-full bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-sidebar px-4 py-6 lg:flex">
        <div className="flex items-center justify-between px-2">
          <Link to="/dashboard" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="size-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">{t("app_name", "Alter Ego OS")}</span>
          </Link>
        </div>

        <nav className="mt-6 flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="Primary">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active(item.to) ? "page" : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                active(item.to)
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
              )}
            >
              <item.icon
                className={cn(
                  "size-4 transition-colors",
                  active(item.to) ? "text-accent" : "text-muted-foreground group-hover:text-foreground",
                )}
              />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mb-3">
          <LanguageSelector className="w-full justify-between" />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="label-eyebrow">{t("app_alter_ego_label", "Alter ego")}</p>
          <p className="mt-1.5 font-display text-lg leading-tight">{me.data?.alter_ego_name || "—"}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{me.data?.display_name}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-3 flex items-center gap-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <LogOut className="size-3.5" /> {t("settings_sign_out", "Sign out")}
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/85 px-5 py-3.5 backdrop-blur-md lg:hidden">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Sparkles className="size-3.5" />
            </span>
            <span className="text-sm font-semibold">{t("app_name", "Alter Ego OS")}</span>
          </Link>
          <LanguageSelector />
        </header>

        <main className="mx-auto w-full max-w-6xl px-5 pb-28 pt-6 sm:px-8 lg:pb-16 lg:pt-10">
          {children}
        </main>
      </div>

      <nav
        aria-label="Primary mobile"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        {mobileItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
              active(item.to) ? "text-accent" : "text-muted-foreground",
            )}
          >
            <item.icon className="size-[18px]" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rise-in mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? <p className="label-eyebrow mb-2">{eyebrow}</p> : null}
        <h1 className="text-display text-3xl sm:text-4xl">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
