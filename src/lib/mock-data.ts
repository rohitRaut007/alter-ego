/**
 * Mock domain data for Alter Ego OS.
 * Shaped like API responses so a real backend can replace these later
 * without touching component code.
 */

export type LayerId =
  "identity" | "character" | "knowledge" | "mission" | "daily-os" | "presence" | "legacy";

export interface Layer {
  id: LayerId;
  index: number;
  name: string;
  tagline: string;
  description: string;
  progress: number;
  status: "active" | "calibrating" | "locked-in";
  highlights: string[];
}

export interface Task {
  id: string;
  title: string;
  detail: string;
  layer: LayerId;
  block: "morning" | "deep-work" | "evening";
  minutes: number;
  done: boolean;
  priority: boolean;
}

export interface Habit {
  id: string;
  name: string;
  trait: string;
  cadence: "Daily" | "Weekly";
  streak: number;
  best: number;
  target: number;
  completedToday: boolean;
  history: boolean[];
}

export interface Trait {
  id: string;
  name: string;
  statement: string;
  level: number;
  practices: string[];
}

export interface Book {
  id: string;
  title: string;
  author: string;
  category: string;
  progress: number;
  status: "reading" | "queued" | "finished";
  why: string;
}

export interface Note {
  id: string;
  title: string;
  source: string;
  body: string;
  createdAt: string;
  tags: string[];
}

