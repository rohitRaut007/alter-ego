import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Redirecting — Alter Ego OS" },
    ],
  }),
  component: RedirectToSeed,
});

function RedirectToSeed() {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate({ to: "/seed", replace: true });
  }, [navigate]);

  return (
    <div
      role="status"
      aria-label="Redirecting to seed calibration"
      className="flex min-h-screen items-center justify-center bg-background"
    >
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default RedirectToSeed;
