import * as React from "react";
import { ArrowRight, CheckCircle2, ShieldAlert, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { QuestionInput } from "./QuestionInput";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Card, CardStep } from "@/lib/api-types";
import { mockCardStepsAllInputTypes } from "@/test/fixtures";

export interface CardConversationProps {
  card: Card;
  onCardComplete: (cardId: string) => void;
  onClose?: () => void;
}

const DEFAULT_SAFETY_KEYWORDS = ["burnout", "hopeless", "can't go on", "harm", "giving up", "collapse"];

export function CardConversation({ card, onCardComplete, onClose }: CardConversationProps) {
  const { t } = useLanguage();

  // Load steps for this card or fallback to standard 4-step sequence
  const steps: CardStep[] = React.useMemo(() => {
    return [
      {
        ...mockCardStepsAllInputTypes["text"]!,
        id: `${card.id}-step-1`,
        card_id: card.id,
        step_number: 1,
        total_steps: 4,
      },
      {
        ...mockCardStepsAllInputTypes["chips"]!,
        id: `${card.id}-step-2`,
        card_id: card.id,
        step_number: 2,
        total_steps: 4,
      },
      {
        ...mockCardStepsAllInputTypes["multi_chips"]!,
        id: `${card.id}-step-3`,
        card_id: card.id,
        step_number: 3,
        total_steps: 4,
        optional: true,
      },
      {
        ...mockCardStepsAllInputTypes["options"]!,
        id: `${card.id}-step-4`,
        card_id: card.id,
        step_number: 4,
        total_steps: 4,
      },
    ];
  }, [card]);

  const [currentStepIndex, setCurrentStepIndex] = React.useState<number>(0);
  const [currentAnswer, setCurrentAnswer] = React.useState<string | string[]>("");
  const [acknowledgement, setAcknowledgement] = React.useState<string | null>(null);
  const [safetyNotice, setSafetyNotice] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState<boolean>(false);
  const [completed, setCompleted] = React.useState<boolean>(false);

  const activeStep = steps[currentStepIndex];
  const totalSteps = steps.length;
  const progressPct = Math.round(((currentStepIndex + 1) / totalSteps) * 100);

  // Safety boundary check
  const handleAnswerChange = (val: string | string[]) => {
    setCurrentAnswer(val);

    const stringified = Array.isArray(val) ? val.join(" ") : String(val);
    const lower = stringified.toLowerCase();

    const flagged =
      activeStep?.safety_boundary?.flagged_keywords?.some((kw) => lower.includes(kw)) ||
      DEFAULT_SAFETY_KEYWORDS.some((kw) => lower.includes(kw));

    if (flagged) {
      setSafetyNotice(
        activeStep?.safety_boundary?.notice ||
          t(
            "card_safety_notice",
            "Pacing matters. Alter Ego OS emphasizes sustainable progression and healthy boundaries.",
          ),
      );
    } else {
      setSafetyNotice(null);
    }
  };

  const handleNext = async (isSkip = false) => {
    if (!activeStep) return;
    setSubmitting(true);

    try {
      // Show step acknowledgement if provided
      if (!isSkip && activeStep.acknowledgement) {
        setAcknowledgement(activeStep.acknowledgement);
        await new Promise((r) => setTimeout(r, 700));
        setAcknowledgement(null);
      }

      if (currentStepIndex + 1 < totalSteps) {
        setCurrentStepIndex((prev) => prev + 1);
        setCurrentAnswer("");
        setSafetyNotice(null);
      } else {
        // Complete card
        setCompleted(true);
        onCardComplete(card.id);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center space-y-4">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="size-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-semibold tracking-tight">{card.title} {t("card_completed_suffix", "Completed")}</h3>
          <p className="text-sm text-muted-foreground">
            {t("card_completed_desc", "Your responses have been processed and integrated into your protocol.")}
          </p>
        </div>
        {onClose && (
          <Button onClick={onClose} className="rounded-xl px-6 mt-2">
            {t("done", "Done")}
          </Button>
        )}
      </div>
    );
  }

  if (!activeStep) return null;

  const canProceed = Boolean(
    (Array.isArray(currentAnswer) ? currentAnswer.length > 0 : currentAnswer.trim().length > 0) ||
      activeStep.optional,
  );

  return (
    <div className="flex flex-col h-full space-y-5">
      {/* Progress header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>{card.title}</span>
          <span>{t("step", "Step")} {currentStepIndex + 1} / {totalSteps}</span>
        </div>
        <Progress value={progressPct} className="h-1.5" />
      </div>

      {/* Safety Notice */}
      {safetyNotice && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-800 dark:text-amber-300"
        >
          <ShieldAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold">{t("safety_boundary_alert", "Pacing Boundary:")}</span>
            <p>{safetyNotice}</p>
          </div>
        </div>
      )}

      {/* Acknowledgement flash */}
      {acknowledgement && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs font-medium text-primary rise-in"
        >
          <Sparkles className="size-4 shrink-0" />
          <span>{acknowledgement}</span>
        </div>
      )}

      {/* Question prompt */}
      <div className="space-y-1.5">
        <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-foreground leading-snug">
          {activeStep.question}
        </h2>
      </div>

      {/* Input container */}
      <div className="flex-1 py-1">
        <QuestionInput
          type={activeStep.type}
          options={activeStep.options}
          placeholder={activeStep.placeholder}
          value={currentAnswer}
          onChange={handleAnswerChange}
          disabled={submitting}
        />
      </div>

      {/* Footer controls: Skip (only if optional) and Next */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        {activeStep.optional ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => handleNext(true)}
            disabled={submitting}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {t("skip", "Skip")}
          </Button>
        ) : (
          <div />
        )}

        <Button
          type="button"
          onClick={() => handleNext(false)}
          disabled={!canProceed || submitting}
          className="rounded-xl px-6 h-10 gap-2 font-medium"
        >
          {submitting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <>
              <span>{currentStepIndex + 1 === totalSteps ? t("finish", "Finish") : t("continue", "Continue")}</span>
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default CardConversation;

