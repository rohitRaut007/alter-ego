import * as React from "react";
import {
  Dialog,
  DialogSheetContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { CardConversation } from "./CardConversation";
import type { Card } from "@/lib/api-types";

export interface CardSheetProps {
  card: Card | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCardComplete: (cardId: string) => void;
}

export function CardSheet({
  card,
  open,
  onOpenChange,
  onCardComplete,
}: CardSheetProps) {
  if (!card) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogSheetContent className="sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>{card.title}</DialogTitle>
          <DialogDescription>{card.description || "Card conversation prompt"}</DialogDescription>
        </DialogHeader>

        <div className="py-2 h-full flex flex-col">
          <CardConversation
            card={card}
            onCardComplete={onCardComplete}
            onClose={() => onOpenChange(false)}
          />
        </div>
      </DialogSheetContent>
    </Dialog>
  );
}

export default CardSheet;

