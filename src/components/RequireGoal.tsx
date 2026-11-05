import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAppState } from "@/lib/app-state";

export interface RequireGoalProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequireGoal({ children, fallback }: RequireGoalProps) {
  const { user, loading, onboarded, onboardingAnswers } = useAppState();
  let routerNavigate: any = null;
  try {
    routerNavigate = useNavigate();
  } catch {
    // Router context optional for testing
  }
  const navigate = routerNavigate || (({ to }: { to: string }) => {});

  // A user has a goal if onboarded is true or they have completed seed answers
  const hasGoal = React.useMemo(() => {
    if (onboarded) return true;
    if (onboardingAnswers && (onboardingAnswers["goal"] || onboardingAnswers["target_statement"] || onboardingAnswers["q1"])) {
      return true;
    }
    return false;
  }, [onboarded, onboardingAnswers]);

  React.useEffect(() => {
    if (loading) return;
    if (!hasGoal) {
      try {
        void navigate({ to: "/seed" });
      } catch {
        // Router navigation optional outside router provider
      }
    }
  }, [hasGoal, loading, navigate]);

  if (loading) {
    return (
      fallback || (
        <div
          role="status"
          aria-label="Checking goal state"
          className="flex min-h-[40vh] items-center justify-center p-8"
        >
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )
    );
  }

  if (!hasGoal) {
    return null;
  }

  return <>{children}</>;
}

export default RequireGoal;

