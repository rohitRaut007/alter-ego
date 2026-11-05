import * as React from "react";
import type { Card } from "@/lib/api-types";
import { apiClient } from "@/lib/api-client";
import { mockCardListEveryState } from "@/test/fixtures";

export interface UseCardsOptions {
  demoMode?: boolean;
}

export function useCards(options: UseCardsOptions = {}) {
  const { demoMode = false } = options;
  const [cards, setCards] = React.useState<Card[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const inFlightRef = React.useRef<boolean>(false);
  const pollTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCards = React.useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setError(null);

    try {
      if (demoMode) {
        setCards(mockCardListEveryState);
      } else {
        const result = await apiClient.getCards();
        setCards(result);
      }
    } catch (err: any) {
      // In production: Do NOT silently substitute mock fixtures!
      // Report genuine error with retry option
      setError(err?.message || "Failed to load cards from backend. Please retry.");
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [demoMode]);

  // Initial fetch
  React.useEffect(() => {
    void fetchCards();
  }, [fetchCards]);

  // Calibration polling loop: poll every 2 seconds while any card is calibrating
  React.useEffect(() => {
    const hasCalibrating = cards.some((c) => c.state === "calibrating");

    if (hasCalibrating && !pollTimerRef.current && !demoMode) {
      pollTimerRef.current = setInterval(async () => {
        if (inFlightRef.current) return;
        inFlightRef.current = true;

        try {
          const updatedCards = await apiClient.getCards();
          setCards(updatedCards);

          // If no longer calibrating, stop polling
          if (!updatedCards.some((c) => c.state === "calibrating")) {
            if (pollTimerRef.current) {
              clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
            }
          }
        } catch (pollErr) {
          console.error("Card calibration poll error:", pollErr);
        } finally {
          inFlightRef.current = false;
        }
      }, 2000);
    } else if (!hasCalibrating && pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [cards, demoMode]);

  const updateCardState = React.useCallback((cardId: string, patch: Partial<Card>) => {
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, ...patch } : c)));
  }, []);

  const completeCard = React.useCallback(
    async (cardId: string) => {
      updateCardState(cardId, {
        state: "needs_review",
        completed: true,
      });
    },
    [updateCardState],
  );

  return {
    cards,
    loading,
    error,
    refreshCards: fetchCards,
    updateCardState,
    completeCard,
  };
}

export default useCards;
