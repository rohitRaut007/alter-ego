import * as React from "react";
import { Check, Calendar, Clock, Scissors, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { TradeoffOption, TradeoffSelectionPayload } from "@/lib/api-types";
import { apiClient } from "@/lib/api-client";

export interface TradeoffOptionsProps {
  options: TradeoffOption[];
  cardId?: string;
  onSelectOption?: (payload: TradeoffSelectionPayload) => Promise<void>;
  selectedChoice?: string | null;
  disabled?: boolean;
}

export function TradeoffOptions({
  options,
  cardId,
  onSelectOption,
  selectedChoice,
  disabled = false,
}: TradeoffOptionsProps) {
  const { t } = useLanguage();
  const [submittingChoice, setSubmittingChoice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [successChoice, setSuccessChoice] = React.useState<string | null>(selectedChoice || null);

  const getIcon = (id: string) => {
    switch (id) {
      case "move_date":
        return Calendar;
      case "add_time":
        return Clock;
      case "narrow_scope":
      default:
        return Scissors;
    }
  };

  const handleSelect = async (opt: TradeoffOption) => {
    if (!opt.available || disabled || submittingChoice) return;

    setSubmittingChoice(opt.id);
    setError(null);

    try {
      // Contract requirement: Payload must be { choices: [optionId] }
      const payload: TradeoffSelectionPayload = {
        choices: [opt.id],
      };
      if (onSelectOption) {
        await onSelectOption(payload);
      } else if (cardId) {
        await apiClient.submitTradeoffs(cardId, [opt.id]);
      }
      setSuccessChoice(opt.id);
    } catch (err: any) {
      setError(err?.message || t("tradeoff_submit_error", "Failed to apply tradeoff. Please try again."));
    } finally {
      setSubmittingChoice(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="space-y-3" role="radiogroup" aria-label="Tradeoff choices">
        {options.map((opt) => {
          const Icon = getIcon(opt.id);
          const isSelected = successChoice === opt.id;
          const isSubmittingThis = submittingChoice === opt.id;
          const isAvailable = opt.available;

          return (
            <div
              key={opt.id}
              className={cn(
                "rounded-2xl border p-4 transition-all duration-200",
                isSelected
                  ? "border-primary bg-primary/5 shadow-xs"
                  : isAvailable
                    ? "border-border bg-card hover:border-foreground/25"
                    : "border-border/50 bg-muted/30 opacity-60 cursor-not-allowed",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex size-9 items-center justify-center rounded-xl border shrink-0 mt-0.5",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </div>

                  <div className="space-y-1">
                    <p className="font-semibold text-sm text-foreground">{opt.label}</p>
                    {opt.impact_summary && (
                      <p className="text-xs font-mono font-medium text-primary">
                        {opt.impact_summary}
                      </p>
                    )}
                    {!isAvailable && opt.reason_disabled && (
                      <p className="text-xs text-muted-foreground italic">
                        {opt.reason_disabled}
                      </p>
                    )}
                  </div>
                </div>

                <div className="shrink-0 pt-0.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    disabled={!isAvailable || disabled || Boolean(submittingChoice)}
                    onClick={() => handleSelect(opt)}
                    className="rounded-xl text-xs h-8 px-3 font-medium gap-1.5"
                  >
                    {isSubmittingThis ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : isSelected ? (
                      <>
                        <Check className="size-3.5" />
                        <span>{t("applied", "Applied")}</span>
                      </>
                    ) : (
                      <span>{t("select", "Select")}</span>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TradeoffOptions;

