import * as React from "react";
import { AlertCircle, RefreshCw, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CardTile } from "./CardTile";
import { CardSheet } from "./CardSheet";
import { useCards } from "./useCards";
import { useLanguage } from "@/lib/i18n";
import type { Card } from "@/lib/api-types";

export interface CardGridProps {
  className?: string;
  onCardSelect?: (card: Card) => void;
}

export function CardGrid({ className, onCardSelect }: CardGridProps) {
  const { t } = useLanguage();
  const { cards, loading, error, refreshCards, completeCard } = useCards();

  const [activeCard, setActiveCard] = React.useState<Card | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState<boolean>(false);

  const handleTileClick = (card: Card) => {
    setActiveCard(card);
    setSheetOpen(true);
    onCardSelect?.(card);
  };

  const handleCardComplete = (cardId: string) => {
    completeCard(cardId);
    // Update local active card state to reflect completed status
    setActiveCard((prev) => (prev && prev.id === cardId ? { ...prev, state: "needs_review", completed: true } : prev));
  };

  // Loading state
  if (loading) {
    return (
      <div
        role="status"
        aria-label={t("loading_cards", "Loading protocol cards")}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-44 rounded-2xl border border-border bg-card p-5 space-y-3">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-6 w-3/4 rounded-lg" />
            <Skeleton className="h-4 w-full rounded-md" />
            <div className="pt-4 flex justify-between">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center space-y-3"
      >
        <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-destructive/20 text-destructive">
          <AlertCircle className="size-5" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-sm text-destructive">{t("cards_error_title", "Failed to load cards")}</p>
          <p className="text-xs text-destructive/80">{error}</p>
        </div>
        <Button variant="outline" size="sm" onClick={refreshCards} className="gap-1.5 text-xs rounded-xl">
          <RefreshCw className="size-3.5" />
          <span>{t("retry", "Retry")}</span>
        </Button>
      </div>
    );
  }

  // Empty state
  if (cards.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center space-y-3">
        <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Layers className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-base">{t("no_cards_title", "No protocol cards active")}</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {t("no_cards_desc", "Complete your initial seed calibration to generate your targeted protocol cards.")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        role="region"
        aria-label="Protocol Cards"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
      >
        {cards.map((card) => (
          <CardTile key={card.id} card={card} onClick={handleTileClick} />
        ))}
      </div>

      <CardSheet
        card={activeCard}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onCardComplete={handleCardComplete}
      />
    </>
  );
}

export default CardGrid;

