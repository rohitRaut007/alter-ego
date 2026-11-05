import * as React from "react";
import { Sparkles, AlertTriangle, CheckCircle, BarChart3, Clock, Calendar, ArrowRight, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { StatePill } from "@/components/StatePill";
import { TradeoffOptions } from "./TradeoffOptions";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Card, FeasibilityVerdict as FeasibilityVerdictType, TradeoffSelectionPayload } from "@/lib/api-types";

export interface FeasibilityVerdictProps {
  card: Card;
  onTradeoffApplied?: (payload: TradeoffSelectionPayload) => Promise<void>;
  onPollCheck?: () => Promise<Card | null>;
  className?: string;
}

export function FeasibilityVerdict({
  card,
  onTradeoffApplied,
  onPollCheck,
  className,
}: FeasibilityVerdictProps) {
  const { t } = useLanguage();
  const [currentCard, setCurrentCard] = React.useState<Card>(card);
  const [isPolling, setIsPolling] = React.useState<boolean>(card.state === "calibrating");
  const inFlightRef = React.useRef<boolean>(false);

  // Poll card-list endpoint every 2 seconds while calibrating
  React.useEffect(() => {
    if (currentCard.state !== "calibrating" || !onPollCheck) {
      setIsPolling(false);
      return;
    }

    setIsPolling(true);

    const intervalId = setInterval(async () => {
      // Guard against overlapping requests
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      try {
        const updated = await onPollCheck();
        if (updated) {
          setCurrentCard(updated);
          if (updated.state !== "calibrating") {
            clearInterval(intervalId);
            setIsPolling(false);
          }
        }
      } catch (err) {
        console.error("Calibration poll failed:", err);
      } finally {
        inFlightRef.current = false;
      }
    }, 2000);

    return () => {
      clearInterval(intervalId);
      inFlightRef.current = false;
    };
  }, [currentCard.state, onPollCheck]);

  const verdict = currentCard.verdict;

  if (currentCard.state === "calibrating" && !verdict) {
    return (
      <div className={cn("rounded-2xl border border-blue-500/20 bg-blue-500/5 p-8 text-center space-y-4", className)}>
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 animate-spin">
          <Loader2 className="size-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold tracking-tight">{t("calibrating_title", "Calibrating Protocol Feasibility...")}</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {t("calibrating_desc", "Auditing goal horizon against weekly deep work capacity. Polling updates every 2 seconds...")}
          </p>
        </div>
      </div>
    );
  }

  if (!verdict) {
    return null;
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "feasible":
        return {
          icon: CheckCircle,
          label: t("verdict_feasible", "Feasible"),
          color: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        };
      case "stretch":
        return {
          icon: AlertTriangle,
          label: t("verdict_stretch", "High Stretch"),
          color: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
        };
      case "unfeasible":
      default:
        return {
          icon: AlertTriangle,
          label: t("verdict_unfeasible", "Friction Overload"),
          color: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-400",
        };
    }
  };

  const statusInfo = getStatusBadge(verdict.status);
  const StatusIcon = statusInfo.icon;

  const handleApplyTradeoff = async (payload: TradeoffSelectionPayload) => {
    if (onTradeoffApplied) {
      await onTradeoffApplied(payload);
    }
  };

  return (
    <div className={cn("space-y-6 rounded-3xl border border-border bg-card p-6 shadow-sm", className)}>
      {/* Header and Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("verdict_eyebrow", "Calibration Engine")}
            </span>
            {isPolling && (
              <span className="flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 animate-pulse font-medium">
                <Loader2 className="size-3 animate-spin" />
                {t("live_polling", "Syncing...")}
              </span>
            )}
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            {t("verdict_title", "Feasibility Verdict")}
          </h2>
        </div>

        <div
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
            statusInfo.color,
          )}
        >
          <StatusIcon className="size-3.5 shrink-0" />
          <span>{statusInfo.label}</span>
        </div>
      </div>

      {/* Metrics Row (Server provided numbers only) */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border/70 bg-muted/30 p-3.5 text-center space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase">{t("effort_hours", "Effort")}</p>
          <p className="font-mono text-xl font-bold text-foreground">{verdict.effort_hours}h</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-muted/30 p-3.5 text-center space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase">{t("weekly_hours", "Weekly")}</p>
          <p className="font-mono text-xl font-bold text-foreground">{verdict.weekly_hours}h/wk</p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-muted/30 p-3.5 text-center space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase">{t("coverage", "Coverage")}</p>
          <p className="font-mono text-xl font-bold text-foreground">{verdict.coverage_pct}%</p>
        </div>
      </div>

      {/* Verdict explanation text */}
      <div className="rounded-2xl border border-border bg-muted/20 p-4">
        <p className="text-sm text-foreground/90 leading-relaxed">{verdict.verdict_text}</p>
      </div>

      {/* Tradeoff Options */}
      {verdict.tradeoff_options && verdict.tradeoff_options.length > 0 && (
        <div className="space-y-3 pt-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("tradeoffs_title", "Calibrated Tradeoff Levers")}
          </h3>
          <TradeoffOptions
            options={verdict.tradeoff_options}
            onSelectOption={handleApplyTradeoff}
          />
        </div>
      )}
    </div>
  );
}

export default FeasibilityVerdict;

