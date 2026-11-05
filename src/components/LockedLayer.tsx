import * as React from "react";
import { Lock, Sparkles, ArrowRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export interface LockedLayerProps {
  /** Name of the layer or feature being locked */
  layerName?: string;
  /** Reason for locking: "Opens on day 3" | "After your plan" | "Full plan only" | string */
  reason: "Opens on day 3" | "After your plan" | "Full plan only" | string;
  /** Optional custom title */
  title?: string;
  /** Optional custom description */
  description?: string;
  /** Optional CTA link or button */
  actionLink?: string;
  /** Optional CTA label */
  actionLabel?: string;
  className?: string;
}

export function LockedLayer({
  layerName,
  reason,
  title,
  description,
  actionLink,
  actionLabel,
  className,
}: LockedLayerProps) {
  const { t } = useLanguage();

  // Resolve localized reason text
  const localizedReason = React.useMemo(() => {
    const rLower = reason.toLowerCase();
    if (rLower.includes("day 3") || rLower.includes("day_3")) {
      return t("locked_reason_day_3", "Opens on day 3");
    }
    if (rLower.includes("after your plan") || rLower.includes("after_plan")) {
      return t("locked_reason_after_plan", "After your plan");
    }
    if (rLower.includes("full plan only") || rLower.includes("full_plan")) {
      return t("locked_reason_full_plan", "Full plan only");
    }
    return reason;
  }, [reason, t]);

  const defaultTitle = layerName
    ? `${layerName} ${t("locked_suffix", "is locked")}`
    : t("layer_locked_title", "Layer locked");

  const defaultDescription = React.useMemo(() => {
    const rLower = reason.toLowerCase();
    if (rLower.includes("day 3") || rLower.includes("day_3")) {
      return t(
        "locked_desc_day_3",
        "This layer activates on Day 3 of your sprint once your foundation habits have settled.",
      );
    }
    if (rLower.includes("after your plan") || rLower.includes("after_plan")) {
      return t(
        "locked_desc_after_plan",
        "Complete your initial plan calibration to unlock this section and build out your daily actions.",
      );
    }
    if (rLower.includes("full plan only") || rLower.includes("full_plan")) {
      return t(
        "locked_desc_full_plan",
        "Available on full protocol plans. Upgrade or complete your milestone review to gain access.",
      );
    }
    return t("locked_desc_generic", "This layer is currently locked based on your protocol stage.");
  }, [reason, t]);

  return (
    <div
      role="region"
      aria-label={title || defaultTitle}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-dashed border-border bg-card/60 p-8 sm:p-12 text-center",
        "flex flex-col items-center justify-center space-y-4 backdrop-blur-xs transition-all",
        className,
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-2xl border border-border bg-muted/50 text-muted-foreground shadow-xs">
        <Lock className="size-6 stroke-[1.75]" aria-hidden="true" />
      </div>

      <div className="space-y-1.5 max-w-md">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
          <Sparkles className="size-3" aria-hidden="true" />
          <span>{localizedReason}</span>
        </div>
        <h3 className="text-xl font-semibold tracking-tight text-foreground">
          {title || defaultTitle}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description || defaultDescription}
        </p>
      </div>

      {actionLink && actionLabel && (
        <div className="pt-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5 rounded-xl font-medium">
            <Link to={actionLink}>
              {actionLabel}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export default LockedLayer;

