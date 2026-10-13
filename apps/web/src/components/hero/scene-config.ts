export type NodeSpec = {
  id: string;
  label: string;
  detail: string;
  radius: number;
  speed: number;
  inclination: number;
  phase: number;
  size: number;
};

/** The seven protocol layers, orbiting the core at different radii and speeds. */
export const NODES: NodeSpec[] = [
  {
    id: "identity",
    label: "Identity",
    detail: "Who you are becoming",
    radius: 2.4,
    speed: 0.28,
    inclination: 0.18,
    phase: 0,
    size: 0.17,
  },
  {
    id: "character",
    label: "Character",
    detail: "Traits under load",
    radius: 3.0,
    speed: -0.21,
    inclination: -0.34,
    phase: 1.1,
    size: 0.15,
  },
  {
    id: "knowledge",
    label: "Knowledge",
    detail: "Inputs that compound",
    radius: 3.55,
    speed: 0.17,
    inclination: 0.46,
    phase: 2.2,
    size: 0.16,
  },
  {
    id: "strategy",
    label: "Strategy",
    detail: "90-day sprint",
    radius: 4.1,
    speed: -0.13,
    inclination: -0.12,
    phase: 3.4,
    size: 0.14,
  },
  {
    id: "daily",
    label: "Daily OS",
    detail: "Blocks, practices, streaks",
    radius: 4.65,
    speed: 0.11,
    inclination: 0.3,
    phase: 4.5,
    size: 0.15,
  },
  {
    id: "mentor",
    label: "Mentor",
    detail: "Context-aware coaching",
    radius: 5.2,
    speed: -0.085,
    inclination: -0.48,
    phase: 5.3,
    size: 0.13,
  },
  {
    id: "legacy",
    label: "Legacy",
    detail: "The long horizon",
    radius: 5.8,
    speed: 0.06,
    inclination: 0.08,
    phase: 6.1,
    size: 0.13,
  },
];

export const PALETTE = {
  ink: "#2a2723",
  bronze: "#b07a3c",
  bronzeLight: "#e0b481",
  paper: "#faf8f4",
  mist: "#d9d3c8",
};

/** Entrance choreography (seconds) — particles → nodes → links → core → UI. */
export const STAGE = {
  particles: 0.15,
  nodes: 0.9,
  links: 1.5,
  core: 1.05,
  total: 2.6,
};
