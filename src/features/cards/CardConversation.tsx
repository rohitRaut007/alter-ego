import * as React from "react";
import { ArrowRight, CheckCircle2, ShieldAlert, Sparkles, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { QuestionInput } from "./QuestionInput";
import { useLanguage } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { Card, CardStep } from "@/lib/api-types";
import { apiClient } from "@/lib/api-client";
import { mockCardStepsAllInputTypes } from "@/test/fixtures";

export interface CardConversationProps {
  card: Card;
  initialStep?: CardStep;
  onCardComplete: (cardId: string) => void;
  onClose?: () => void;
  onSubmitAnswer?: (
    cardId: string,
    stepNumber: number,
    answer: string | string[],
  ) => Promise<{ accepted: boolean; safety_notice?: string; next_step?: number | null; completed?: boolean }>;
}

const DEFAULT_SAFETY_KEYWORDS = ["burnout", "hopeless", "can't go on", "harm", "giving up", "collapse"];

export function CardConversation({
  card,
  initialStep,
  onCardComplete,
  onClose,
  onSubmitAnswer,
}: CardConversationProps) {
  const { t } = useLanguage();

  const [stepNumber, setStepNumber] = React.useState<number>(initialStep?.step_number || card.current_step || 1);
  const [activeStep, setActiveStep] = React.useState<CardStep | null>(initialStep || null);
  const [loadingStep, setLoadingStep] = React.useState<boolean>(!initialStep);
  const [stepError, setStepError] = React.useState<string | null>(null);

  const [currentAnswer, setCurrentAnswer] = React.useState<string | string[]>("");
  const [acknowledgement, setAcknowledgement] = React.useState<string | null>(null);
  const [safetyNotice, setSafetyNotice] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState<boolean>(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [completed, setCompleted] = React.useState<boolean>(Boolean(card.completed));

  // Fetch step from API if not provided or when stepNumber changes
  const fetchStep = React.useCallback(async (num: number) => {
    setLoadingStep(true);
    setStepError(null);
    try {
      const step = await apiClient.getCardStep(card.id, num);
      setActiveStep(step);
    } catch (err: any) {
      // In demo mode or if fixtures match, fallback to standard mock step if offline
      const stepTypes: Array<"text" | "chips" | "multi_chips" | "options"> = ["text", "chips", "multi_chips", "options"];
      const chosenType = stepTypes[(num - 1) % stepTypes.length] ?? "text";
      const fallback = mockCardStepsAllInputTypes[chosenType];
      if (fallback) {
        setActiveStep({
          ...fallback,
          id: `${card.id}-step-${num}`,
          card_id: card.id,
          step_number: num,
          total_steps: card.total_steps || 4,
        });
      } else {
        setStepError(err?.message || t("step_load_error", "Failed to load question step."));
      }
    } finally {
      setLoadingStep(false);
    }
  }, [card.id, card.total_steps, t]);

  React.useEffect(() => {
    if (!initialStep || initialStep.step_number !== stepNumber) {
      fetchStep(stepNumber);
    }
  }, [stepNumber, fetchStep, initialStep]);

  const totalSteps = activeStep?.total_steps || card.total_steps || 4;
  const progressPct = Math.round((stepNumber / totalSteps) * 100);

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
    setSubmitError(null);

    try {
      const answerVal = isSkip ? "" : currentAnswer;
      let result: { accepted: boolean; safety_notice?: string; next_step?: number | null; completed?: boolean };

      if (onSubmitAnswer) {
        result = await onSubmitAnswer(card.id, stepNumber, answerVal);
      } else {
        result = await apiClient.submitCardAnswer(card.id, stepNumber, answerVal);
      }

      if (result.safety_notice) {
        setSafetyNotice(result.safety_notice);
      }

      // Show step acknowledgement if provided
      if (!isSkip && activeStep.acknowledgement) {
        setAcknowledgement(activeStep.acknowledgement);
        await new Promise((r) => setTimeout(r, 600));
        setAcknowledgement(null);
      }

      if (result.completed || result.next_step === null || stepNumber >= totalSteps) {
        setCompleted(true);
        onCardComplete(card.id);
      } else if (result.next_step) {
        setStepNumber(result.next_step);
        setCurrentAnswer("");
        setSafetyNotice(null);
      } else {
        setStepNumber((prev) => prev + 1);
        setCurrentAnswer("");
        setSafetyNotice(null);
      }
    } catch (err: any) {
      setSubmitError(err?.message || t("card_submit_error", "Failed to submit answer. Please try again."));
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

  if (loadingStep && !activeStep) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-3" role="status">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">{t("loading_step", "Loading step...")}</p>
      </div>
    );
  }

  if (stepError && !activeStep) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-3 text-center" role="alert">
        <AlertCircle className="size-8 text-destructive" />
        <p className="text-sm font-medium text-destructive">{stepError}</p>
        <Button variant="outline" size="sm" onClick={() => fetchStep(stepNumber)}>
          {t("retry", "Retry")}
        </Button>
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
          <span>{t("step", "Step")} {stepNumber} / {totalSteps}</span>
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

      {/* Submit Error */}
      {submitError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <p>{submitError}</p>
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
              <span>{stepNumber >= totalSteps ? t("finish", "Finish") : t("continue", "Continue")}</span>
              <ArrowRight className="size-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default CardConversation;
