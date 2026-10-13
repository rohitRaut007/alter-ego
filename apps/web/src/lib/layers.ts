/** Display metadata for the seven layers (PRD 5.1). Real progress comes from the API. */

export type LayerKey =
  | "identity"
  | "character"
  | "knowledge"
  | "mission"
  | "daily_os"
  | "presence"
  | "legacy";

export interface LayerMeta {
  id: LayerKey;
  index: number;
  name: string;
  tagline: string;
  description: string;
  /** Where "open this layer" goes. Undefined means "work on it with the mentor". */
  to?: string;
}

export const LAYERS: LayerMeta[] = [
  {
    id: "identity",
    index: 1,
    name: "Identity Architecture",
    tagline: "Who you are becoming, written down.",
    description:
      "The root layer. Your alter ego, operating values, non-negotiables and the identity statement every other layer inherits from.",
    to: "/settings",
  },
  {
    id: "character",
    index: 2,
    name: "Character Stack",
    tagline: "Traits engineered through daily practice.",
    description:
      "The traits you are installing, with the specific practices that build them. Character is the compound interest of your protocol.",
    to: "/character",
  },
  {
    id: "knowledge",
    index: 3,
    name: "Knowledge System",
    tagline: "A reading and thinking pipeline, not a to-read pile.",
    description:
      "A sequenced reading list, notes and collisions between ideas, reviewed with your mentor weekly.",
    to: "/knowledge",
  },
  {
    id: "mission",
    index: 4,
    name: "Product / Mission Strategy",
    tagline: "The work that carries your name.",
    description: "Your mission thesis broken into a roadmap, a 90-day sprint and a weekly rhythm.",
    to: "/plan",
  },
  {
    id: "daily_os",
    index: 5,
    name: "Daily Operating System",
    tagline: "The day, engineered.",
    description:
      "Morning brief, deep work blocks, practice completion and an end-of-day reflection loop.",
    to: "/daily",
  },
  {
    id: "presence",
    index: 6,
    name: "Presence Architecture",
    tagline: "How the world experiences you.",
    description:
      "Voice, writing cadence, physicality and reputation surfaces, deliberately designed rather than accidental.",
  },
  {
    id: "legacy",
    index: 7,
    name: "Legacy Timeline",
    tagline: "The 2-year, 5-year and lifetime arc.",
    description:
      "Long-horizon milestones that keep the daily protocol pointed at something that matters.",
    to: "/legacy",
  },
];

export const LAYER_BY_ID = Object.fromEntries(LAYERS.map((l) => [l.id, l])) as Record<
  LayerKey,
  LayerMeta
>;
