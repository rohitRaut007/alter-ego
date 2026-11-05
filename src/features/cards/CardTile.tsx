import * as React from "react";
import { Clock, HelpCircle, Lock, ArrowUpRight } from "lucide-react";
import { StatePill } from "@/components/StatePill";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Card } from "@/lib/api-types";

export interface CardTileProps {
  card: Card;
  onClick: (card: Card) => void;
  className?: string;
}

export function CardTile({ card, onClick, className }: CardTileProps) {
  const { t } = useLanguage();
  const isLocked = card.state === "locked";

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isLocked) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(card);
    }
  };

  return (
    <div
      role="button"
      tabIndex={isLocked ? -1 : 0}
      aria-disabled={isLocked}
      aria-label={`${card.title}. Status: ${card.state}`}
      onClick={() => !isLocked && onClick(card)}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl border p-5 text-left transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        isLocked
          ? "border-border/60 bg-card/40 opacity-75 cursor-not-allowed"
          : "border-border bg-card hover:border-foreground/20 hover:shadow-lift cursor-pointer",
        className,
      )}
    >
      <div className="space-y-3">
        {/* Top row: State Pill and action indicator */}
        <div className="flex items-center justify-between">
          <StatePill state={card.state} />
          {!isLocked && (
            <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          )}
        </div>

        {/* Title & Description */}
        <div className="space-y-1">
          <h3 className="text-base font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
            {card.title}
          </h3>
          {card.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {card.description}
            </p>
          )}
        </div>
      </div>

      {/* Bottom meta row */}
      <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
        {isLocked ? (
          <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
            <Lock className="size-3.5" />
            <span>{card.unlock_reason || t("locked_reason_default", "Locked")}</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {card.question_count !== undefined && (
              <span className="flex items-center gap-1">
                <HelpCircle className="size-3.5" />
                <span>{card.question_count} {t("questions", "questions")}</span>
              </span>
            )}
            {card.estimated_minutes !== undefined && (
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" />
                <span>~{card.estimated_minutes} min</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CardTile;

