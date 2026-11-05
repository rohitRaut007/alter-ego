import * as React from "react";
import type { Card, CardStep } from "@/lib/api-types";
import { mockCardListEveryState, mockCardStepsAllInputTypes } from "@/test/fixtures";

export function useCards() {
  const [cards, setCards] = React.useState<Card[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchCards = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Simulate real API fetch or Supabase query with fallback to fixtures
      await new Promise((r) => setTimeout(r, 100));
      // Load saved cards from localStorage if available, or initialize from fixtures
      const saved = typeof window !== "undefined" ? localStorage.getItem("alter_ego_cards") : null;
      if (saved) {
        try {
          setCards(JSON.parse(saved));
        } catch {
          setCards(mockCardListEveryState);
        }
      } else {
        setCards(mockCardListEveryState);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load cards. Please retry.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void fetchCards();
  }, [fetchCards]);

  const updateCardState = React.useCallback((cardId: string, patch: Partial<Card>) => {
    setCards((prev) => {
      const updated = prev.map((c) => (c.id === cardId ? { ...c, ...patch } : c));
      if (typeof window !== "undefined") {
        localStorage.setItem("alter_ego_cards", JSON.stringify(updated));
      }
      return updated;
    });
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

