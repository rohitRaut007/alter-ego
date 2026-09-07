import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "./supabase";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { callMentorAiServerFn } from "../services/mentor-ai";
import {
  type Book,
  type ChatMessage,
  type Conversation,
  type Habit,
  type Milestone,
  type Note,
  type Task,
} from "./mock-data";

export interface Reflection {
  id: string;
  date: string;
  compounded: string;
  leaked: string;
  tomorrow: string;
  rating: number;
}

export interface PersonalityScores {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

interface PersistedState {
  onboarded: boolean;
  personalityTestCompleted: boolean;
  onboardingAnswers: Record<string, string | string[]>;
  personalityScores: PersonalityScores | null;
  tasks: Task[];
  habits: Habit[];
  books: Book[];
  notes: Note[];
  milestones: Milestone[];
  conversations: Conversation[];
  reflections: Reflection[];
  deepWorkMinutes: number;
  calendarEvents: CalendarEvent[];
  settings: {
    displayName: string;
    email: string;
    memberSince: string;
    alterEgo: string;
    identityStatement: string;
    calendarConnected: boolean;
    calendarAccount: string | null;
    mentorNudges: boolean;
    analyticsOptIn: boolean;
    weeklyDigest: boolean;
    sprintDay: number;
    sprintTotal: number;
  };
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  start?: string;
  end?: string;
  category?: string;
  taskId?: string;
}

const initialState: PersistedState = {
  onboarded: false,
  personalityTestCompleted: false,
  onboardingAnswers: {},
  personalityScores: null,
  tasks: [],
  habits: [],
  books: [],
  notes: [],
  milestones: [],
  conversations: [],
  reflections: [],
  deepWorkMinutes: 0,
  calendarEvents: [],
  settings: {
    displayName: "",
    email: "",
    memberSince: "",
    alterEgo: "The Quiet Architect",
    identityStatement: "I build systems that outlive the mood I was in when I built them.",
    calendarConnected: false,
    calendarAccount: null,
    mentorNudges: true,
    analyticsOptIn: true,
    weeklyDigest: true,
    sprintDay: 1,
    sprintTotal: 90,
  },
};

const defaultProtocolJson = {
  identity: {
    alterEgoName: "The Quiet Architect",
    identityThesis: "I build systems that outlive the mood I was in when I built them.",
    archetype: "Builder / Strategist",
    coreAmbition: "Ship a category-defining AI product.",
    futureSelf: "A sovereign builder.",
    legacyDefinition: "Build an institution that outlives me.",
  },
  character: {
    traits: [
      {
        name: "Focus",
        description: "Protecting four hours a day for high-leverage work.",
        importance: "High",
        level: 74,
      },
      {
        name: "Voice",
        description: "Thinking in public weekly without waiting.",
        importance: "Medium",
        level: 58,
      },
    ],
    practices: [
      {
        traitName: "Focus",
        title: "4 hours of deep work",
        description: "Phone in another room until noon",
      },
      {
        traitName: "Voice",
        title: "Publish or draft 500 words",
        description: "Daily typing session",
      },
    ],
  },
  knowledge: {
    books: [
      { title: "Thinking in Systems", author: "Donella Meadows", why: "Understand feedback loops" },
    ],
  },
  mission: {
    title: "Alter Ego OS Launch",
    description: "Ship MVP and secure 25 core users.",
    strategicThesis: "Direct outreach validates value proposition.",
    milestones: [{ title: "First 25 active users", target: "Q3 2026", horizon: "2_years" }],
  },
  dailyOS: {
    principles: ["Create before consuming", "Protect morning block"],
    tasks: [
      {
        title: "Write narrative for launch",
        detail: "90 mins, no inputs.",
        layer: "mission",
        minutes: 90,
        priority: true,
      },
    ],
  },
  presence: {
    practices: [{ category: "voice", title: "Weekly essay publication" }],
  },
  legacy: {
    milestones: [
      { timeHorizon: "2_years", title: "10,000 paying users", description: "Product-market fit" },
    ],
  },
};

export interface GeneratedTask {
  title: string;
  description: string;
  layer: string;
  priority: boolean;
  estimated_minutes: number;
  recurrence: string;
  block: "morning" | "deep-work" | "evening";
}

// Generate personalized tasks based on onboarding answers
function generateTasksFromAnswers(answers: Record<string, string | string[]>): GeneratedTask[] {
  const tasks: GeneratedTask[] = [];

  const getAnswer = (key: string): string => {
    const val = answers[key];
    if (Array.isArray(val)) return val.join(", ");
    return val || "";
  };

  const identity = getAnswer("q1");
  const sprint90 = getAnswer("q9");
  const trait = getAnswer("q10");
  const idealDay = getAnswer("q11");
  const domain = getAnswer("q2");

  // Identity task
  tasks.push({
    title: "Morning identity read & brief",
    description: `Reinforce your identity as: ${identity || "your alter ego"}. Read your statement aloud before touching any screen.`,
    layer: "identity",
    priority: false,
    estimated_minutes: 10,
    recurrence: "daily",
    block: "morning",
  });

  // Sprint/Mission task
  if (sprint90) {
    tasks.push({
      title: `90-day mission: ${sprint90.slice(0, 60)}`,
      description: "Your primary mission objective. Dedicate a deep work block to advancing this.",
      layer: "mission",
      priority: true,
      estimated_minutes: 90,
      recurrence: "daily",
      block: "deep-work",
    });
  }

  // Character trait practice
  if (trait) {
    tasks.push({
      title: `Practice: ${trait}`,
      description: `Daily practice to build your core trait: ${trait}.`,
      layer: "character",
      priority: false,
      estimated_minutes: 30,
      recurrence: "daily",
      block: "deep-work",
    });
  }

  // Knowledge task based on domain
  if (domain) {
    tasks.push({
      title: `Study: ${domain} reading session`,
      description: "20+ pages or 30 minutes of focused reading in your chosen domain.",
      layer: "knowledge",
      priority: false,
      estimated_minutes: 30,
      recurrence: "daily",
      block: "evening",
    });
  }

  // Daily OS / Ideal day task
  tasks.push({
    title: "End-of-day reflection",
    description: "Three lines: what compounded, what leaked, tomorrow's one thing.",
    layer: "daily-os",
    priority: false,
    estimated_minutes: 10,
    recurrence: "daily",
    block: "evening",
  });

  return tasks;
}

async function compileProtocolClientSide(
  userId: string,
  answers: Record<string, string | string[]>,
) {
  const getAnswer = (key: string): string => {
    const val = answers[key];
    if (Array.isArray(val)) return val.join(", ");
    return val || "";
  };

  const userIdentity = getAnswer("q1") || defaultProtocolJson.identity.alterEgoName;
  const userAmbition = getAnswer("q9") || defaultProtocolJson.identity.coreAmbition;
  const userTrait = getAnswer("q10") || "Focus";

  // Build personalized protocol JSON
  const personalizedProtocol = {
    ...defaultProtocolJson,
    identity: {
      ...defaultProtocolJson.identity,
      alterEgoName: userIdentity.length > 5 ? userIdentity : defaultProtocolJson.identity.alterEgoName,
      coreAmbition: userAmbition || defaultProtocolJson.identity.coreAmbition,
    },
  };

  // 1. Insert protocol record
  const { data: protoRecord, error: protoErr } = await supabase
    .from("protocols")
    .insert({
      user_id: userId,
      status: "active",
      identity_summary: personalizedProtocol.identity.identityThesis,
      character_summary: JSON.stringify(personalizedProtocol.character.traits),
      knowledge_summary: JSON.stringify(personalizedProtocol.knowledge.books),
      mission_summary: personalizedProtocol.mission.title,
      daily_os_summary: JSON.stringify(personalizedProtocol.dailyOS.principles),
      presence_summary: JSON.stringify(personalizedProtocol.presence.practices),
      legacy_summary: JSON.stringify(personalizedProtocol.legacy.milestones),
      generated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (protoErr) throw protoErr;

  // 2. Clean up existing records
  await supabase.from("identity_profiles").delete().eq("user_id", userId);
  await supabase.from("character_traits").delete().eq("user_id", userId);
  await supabase.from("knowledge_items").delete().eq("user_id", userId);
  await supabase.from("milestones").delete().eq("user_id", userId);
  await supabase.from("legacy_milestones").delete().eq("user_id", userId);
  await supabase.from("daily_tasks").delete().eq("user_id", userId);
  await supabase.from("missions").delete().eq("user_id", userId);

  // 3. Create identity profile
  await supabase.from("identity_profiles").insert({
    user_id: userId,
    protocol_id: protoRecord.id,
    alter_ego_name: personalizedProtocol.identity.alterEgoName,
    identity_thesis: personalizedProtocol.identity.identityThesis,
    archetype: personalizedProtocol.identity.archetype,
    core_ambition: personalizedProtocol.identity.coreAmbition,
    future_self: personalizedProtocol.identity.futureSelf,
    legacy_definition: personalizedProtocol.identity.legacyDefinition,
  });

  // 4. Create character traits
  for (const t of personalizedProtocol.character.traits) {
    const { data: traitRecord, error: traitErr } = await supabase
      .from("character_traits")
      .insert({
        user_id: userId,
        name: t.name,
        description: t.description,
        importance: t.importance,
        current_level: t.level,
      })
      .select()
      .single();

    if (traitErr) continue;

    const practicesForTrait = personalizedProtocol.character.practices.filter(
      (p: { traitName: string }) => p.traitName === t.name,
    );
    for (const p of practicesForTrait) {
      await supabase.from("character_practices").insert({
        user_id: userId,
        trait_id: traitRecord.id,
        title: p.title,
        description: p.description,
        scheduled_date: new Date().toISOString().split("T")[0],
      });
    }
  }

  // 5. Create knowledge items
  for (const b of personalizedProtocol.knowledge.books) {
    await supabase.from("knowledge_items").insert({
      user_id: userId,
      type: "book",
      title: b.title,
      author: b.author,
      description: b.why,
      status: "active",
    });
  }

  // 6. Create missions
  const { data: missionRecord, error: missionErr } = await supabase
    .from("missions")
    .insert({
      user_id: userId,
      title: personalizedProtocol.mission.title,
      description: personalizedProtocol.mission.description,
      strategic_thesis: personalizedProtocol.mission.strategicThesis,
      status: "active",
    })
    .select()
    .single();

  if (!missionErr && missionRecord) {
    for (const m of personalizedProtocol.mission.milestones) {
      await supabase.from("milestones").insert({
        user_id: userId,
        mission_id: missionRecord.id,
        title: m.title,
        target_date: new Date().toISOString().split("T")[0],
        status: "pending",
      });
    }
  }

  // 7. Create legacy milestones
  for (const lm of personalizedProtocol.legacy.milestones) {
    await supabase.from("legacy_milestones").insert({
      user_id: userId,
      time_horizon: lm.timeHorizon,
      title: lm.title,
      description: lm.description,
      status: "pending",
    });
  }

  // 8. Create personalized daily tasks from onboarding answers
  const personalizedTasks = generateTasksFromAnswers(answers);
  const allowedLayers = [
    "identity",
    "character",
    "knowledge",
    "mission",
    "daily-os",
    "presence",
    "legacy",
  ];

  for (const t of personalizedTasks) {
    let taskLayer = t.layer?.toLowerCase().replace("_", "-");
    if (!allowedLayers.includes(taskLayer)) {
      taskLayer = "daily-os";
    }
    await supabase.from("daily_tasks").insert({
      user_id: userId,
      title: t.title,
      description: t.description,
      layer: taskLayer,
      priority: t.priority,
      estimated_minutes: t.estimated_minutes,
      status: "pending",
      block: t.block || "deep-work",
      recurrence: t.recurrence || "daily",
    });
  }

  // 9. Update Profile status + save onboarding answers
  await supabase
    .from("profiles")
    .update({
      onboarding_completed: true,
      protocol_generated: true,
      onboarding_answers: JSON.stringify(answers),
    })
    .eq("user_id", userId);
}

interface AppStateValue extends PersistedState {
  hydrated: boolean;
  user: User | null;
  loading: boolean;
  onboardingStep: number;
  toggleTask: (id: string) => void;
  addTask: (title: string, minutes: number) => void;
  toggleHabit: (id: string) => void;
  addNote: (note: { title: string; source: string; body: string; tags: string[] }) => void;
  updateBookProgress: (id: string, progress: number) => void;
  toggleMilestone: (id: string) => void;
  addMilestone: (m: Omit<Milestone, "id" | "done" | "progress">) => void;
  sendMentorMessage: (
    conversationId: string | null,
    content: string,
  ) => Promise<{ reply: string; conversationId: string }>;
  startConversation: () => string;
  addDeepWorkMinutes: (minutes: number) => void;
  saveReflection: (r: Omit<Reflection, "id" | "date">) => void;
  setOnboardingAnswer: (id: string, value: string | string[]) => void;
  completeOnboarding: () => Promise<boolean>;
  savePersonalityScores: (scores: PersonalityScores) => Promise<boolean>;
  resetProtocol: () => void;
  updateSettings: (patch: Partial<PersistedState["settings"]>) => void;
  addCalendarEvent: (event: Omit<CalendarEvent, "id">) => void;
  connectCalendar: (accountEmail: string) => void;
  disconnectCalendar: () => void;
  refreshData: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState(0);

  const fetchAllData = useCallback(async (userId: string) => {
    setLoading(true);
    try {
      // 1. Profile and Settings
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      const { data: identity } = await supabase
        .from("identity_profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      // 2. Tasks
      const { data: tasksData } = await supabase
        .from("daily_tasks")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true });

      // 3. Character Practices (habits)
      const { data: practicesData } = await supabase
        .from("character_practices")
        .select("*")
        .eq("user_id", userId);

      // 4. Knowledge Items (Books)
      const { data: booksData } = await supabase
        .from("knowledge_items")
        .select("*")
        .eq("user_id", userId);

      // 5. Legacy Milestones
      const { data: milestonesData } = await supabase
        .from("legacy_milestones")
        .select("*")
        .eq("user_id", userId);

      // 6. Conversations
      const { data: convData } = await supabase
        .from("mentor_conversations")
        .select("*, mentor_messages(*)")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      // Parse onboarding answers
      let onboardingAnswers: Record<string, string | string[]> = {};
      if (profile?.onboarding_answers) {
        try {
          onboardingAnswers = JSON.parse(profile.onboarding_answers);
        } catch {
          onboardingAnswers = {};
        }
      }

      // Parse personality scores
      let personalityScores: PersonalityScores | null = null;
      if (profile?.personality_scores) {
        try {
          personalityScores =
            typeof profile.personality_scores === "string"
              ? JSON.parse(profile.personality_scores)
              : profile.personality_scores;
        } catch {
          personalityScores = null;
        }
      }

      // Compute sprint day from profile creation
      const createdAt = profile?.created_at ? new Date(profile.created_at) : new Date();
      const today = new Date();
      const daysSinceCreation = Math.max(
        1,
        Math.floor((today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)) + 1,
      );
      const sprintDay = Math.min(daysSinceCreation, 90);

      // Get auth user for email
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      setState((s) => ({
        ...s,
        onboarded: profile?.onboarding_completed ?? false,
        personalityTestCompleted: profile?.personality_test_completed ?? false,
        onboardingAnswers,
        personalityScores,
        settings: {
          displayName:
            profile?.["full_name"] ||
            (authUser?.user_metadata as Record<string, string> | undefined)?.["full_name"] ||
            authUser?.email?.split("@")[0] ||
            "",
          email: authUser?.email || profile?.email || "",
          memberSince: authUser?.created_at
            ? new Date(authUser.created_at).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              })
            : "",
          alterEgo: identity?.alter_ego_name || s.settings.alterEgo,
          identityStatement: identity?.identity_thesis || s.settings.identityStatement,
          calendarConnected: profile?.calendar_connected ?? false,
          calendarAccount: profile?.calendar_account || null,
          mentorNudges: profile?.mentor_nudges ?? true,
          analyticsOptIn: profile?.analytics_opt_in ?? true,
          weeklyDigest: profile?.weekly_digest ?? true,
          sprintDay,
          sprintTotal: 90,
        },
        tasks: (tasksData || []).map((t) => ({
          id: t.id,
          title: t.title,
          detail: t.description || "",
          layer: (t.layer as Task["layer"]) || "daily-os",
          block: t.priority ? "deep-work" : "morning",
          minutes: t.estimated_minutes || 30,
          done: t.status === "completed",
          priority: t.priority || false,
          dueDate: t.due_date || null,
          recurrence: t.recurrence || "once",
        })),
        habits: (practicesData || []).map((p) => ({
          id: p.id,
          name: p.title,
          trait: "Focus",
          cadence: "Daily" as const,
          streak: p.streak_count || 0,
          best: p.best_streak || 5,
          target: 30,
          completedToday: p.completed || false,
          history: Array.isArray(p.history) ? p.history : [p.completed],
        })),
        books: (booksData || []).map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author || "",
          category: b.type || "book",
          progress: b.progress || 0,
          status: (b.status as Book["status"]) || "queued",
          why: b.description || "",
        })),
        milestones: (milestonesData || []).map((m) => {
          let horizon: "2-year" | "5-year" | "lifetime" = "2-year";
          if (m.time_horizon === "2_years") horizon = "2-year";
          else if (m.time_horizon === "5_years") horizon = "5-year";
          else if (m.time_horizon === "legacy") horizon = "lifetime";
          return {
            id: m.id,
            horizon,
            title: m.title,
            detail: m.description || "",
            due: m.target_date || "TBD",
            progress: m.progress || 0,
            done: m.status === "completed",
          };
        }),
        conversations: (convData || []).map((c) => ({
          id: c.id,
          title: c.title,
          updatedAt: new Date(c.updated_at).toLocaleDateString(),
          messages: (c.mentor_messages || [])
            .sort(
              (m1: { created_at: string }, m2: { created_at: string }) =>
                new Date(m1.created_at).getTime() - new Date(m2.created_at).getTime(),
            )
            .map((m: { id: string; role: string; content: string; created_at: string }) => ({
              id: m.id,
              role: m.role === "assistant" ? "mentor" : "user",
              content: m.content,
              at: new Date(m.created_at).toLocaleTimeString(),
            })),
        })),
      }));
    } catch (e) {
      console.error("Error fetching data from Supabase:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        void fetchAllData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        void fetchAllData(session.user.id);
      } else {
        setState(initialState);
        setLoading(false);
      }
    });

    setHydrated(true);
    return () => subscription.unsubscribe();
  }, [fetchAllData]);

  const patch = useCallback(
    (fn: (s: PersistedState) => PersistedState) => setState((s) => fn(s)),
    [],
  );

  const value = useMemo<AppStateValue>(
    () => ({
      ...state,
      hydrated,
      user,
      loading,
      onboardingStep,
      refreshData: () => {
        if (user) void fetchAllData(user.id);
      },
      toggleTask: (id) => {
        const task = state.tasks.find((t) => t.id === id);
        if (!task) return;
        const newStatus = task.done ? "pending" : "completed";

        patch((s) => ({
          ...s,
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        }));

        if (user) {
          supabase
            .from("daily_tasks")
            .update({
              status: newStatus,
              completed_at: newStatus === "completed" ? new Date().toISOString() : null,
            })
            .eq("id", id)
            .then(({ error }) => {
              if (error) {
                toast.error("Failed to update task.");
                patch((s) => ({
                  ...s,
                  tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: task.done } : t)),
                }));
              }
            });
        }
      },
      addTask: (title, minutes) => {
        const id = Math.random().toString(36).slice(2, 10);
        const newTask: Task = {
          id,
          title,
          detail: "Added manually",
          layer: "daily-os",
          block: "deep-work",
          minutes,
          done: false,
          priority: false,
        };

        patch((s) => ({
          ...s,
          tasks: [...s.tasks, newTask],
        }));

        if (user) {
          supabase
            .from("daily_tasks")
            .insert({
              title,
              description: "Added manually",
              layer: "daily-os",
              estimated_minutes: minutes,
              status: "pending",
              user_id: user.id,
            })
            .then(({ error }) => {
              if (error) toast.error("Failed to insert task.");
            });
        }
      },
      toggleHabit: (id) => {
        const habit = state.habits.find((h) => h.id === id);
        if (!habit) return;

        patch((s) => ({
          ...s,
          habits: s.habits.map((hb) =>
            hb.id === id
              ? {
                  ...hb,
                  completedToday: !hb.completedToday,
                  streak: hb.completedToday ? Math.max(0, hb.streak - 1) : hb.streak + 1,
                }
              : hb,
          ),
        }));

        if (user) {
          supabase
            .from("character_practices")
            .update({
              completed: !habit.completedToday,
              completed_at: !habit.completedToday ? new Date().toISOString() : null,
            })
            .eq("id", id)
            .then(({ error }) => {
              if (error) {
                toast.error("Failed to update habit.");
                patch((s) => ({
                  ...s,
                  habits: s.habits.map((hb) =>
                    hb.id === id
                      ? {
                          ...hb,
                          completedToday: habit.completedToday,
                          streak: habit.streak,
                        }
                      : hb,
                  ),
                }));
              }
            });
        }
      },
      addNote: (note) => {
        const id = Math.random().toString(36).slice(2, 10);
        patch((s) => ({
          ...s,
          notes: [{ id, createdAt: "Just now", ...note }, ...s.notes],
        }));
      },
      updateBookProgress: (id, progress) => {
        patch((s) => ({
          ...s,
          books: s.books.map((b) =>
            b.id === id
              ? {
                  ...b,
                  progress,
                  status: progress >= 100 ? "finished" : progress > 0 ? "reading" : "queued",
                }
              : b,
          ),
        }));

        if (user) {
          supabase
            .from("knowledge_items")
            .update({
              progress,
              status: progress >= 100 ? "completed" : progress > 0 ? "active" : "queued",
            })
            .eq("id", id)
            .then(({ error }) => {
              if (error) toast.error("Failed to update reading progress.");
            });
        }
      },
      toggleMilestone: (id) => {
        const milestone = state.milestones.find((m) => m.id === id);
        if (!milestone) return;

        const newDone = !milestone.done;
        const newProgress = newDone ? 100 : 0;

        patch((s) => ({
          ...s,
          milestones: s.milestones.map((m) =>
            m.id === id ? { ...m, done: newDone, progress: newProgress } : m,
          ),
        }));

        if (user) {
          supabase
            .from("legacy_milestones")
            .update({ status: newDone ? "completed" : "pending", progress: newProgress })
            .eq("id", id)
            .then(({ error }) => {
              if (error) {
                toast.error("Failed to update milestone.");
                patch((s) => ({
                  ...s,
                  milestones: s.milestones.map((m) =>
                    m.id === id
                      ? { ...m, done: milestone.done, progress: milestone.progress }
                      : m,
                  ),
                }));
              }
            });
        }
      },
      addMilestone: (m) => {
        const id = Math.random().toString(36).slice(2, 10);
        patch((s) => ({
          ...s,
          milestones: [...s.milestones, { ...m, id, done: false, progress: 0 }],
        }));

        if (user) {
          let timeHorizon = "2_years";
          if (m.horizon === "2-year") timeHorizon = "2_years";
          else if (m.horizon === "5-year") timeHorizon = "5_years";
          else if (m.horizon === "lifetime") timeHorizon = "legacy";

          supabase
            .from("legacy_milestones")
            .insert({
              title: m.title,
              description: m.detail,
              status: "pending",
              progress: 0,
              time_horizon: timeHorizon,
              target_date: m.due,
              user_id: user.id,
            })
            .then(({ error }) => {
              if (error) {
                toast.error("Failed to add milestone.");
                patch((s) => ({
                  ...s,
                  milestones: s.milestones.filter((ms) => ms.id !== id),
                }));
              } else {
                void fetchAllData(user.id);
              }
            });
        }
      },
      startConversation: () => {
        const id = Math.random().toString(36).slice(2, 10);
        patch((s) => ({
          ...s,
          conversations: [
            { id, title: "New conversation", updatedAt: "Just now", messages: [] },
            ...s.conversations,
          ],
        }));
        return id;
      },
      sendMentorMessage: async (conversationId, content) => {
        const text = content.trim();
        if (!text) {
          toast.error("Message cannot be empty.");
          return { reply: "", conversationId: conversationId || "" };
        }

        let targetConvId = conversationId;
        if (!targetConvId) {
          targetConvId = Math.random().toString(36).slice(2, 10);
          patch((s) => ({
            ...s,
            conversations: [
              { id: targetConvId!, title: text.slice(0, 36), updatedAt: "Just now", messages: [] },
              ...s.conversations,
            ],
          }));
        }

        const activeConv = state.conversations.find((c) => c.id === targetConvId);
        const history = (activeConv?.messages || []).map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const userMsgId = Math.random().toString(36).slice(2, 10);
        patch((s) => ({
          ...s,
          conversations: s.conversations.map((c) =>
            c.id === targetConvId
              ? {
                  ...c,
                  title: c.messages.length === 0 ? text.slice(0, 36) : c.title,
                  updatedAt: "Just now",
                  messages: [
                    ...c.messages,
                    {
                      id: userMsgId,
                      role: "user",
                      content: text,
                      at: new Date().toLocaleTimeString(),
                    },
                  ],
                }
              : c,
          ),
        }));

        // Build rich context from real user data
        const getAnswer = (key: string): string => {
          const val = state.onboardingAnswers[key];
          if (Array.isArray(val)) return val.join(", ");
          return val || "";
        };

        const context = {
          displayName: state.settings.displayName,
          identity: {
            alterEgoName: state.settings.alterEgo,
            identityThesis: state.settings.identityStatement,
            archetype: getAnswer("q2") || "Builder / Strategist",
            coreAmbition: getAnswer("q9") || "Ship a category-defining product",
          },
          traits: state.habits.map((h) => ({
            name: h.name,
            level: Math.round((h.streak / Math.max(h.target, 1)) * 100),
            description: h.trait,
          })),
          tasks: state.tasks.map((t) => ({
            title: t.title,
            status: t.done ? "completed" : "pending",
          })),
          personalityScores: state.personalityScores || undefined,
          onboardingAnswers: {
            goal: getAnswer("q1"),
            domain: getAnswer("q2"),
            vision: getAnswer("q3"),
            timeline: getAnswer("q4"),
            currentPosition: getAnswer("q5"),
            strength: getAnswer("q6"),
            learningStyle: getAnswer("q7"),
            fears: getAnswer("q8"),
            sprint90Day: getAnswer("q9"),
            keyTrait: getAnswer("q10"),
            idealDay: getAnswer("q11"),
            frictionPoints: getAnswer("q12"),
            transformation: getAnswer("q13"),
          },
        };

        try {
          const res = await callMentorAiServerFn({
            data: {
              message: text,
              conversationId: targetConvId,
              history,
              context,
            },
          });

          const replyText = res.reply;
          const mentorMsgId = Math.random().toString(36).slice(2, 10);

          patch((s) => ({
            ...s,
            conversations: s.conversations.map((c) =>
              c.id === targetConvId
                ? {
                    ...c,
                    updatedAt: "Just now",
                    messages: [
                      ...c.messages,
                      {
                        id: mentorMsgId,
                        role: "mentor" as const,
                        content: replyText,
                        at: new Date().toLocaleTimeString(),
                      },
                    ],
                  }
                : c,
            ),
          }));

          // Async sync to Supabase
          if (user) {
            void (async () => {
              try {
                let dbConvId = null;
                const uuidRegex =
                  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                if (targetConvId && uuidRegex.test(targetConvId)) {
                  dbConvId = targetConvId;
                } else {
                  const { data: convData } = await supabase
                    .from("mentor_conversations")
                    .insert({ user_id: user.id, title: text.slice(0, 36) })
                    .select("id")
                    .maybeSingle();
                  dbConvId = convData?.id;
                }

                if (dbConvId) {
                  await supabase.from("mentor_messages").insert([
                    { conversation_id: dbConvId, user_id: user.id, role: "user", content: text },
                    {
                      conversation_id: dbConvId,
                      user_id: user.id,
                      role: "assistant",
                      content: replyText,
                    },
                  ]);
                }
              } catch (dbErr) {
                console.warn("[SUPABASE SYNC WARN]", dbErr);
              }
            })();
          }

          return { reply: replyText, conversationId: targetConvId };
        } catch (err: unknown) {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to connect to AI Mentor service.";
          console.error("[MENTOR UI ERROR]", err);
          toast.error(`AI Mentor error: ${errorMessage}`);
          throw err;
        }
      },
      addDeepWorkMinutes: (minutes) => {
        patch((s) => ({ ...s, deepWorkMinutes: s.deepWorkMinutes + minutes }));
      },
      saveReflection: (r) => {
        patch((s) => ({
          ...s,
          reflections: [
            { ...r, id: Math.random().toString(36).slice(2, 10), date: new Date().toDateString() },
            ...s.reflections,
          ],
        }));
      },
      setOnboardingAnswer: (id, val) => {
        patch((s) => ({ ...s, onboardingAnswers: { ...s.onboardingAnswers, [id]: val } }));

        if (user) {
          supabase.functions
            .invoke("onboarding-ai", {
              body: { answer: Array.isArray(val) ? val.join(", ") : val },
            })
            .then(({ data }) => {
              if (data?.step !== undefined) {
                setOnboardingStep(data.step);
              }
            })
            .catch(() => {
              // Silently ignore edge function errors
            });
        }
      },
      completeOnboarding: async () => {
        const answers = state.onboardingAnswers;
        const localTasks = generateTasksFromAnswers(answers);

        // Always mark onboarded locally and populate generated tasks so user is never stuck
        patch((s) => ({
          ...s,
          onboarded: true,
          tasks:
            localTasks.length > 0
              ? localTasks.map((t, idx) => ({
                  id: `task-gen-${idx}`,
                  title: t.title,
                  detail: t.description,
                  layer: (t.layer?.toLowerCase().replace("_", "-") as any) || "daily-os",
                  block: t.block || "deep-work",
                  minutes: t.estimated_minutes,
                  done: false,
                  priority: t.priority,
                  recurrence: (t.recurrence as any) || "daily",
                }))
              : s.tasks,
        }));

        if (user) {
          try {
            const { error } = await supabase.functions.invoke("generate-protocol");
            if (error) {
              await compileProtocolClientSide(user.id, answers);
            }
            await supabase
              .from("profiles")
              .update({
                onboarding_completed: true,
                protocol_generated: true,
                onboarding_answers: JSON.stringify(answers),
              })
              .eq("user_id", user.id);

            await fetchAllData(user.id);
          } catch (e) {
            console.warn("DB sync warning during onboarding compilation:", e);
          }
        }
        return true;
      },
      savePersonalityScores: async (scores: PersonalityScores) => {
        patch((s) => ({ ...s, personalityScores: scores, personalityTestCompleted: true }));

        if (user) {
          try {
            await supabase
              .from("profiles")
              .update({
                personality_scores: scores,
                personality_test_completed: true,
              })
              .eq("user_id", user.id);
          } catch (error) {
            console.warn("Failed to sync personality scores to DB:", error);
          }
        }
        return true;
      },
      resetProtocol: () => {
        setState(initialState);
      },
      updateSettings: (p) => {
        patch((s) => ({ ...s, settings: { ...s.settings, ...p } }));
        if (user) {
          const updatePayload: Record<string, unknown> = {};
          if (p.displayName !== undefined) updatePayload["full_name"] = p.displayName;
          if (p.mentorNudges !== undefined) updatePayload["mentor_nudges"] = p.mentorNudges;
          if (p.analyticsOptIn !== undefined) updatePayload["analytics_opt_in"] = p.analyticsOptIn;
          if (p.weeklyDigest !== undefined) updatePayload["weekly_digest"] = p.weeklyDigest;

          if (Object.keys(updatePayload).length > 0) {
            supabase
              .from("profiles")
              .update(updatePayload)
              .eq("user_id", user.id)
              .then(({ error }) => {
                if (error) toast.error("Failed to sync profile updates.");
              });
          }
        }
      },
      addCalendarEvent: (event) => {
        const id = Math.random().toString(36).slice(2, 10);
        patch((s) => ({
          ...s,
          calendarEvents: [...s.calendarEvents, { ...event, id }],
        }));
      },
      connectCalendar: (accountEmail: string) => {
        const todayStr = new Date().toISOString().split("T")[0]!;
        const syncedEvents: CalendarEvent[] = [
          {
            id: "gcal-1",
            title: "Morning Identity Brief & Strategy",
            start: "08:30",
            end: "09:00",
            date: todayStr,
            category: "protocol",
          },
          {
            id: "gcal-2",
            title: "90-Min Deep Work Block (Primary Mission)",
            start: "09:30",
            end: "11:00",
            date: todayStr,
            category: "deep-work",
          },
          {
            id: "gcal-3",
            title: "Evening Reflection & Collision Notebook",
            start: "18:00",
            end: "18:30",
            date: todayStr,
            category: "review",
          },
        ];

        patch((s) => ({
          ...s,
          calendarEvents: syncedEvents,
          settings: {
            ...s.settings,
            calendarConnected: true,
            calendarAccount: accountEmail,
          },
        }));
        if (user) {
          supabase
            .from("profiles")
            .update({ calendar_connected: true, calendar_account: accountEmail })
            .eq("user_id", user.id)
            .then(({ error }) => {
              if (error) console.warn("Calendar connect error:", error);
            });
        }
      },
      disconnectCalendar: () => {
        patch((s) => ({
          ...s,
          settings: {
            ...s.settings,
            calendarConnected: false,
            calendarAccount: null,
          },
        }));
        if (user) {
          supabase
            .from("profiles")
            .update({ calendar_connected: false, calendar_account: null })
            .eq("user_id", user.id)
            .then(({ error }) => {
              if (error) console.warn("Calendar disconnect error:", error);
            });
        }
      },
    }),
    [state, hydrated, user, loading, onboardingStep, fetchAllData, patch],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
  return ctx;
}