export interface Milestone {
  id: string;
  horizon: "2-year" | "5-year" | "lifetime";
  title: string;
  detail: string;
  due: string;
  progress: number;
  done: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "mentor";
  content: string;
  at: string;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export const profile = {
  name: "Arjun",
  fullName: "Arjun Mehta",
  alterEgo: "The Quiet Architect",
  identityStatement: "I build systems that outlive the mood I was in when I built them.",
  ambition: "Ship a category-defining AI product and become a public thinker on human systems.",
  timeline: "5 years",
  archetype: "Builder / Strategist",
  email: "arjun@alteregoos.com",
  joined: "Feb 2026",
  sprintDay: 34,
  sprintLength: 90,
};

export const sprint = {
  title: "Sprint 02 — Build in public, ship the core",
  focus: "Prove the product with 25 real users and publish weekly.",
  day: 34,
  total: 90,
  keyResults: [
    { id: "kr1", label: "25 activated users", value: 17, target: 25 },
    { id: "kr2", label: "12 public essays", value: 7, target: 12 },
    { id: "kr3", label: "90 deep work hours", value: 61, target: 90 },
  ],
};

export const layers: Layer[] = [
  {
    id: "identity",
    index: 1,
    name: "Identity Architecture",
    tagline: "Who you are becoming, written down.",
    description:
      "The root layer. Your alter ego, operating values, non-negotiables and the identity statement every other layer inherits from.",
    progress: 92,
    status: "locked-in",
    highlights: [
      "Alter ego: The Quiet Architect",
      "3 operating values defined",
      "Identity statement reviewed 12 Aug",
    ],
  },
  {
    id: "character",
    index: 2,
    name: "Character Stack",
    tagline: "Traits engineered through daily practice.",
    description:
      "Five traits with the specific practices that build them. Character is the compound interest of your protocol.",
    progress: 68,
    status: "active",
    highlights: ["5 traits tracked", "Longest streak 41 days", "2 practices behind pace"],
  },
  {
    id: "knowledge",
    index: 3,
    name: "Knowledge System",
    tagline: "A reading and thinking pipeline, not a to-read pile.",
    description:
      "A curated roadmap of books, essays and collisions between them — reviewed and recompiled by your mentor weekly.",
    progress: 54,
    status: "active",
    highlights: ["3 books in flight", "18 notes captured", "Next review Sunday"],
  },
  {
    id: "mission",
    index: 4,
    name: "Product / Mission Strategy",
    tagline: "The work that carries your name.",
    description: "Your mission thesis broken into 90-day sprints, bets and measurable key results.",
    progress: 61,
    status: "active",
    highlights: ["Sprint 02 live", "3 key results", "Day 34 of 90"],
  },
  {
    id: "daily-os",
    index: 5,
    name: "Daily Operating System",
    tagline: "The day, engineered.",
    description:
      "Morning brief, deep work blocks, practice completion and an end-of-day reflection loop.",
    progress: 78,
    status: "active",
    highlights: ["4h deep work target", "22-day adherence streak", "Evening reflection pending"],
  },
  {
    id: "presence",
    index: 6,
    name: "Presence Architecture",
    tagline: "How the world experiences you.",
    description:
      "Voice, writing cadence, physicality and reputation surfaces — deliberately designed rather than accidental.",
    progress: 43,
    status: "calibrating",
    highlights: ["Weekly essay cadence", "Speaking reps: 3/10", "Visual identity draft"],
  },
  {
    id: "legacy",
    index: 7,
    name: "Legacy Timeline",
    tagline: "The 2-year, 5-year and lifetime arc.",
    description:
      "Long-horizon milestones that keep the daily protocol pointed at something that matters.",
    progress: 35,
    status: "calibrating",
    highlights: ["9 milestones mapped", "Quarterly review 30 Sep", "2 milestones complete"],
  },
];

export const tasks: Task[] = [
  {
    id: "t1",
    title: "Write the core narrative for the launch essay",
    detail: "90 minutes, no research tabs. Draft ugly, ship clean.",
    layer: "mission",
    block: "deep-work",
    minutes: 90,
    done: false,
    priority: true,
  },
  {
    id: "t2",
    title: "Morning brief + identity read",
    detail: "Read your identity statement aloud before touching a screen.",
    layer: "identity",
    block: "morning",
    minutes: 10,
    done: true,
    priority: false,
  },
  {
    id: "t3",
    title: "Ship onboarding polish to 3 beta users",
    detail: "Send personally, ask one question each.",
    layer: "mission",
    block: "deep-work",
    minutes: 60,
    done: false,
    priority: false,
  },
  {
    id: "t4",
    title: "Read 20 pages — Thinking in Systems",
    detail: "Capture one collision note in the notebook.",
    layer: "knowledge",
    block: "evening",
    minutes: 30,
    done: false,
    priority: false,
  },
  {
    id: "t5",
    title: "Strength session — pull day",
    detail: "Presence layer. Non-negotiable.",
    layer: "presence",
    block: "morning",
    minutes: 45,
    done: true,
    priority: false,
  },
  {
    id: "t6",
    title: "End-of-day reflection",
    detail: "Three lines: what compounded, what leaked, tomorrow's one thing.",
    layer: "daily-os",
    block: "evening",
    minutes: 10,
    done: false,
    priority: false,
  },
];

const h = (n: number, gaps: number[] = []) =>
  Array.from({ length: n }, (_, i) => !gaps.includes(i));

export const habits: Habit[] = [
  {
    id: "h1",
    name: "4 hours of deep work",
    trait: "Focus",
    cadence: "Daily",
    streak: 22,
    best: 41,
    target: 30,
    completedToday: false,
    history: h(14, [3, 9]),
  },
  {
    id: "h2",
    name: "Publish or draft 500 words",
    trait: "Voice",
    cadence: "Daily",
    streak: 11,
    best: 19,
    target: 30,
    completedToday: true,
    history: h(14, [1, 6, 7]),
  },
  {
    id: "h3",
    name: "Train — strength or conditioning",
    trait: "Discipline",
    cadence: "Daily",
    streak: 34,
    best: 34,
    target: 60,
    completedToday: true,
    history: h(14, [5]),
  },
  {
    id: "h4",
    name: "No input before output",
    trait: "Sovereignty",
    cadence: "Daily",
    streak: 6,
    best: 15,
    target: 21,
    completedToday: false,
    history: h(14, [2, 4, 8, 11]),
  },
  {
    id: "h5",
    name: "Weekly review + recalibrate",
    trait: "Clarity",
    cadence: "Weekly",
    streak: 5,
    best: 8,
    target: 12,
    completedToday: false,
    history: h(14, [10]),
  },
];

export const traits: Trait[] = [
  {
    id: "tr1",
    name: "Focus",
    statement: "I protect four hours a day for work only I can do.",
    level: 74,
    practices: ["4h deep work block", "Phone in another room until noon"],
  },
  {
    id: "tr2",
    name: "Voice",
    statement: "I think in public, weekly, without waiting to be ready.",
    level: 58,
    practices: ["500 words daily", "One essay published each Friday"],
  },
  {
    id: "tr3",
    name: "Discipline",
    statement: "My mood does not get a vote on my calendar.",
    level: 81,
    practices: ["Train 6x/week", "Same wake time, seven days"],
  },
  {
    id: "tr4",
    name: "Sovereignty",
    statement: "I create before I consume.",
    level: 46,
    practices: ["No input before output", "Weekly digital fast"],
  },
  {
    id: "tr5",
    name: "Clarity",
    statement: "I close every week knowing exactly what moved.",
    level: 63,
    practices: ["Sunday weekly review", "Three-line evening reflection"],
  },
];

export const challenges = [
  {
    id: "c1",
    title: "Publish the essay you keep rewriting",
    detail: "It has been in drafts for 9 days. Ship it before Friday, flaws included.",
    layer: "presence" as LayerId,
    difficulty: "Hard",
  },
  {
    id: "c2",
    title: "One 3-hour block, zero context switches",
    detail: "Your average block is 47 minutes. Triple it once this week.",
    layer: "daily-os" as LayerId,
    difficulty: "Medium",
  },
  {
    id: "c3",
    title: "Call one person you admire",
    detail: "Presence compounds through rooms, not feeds.",
    layer: "presence" as LayerId,
    difficulty: "Light",
  },
];

export const books: Book[] = [
  {
    id: "b1",
    title: "Thinking in Systems",
    author: "Donella Meadows",
    category: "Systems",
    progress: 62,
    status: "reading",
    why: "Your identity layer is a system. Learn to find the leverage points.",
  },
  {
    id: "b2",
    title: "The Almanack of Naval Ravikant",
    author: "Eric Jorgenson",
    category: "Leverage",
    progress: 100,
    status: "finished",
    why: "Foundational for specific knowledge and leverage thinking.",
  },
  {
    id: "b3",
    title: "Impro",
    author: "Keith Johnstone",
    category: "Presence",
    progress: 24,
    status: "reading",
    why: "Status, spontaneity and presence — your weakest layer.",
  },
  {
    id: "b4",
    title: "The Beginning of Infinity",
    author: "David Deutsch",
    category: "Epistemics",
    progress: 0,
    status: "queued",
    why: "Long-horizon optimism to feed your legacy timeline.",
  },
  {
    id: "b5",
    title: "Working in Public",
    author: "Nadia Eghbal",
    category: "Mission",
    progress: 41,
    status: "reading",
    why: "Directly serves Sprint 02's build-in-public thesis.",
  },
];

export const notes: Note[] = [
  {
    id: "n1",
    title: "Leverage points sit where feedback loops live",
    source: "Thinking in Systems",
    body: "Changing a habit is a parameter tweak. Changing identity rewrites the loop. Spend effort at the loop level.",
    createdAt: "2 days ago",
    tags: ["systems", "identity"],
  },
  {
    id: "n2",
    title: "Status is physical before it is verbal",
    source: "Impro",
    body: "Presence is posture, pace and pause. Rehearsing lines is downstream of rehearsing stillness.",
    createdAt: "5 days ago",
    tags: ["presence"],
  },
  {
    id: "n3",
    title: "Collision: public work as a forcing function",
    source: "Working in Public × Almanack",
    body: "Audience is not distribution, it is accountability. Publishing weekly is a discipline practice disguised as marketing.",
    createdAt: "1 week ago",
    tags: ["collision", "mission"],
  },
];

export const milestones: Milestone[] = [
  {
    id: "m1",
    horizon: "2-year",
    title: "Alter Ego OS at 10,000 paying members",
    detail: "Sustainable product revenue with a team of four.",
    due: "Q3 2028",
    progress: 18,
    done: false,
  },
  {
    id: "m2",
    horizon: "2-year",
    title: "Publish 100 essays",
    detail: "A body of public thinking that compounds.",
    due: "Q1 2028",
    progress: 34,
    done: false,
  },
  {
    id: "m3",
    horizon: "2-year",
    title: "Speak at three industry conferences",
    detail: "Presence layer proof-of-work.",
    due: "Q4 2027",
    progress: 33,
    done: false,
  },
  {
    id: "m4",
    horizon: "5-year",
    title: "Write the book on personal operating systems",
    detail: "Traditional or self-published, 60,000 words.",
    due: "2031",
    progress: 8,
    done: false,
  },
  {
    id: "m5",
    horizon: "5-year",
    title: "Financial sovereignty",
    detail: "Work chosen entirely by interest, not necessity.",
    due: "2031",
    progress: 22,
    done: false,
  },
  {
    id: "m6",
    horizon: "lifetime",
    title: "Build an institution that outlives me",
    detail: "A school, studio or fund for people engineering themselves.",
    due: "Lifetime",
    progress: 5,
    done: false,
  },
  {
    id: "m7",
    horizon: "lifetime",
    title: "Mentor 100 builders directly",
    detail: "Pay the protocol forward, one person at a time.",
    due: "Lifetime",
    progress: 12,
    done: false,
  },
  {
    id: "m8",
    horizon: "2-year",
    title: "Leave consulting entirely",
    detail: "Completed March 2026.",
    due: "Q1 2026",
    progress: 100,
    done: true,
  },
  {
    id: "m9",
    horizon: "2-year",
    title: "First 1,000 email subscribers",
    detail: "Completed June 2026.",
    due: "Q2 2026",
    progress: 100,
    done: true,
  },
];

export const weeklyMomentum = [
  { day: "Mon", deepWork: 3.5, practices: 4 },
  { day: "Tue", deepWork: 4.2, practices: 5 },
  { day: "Wed", deepWork: 2.1, practices: 3 },
  { day: "Thu", deepWork: 4.6, practices: 5 },
  { day: "Fri", deepWork: 3.8, practices: 4 },
  { day: "Sat", deepWork: 1.4, practices: 3 },
  { day: "Sun", deepWork: 2.6, practices: 4 },
];

export const morningBrief = {
  headline: "Today is a shipping day, not a planning day.",
  body: "You have one 90-minute block that decides whether Sprint 02 stays on pace. Everything else is optional. Your Sovereignty streak broke twice this week — no input before output.",
  weather: "Day 34 of 90 · 56 days remaining",
};

export const conversationSeed: Conversation[] = [
  {
    id: "conv-1",
    title: "Why the essay keeps slipping",
    updatedAt: "Yesterday",
    messages: [
      {
        id: "cm1",
        role: "user",
        content: "I keep pushing the launch essay. Third week now.",
        at: "Yesterday",
      },
      {
        id: "cm2",
        role: "mentor",
        content:
          "It is not a writing problem. Your Sovereignty trait sits at 46 — you open inputs before you produce output, so the essay never gets your first, sharpest hours. Move it to the 9am block tomorrow and cap it at 90 minutes.",
        at: "Yesterday",
      },
    ],
  },
  {
    id: "conv-2",
    title: "Sprint 02 recalibration",
    updatedAt: "4 days ago",
    messages: [
      {
        id: "cm3",
        role: "user",
        content: "Am I behind on the sprint?",
        at: "4 days ago",
      },
      {
        id: "cm4",
        role: "mentor",
        content:
          "You are at 68% of pace on activated users and ahead on deep work hours. The bottleneck is distribution, not effort. Reallocate one deep work block per week to outreach.",
        at: "4 days ago",
      },
    ],
  },
];

export const suggestedPrompts = [
  "What should I do first today?",
  "Where am I drifting from my identity statement?",
  "Recalibrate my 90-day sprint",
  "Give me a hard challenge for this week",
  "What should I read next and why?",
];

export const onboardingQuestions = [
  {
    id: "q1",
    stage: "Identity",
    question: "What are you trying to become?",
    placeholder: "Describe the identity or figure you are engineering.",
    suggestions: [
      "Category-defining founder",
      "Public thinker & writer",
      "Sovereign builder",
    ],
  },
  {
    id: "q2",
    stage: "Domain",
    question: "What domain does your biggest ambition live in?",
    placeholder: "Technology, art, finance, health, philosophy, etc.",
    suggestions: [
      "Artificial Intelligence & Software",
      "Creative Writing & Media",
      "Finance & Sovereignty",
    ],
  },
  {
    id: "q3",
    stage: "Vision",
    question: "What does your fully achieved version look like?",
    placeholder: "Be specific about your state, output, and lifestyle.",
    suggestions: [
      "Deep focus & daily shipping",
      "Respected authority in my field",
      "Complete creative freedom",
    ],
  },
  {
    id: "q4",
    stage: "Timeline",
    question: "What is your target/date?",
    placeholder: "Specific milestone date or time horizon.",
    suggestions: ["90 days", "2 years", "5 years"],
  },
  {
    id: "q5",
    stage: "Position",
    question: "Where are you right now compared to that goal?",
    placeholder: "Honest appraisal of your current baseline.",
    suggestions: [
      "Building foundation from scratch",
      "Early progress, needs system",
      "Pivoting to higher leverage",
    ],
  },
  {
    id: "q6",
    stage: "Leverage",
    question: "What is your biggest strength/advantage?",
    placeholder: "Your unfair advantage or core talent.",
    suggestions: [
      "Obsessive deep focus",
      "First-principles thinking",
      "High execution speed",
    ],
  },
  {
    id: "q7",
    stage: "Learning",
    question: "How do you actually learn best?",
    placeholder: "Building, reading, mentorship, public feedback.",
    suggestions: [
      "Building in public & shipping",
      "Deep reading & synthesis",
      "Direct trial & error",
    ],
  },
  {
    id: "q8",
    stage: "Fears",
    question: "What do you fear most about this path?",
    placeholder: "Name your root fear or failure mode.",
    suggestions: [
      "Becoming comfortable & average",
      "Drifting without finishing",
      "Wasting potential on noise",
    ],
  },
  {
    id: "q9",
    stage: "Sprint",
    question: "What is the most important thing you need to achieve in the next 90 days?",
    placeholder: "The single non-negotiable metric or deliverable.",
    suggestions: [
      "Launch core product to 25 users",
      "Publish 12 weekly essays",
      "Build 4-hour daily work habit",
    ],
  },
  {
    id: "q10",
    stage: "Character",
    question: "Which trait would change everything if you developed it?",
    placeholder: "Focus, discipline, sovereignty, courage, clarity.",
    suggestions: [
      "Unshakable Focus",
      "Relentless Discipline",
      "Creator Sovereignty",
    ],
  },
  {
    id: "q11",
    stage: "Daily OS",
    question: "What does your ideal day look like?",
    placeholder: "Morning routine, deep work blocks, evening review.",
    suggestions: [
      "4h deep work before noon",
      "Zero distraction morning block",
      "Structured work & evening reflection",
    ],
  },
  {
    id: "q12",
    stage: "Friction",
    question: "What has killed your momentum in the past?",
    placeholder: "Distraction, lack of accountability, changing goals.",
    suggestions: [
      "Context switching & noise",
      "Lack of clear protocol",
      "Inconsistent execution",
    ],
  },
  {
    id: "q13",
    stage: "Transformation",
    question: "If this works for 90 days, what will be different in your life?",
    placeholder: "The tangible proof of transformation.",
    suggestions: [
      "Operating as a sovereign builder",
      "Consistent daily shipping practice",
      "Proof of work & active user base",
    ],
  },
];

export const mentorReplies = [
  "Understood. That defines the root target for your Identity Architecture.",
  "Good. Domain clarity allows us to calibrate your Knowledge System and reading roadmap.",
  "Clear vision. We will translate this state into concrete daily practices.",
  "Target date locked. We will align your 90-day sprint and Legacy Timeline accordingly.",
  "Honest baseline noted. This delta defines where your protocol applies maximum leverage.",
  "Solid advantage. We will build your Character Stack to double down on this strength.",
  "Noted. Your Knowledge pipeline will match this exact learning style.",
  "That fear is useful. We'll turn it into a non-negotiable guardrail in your Daily OS.",
  "Clear 90-day focus. Setting this as the core metric for Sprint 02.",
  "Powerful trait choice. Placing this at the center of your Character Stack.",
  "Ideal day structured. Mapping this directly to your morning brief and deep work blocks.",
  "Friction point identified. We are engineering non-negotiable constraints to prevent this.",
  "Transformation locked. Compiling your full seven-layer protocol now.",
];
