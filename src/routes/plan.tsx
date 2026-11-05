import { createFileRoute } from "@tanstack/react-router";
import { PlanPage } from "@/features/plan/PlanPage";
import { RequireGoal } from "@/components/RequireGoal";

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [
      { title: "Plan — Alter Ego OS" },
      {
        name: "description",
        content: "Milestone timeline, two-week task horizon, and fallback plans.",
      },
    ],
  }),
  component: () => (
    <RequireGoal>
      <PlanPage />
    </RequireGoal>
  ),
});

