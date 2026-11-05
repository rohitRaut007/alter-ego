import { createFileRoute } from "@tanstack/react-router";
import { SeedPage } from "@/features/seed/SeedPage";

export const Route = createFileRoute("/seed")({
  head: () => ({
    meta: [
      { title: "Seed Calibration — Alter Ego OS" },
      {
        name: "description",
        content:
          "Four-question baseline calibration: define your ambition, horizon, and daily capacity.",
      },
    ],
  }),
  component: SeedPage,
});

