import * as React from "react";
import { Lock, AlertCircle, Sparkles, CheckCircle2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

export type CardState =
  | "locked"
  | "needs_input"
  | "calibrating"
  | "active"
  | "needs_review"
  | "Locked"
  | "Needs input"
  | "Calibrating"
  | "Active"
  | "Needs review";

export interface StatePillProps {
  state: CardState | string;
  className?: string;
  showIcon?: boolean;
}

export function StatePill({ state, className, showIcon = true }: StatePillProps) {
  const { t } = useLanguage();

  // Normalize state key
  const normalized = React.useMemo(() => {
    const s = state.toLowerCase().replace(/[-\s]/g, "_");
    if (s.includes("lock")) return "locked";
    if (s.includes("input")) return "needs_input";
    if (s.includes("calibrat")) return "calibrating";
    if (s.includes("review")) return "needs_review";
    if (s.includes("active")) return "active";
    return s as "locked" | "needs_input" | "calibrating" | "active" | "needs_review";
  }, [state]);

  const config = React.useMemo(() => {
    switch (normalized) {
      case "locked":
        return {
          label: t("status_locked", "Locked"),
          icon: Lock,
          className: "border-border bg-muted/60 text-muted-foreground",
          dotColor: "bg-muted-foreground/60",
        };
      case "needs_input":
        return {
          label: t("status_needs_input", "Needs input"),
          icon: AlertCircle,
          className: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
          dotColor: "bg-amber-500",
        };
      case "calibrating":
        return {
          label: t("status_calibrating", "Calibrating"),
          icon: Sparkles,
          className: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400 animate-pulse",
          dotColor: "bg-blue-500",
        };
      case "needs_review":
        return {
          label: t("status_needs_review", "Needs review"),
          icon: AlertTriangle,
          className: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-400",
          dotColor: "bg-orange-500",
        };
      case "active":
      default:
        return {
          label: t("status_active", "Active"),
          icon: CheckCircle2,
          className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
          dotColor: "bg-emerald-500",
        };
    }
  }, [normalized, t]);

  const IconComponent = config.icon;

  return (
    <span
      role="status"
      aria-label={`Status: ${config.label}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide transition-colors",
        config.className,
        className,
      )}
    >
      {showIcon && <IconComponent className="size-3 shrink-0" aria-hidden="true" />}
      <span className="capitalize">{config.label}</span>
    </span>
  );
}

export default StatePill;

