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
import { toast } from "sonner";
import {
  books as seedBooks,
  conversationSeed,
  habits as seedHabits,
  milestones as seedMilestones,
  notes as seedNotes,
  profile as seedProfile,
  tasks as seedTasks,
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

interface PersistedState {
  onboarded: boolean;
  onboardingAnswers: Record<string, string>;
  tasks: Task[];
  habits: Habit[];
  books: Book[];
  notes: Note[];
  milestones: Milestone[];
  conversations: Conversation[];
  reflections: Reflection[];
  deepWorkMinutes: number;
  settings: {
    displayName: string;
    alterEgo: string;
    identityStatement: string;
    calendarConnected: boolean;
    mentorNudges: boolean;
    analyticsOptIn: boolean;
    weeklyDigest: boolean;
  };
}

const initialState: PersistedState = {
  onboarded: false,
  onboardingAnswers: {},
  tasks: seedTasks,
  habits: seedHabits,
  books: seedBooks,
  notes: seedNotes,
  milestones: seedMilestones,
  conversations: conversationSeed,
  reflections: [],
  deepWorkMinutes: 148,
  settings: {
    displayName: seedProfile.fullName,
    alterEgo: seedProfile.alterEgo,
    identityStatement: seedProfile.identityStatement,
    calendarConnected: false,
    mentorNudges: true,
    analyticsOptIn: true,
    weeklyDigest: true,
  },
};

const defaultProtocolJson = {
  identity: {
    alterEgoName: "The Quiet Architect",
    identityThesis: "I build systems that outlive the mood I was in when I built them.",
    archetype: "Builder / Strategist",
    coreAmbition: "Ship a category-defining AI product.",
    futureSelf: "A sovereign builder.",
    legacyDefinition: "Build an institution that outlives me."
  },
  character: {
    traits: [
      { name: "Focus", description: "Protecting four hours a day for high-leverage work.", importance: "High", level: 74 },
      { name: "Voice", description: "Thinking in public weekly without waiting.", importance: "Medium", level: 58 }
    ],
    practices: [
      { traitName: "Focus", title: "4 hours of deep work", description: "Phone in another room until noon" },
      { traitName: "Voice", title: "Publish or draft 500 words", description: "Daily typing session" }
    ]
  },
  knowledge: {
    books: [
      { title: "Thinking in Systems", author: "Donella Meadows", why: "Understand feedback loops" }
    ]
  },
  mission: {
    title: "Alter Ego OS Launch",
    description: "Ship MVP and secure 25 core users.",
    strategicThesis: "Direct outreach validates value proposition.",
    milestones: [
      { title: "First 25 active users", target: "Q3 2026", horizon: "2_years" }
    ]
  },
  dailyOS: {
    principles: ["Create before consuming", "Protect morning block"],
    tasks: [
      { title: "Write narrative for launch", detail: "90 mins, no inputs.", layer: "mission", minutes: 90, priority: true }
    ]
  },
  presence: {
    practices: [
      { category: "voice", title: "Weekly essay publication" }
    ]
  },
  legacy: {
    milestones: [
      { timeHorizon: "2_years", title: "10,000 paying users", description: "Product-market fit" }
    ]
  }
};

async function compileProtocolClientSide(userId: string) {
  // 1. Insert protocol record
  const { data: protoRecord, error: protoErr } = await supabase
    .from('protocols')
    .insert({
      user_id: userId,
      status: 'active',
      identity_summary: defaultProtocolJson.identity.identityThesis,
      character_summary: JSON.stringify(defaultProtocolJson.character.traits),
      knowledge_summary: JSON.stringify(defaultProtocolJson.knowledge.books),
      mission_summary: defaultProtocolJson.mission.title,
      daily_os_summary: JSON.stringify(defaultProtocolJson.dailyOS.principles),
      presence_summary: JSON.stringify(defaultProtocolJson.presence.practices),
      legacy_summary: JSON.stringify(defaultProtocolJson.legacy.milestones),
      generated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (protoErr) throw protoErr;

  // 2. Clean up existing records to prevent duplication or unique constraint violations
  await supabase.from('identity_profiles').delete().eq('user_id', userId);
  await supabase.from('character_traits').delete().eq('user_id', userId);
  await supabase.from('knowledge_items').delete().eq('user_id', userId);
  await supabase.from('milestones').delete().eq('user_id', userId);
  await supabase.from('legacy_milestones').delete().eq('user_id', userId);
  await supabase.from('daily_tasks').delete().eq('user_id', userId);
  await supabase.from('missions').delete().eq('user_id', userId);

  // 3. Create identity profile
  const { error: identityErr } = await supabase.from('identity_profiles').insert({
    user_id: userId,
    protocol_id: protoRecord.id,
    alter_ego_name: defaultProtocolJson.identity.alterEgoName,
    identity_thesis: defaultProtocolJson.identity.identityThesis,
    archetype: defaultProtocolJson.identity.archetype,
    core_ambition: defaultProtocolJson.identity.coreAmbition,
    future_self: defaultProtocolJson.identity.futureSelf,
    legacy_definition: defaultProtocolJson.identity.legacyDefinition
  });
  if (identityErr) throw identityErr;

  // 4. Create character traits and practices
  for (const t of defaultProtocolJson.character.traits) {
    const { data: traitRecord, error: traitErr } = await supabase
      .from('character_traits')
      .insert({
        user_id: userId,
        name: t.name,
        description: t.description,
        importance: t.importance,
        current_level: t.level
      })
      .select()
      .single();

    if (traitErr) throw traitErr;

    const practicesForTrait = defaultProtocolJson.character.practices.filter((p: any) => p.traitName === t.name);
    for (const p of practicesForTrait) {
      await supabase.from('character_practices').insert({
        user_id: userId,
        trait_id: traitRecord.id,
        title: p.title,
        description: p.description,
        scheduled_date: new Date().toISOString().split('T')[0]
      });
    }
  }

  // 5. Create knowledge items
  for (const b of defaultProtocolJson.knowledge.books) {
    await supabase.from('knowledge_items').insert({
      user_id: userId,
      type: 'book',
      title: b.title,
      author: b.author,
      description: b.why,
      status: 'active'
    });
  }

  // 6. Create missions
  const { data: missionRecord, error: missionErr } = await supabase
    .from('missions')
    .insert({
      user_id: userId,
      title: defaultProtocolJson.mission.title,
      description: defaultProtocolJson.mission.description,
      strategic_thesis: defaultProtocolJson.mission.strategicThesis,
      status: 'active'
    })
    .select()
    .single();

  if (missionErr) throw missionErr;

  // 7. Create milestones
  for (const m of defaultProtocolJson.mission.milestones) {
    await supabase.from('milestones').insert({
      user_id: userId,
      mission_id: missionRecord.id,
      title: m.title,
      target_date: new Date().toISOString().split('T')[0],
      status: 'pending'
    });
  }

  // 8. Create legacy milestones
  for (const lm of defaultProtocolJson.legacy.milestones) {
    await supabase.from('legacy_milestones').insert({
      user_id: userId,
      time_horizon: lm.timeHorizon,
      title: lm.title,
      description: lm.description,
      status: 'pending'
    });
  }

  // 9. Create daily tasks
  for (const t of defaultProtocolJson.dailyOS.tasks) {
    const allowedLayers = ['identity', 'character', 'knowledge', 'mission', 'daily-os', 'presence', 'legacy'];
    let taskLayer = t.layer?.toLowerCase().replace('_', '-');
    if (!allowedLayers.includes(taskLayer)) {
      taskLayer = 'daily-os';
    }
    await supabase.from('daily_tasks').insert({
      user_id: userId,
      title: t.title,
      description: t.detail,
      layer: taskLayer,
      priority: t.priority,
      estimated_minutes: t.minutes,
      status: 'pending'
    });
  }

  // 10. Update Profile status
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({
      onboarding_completed: true,
      protocol_generated: true
    })
    .eq('user_id', userId);
  
  if (profileErr) throw profileErr;
}

interface AppStateValue extends PersistedState {
  hydrated: boolean;
  user: any;
  loading: boolean;
  onboardingStep: number;
  toggleTask: (id: string) => void;
  addTask: (title: string, minutes: number) => void;
  toggleHabit: (id: string) => void;
  addNote: (note: { title: string; source: string; body: string; tags: string[] }) => void;
  updateBookProgress: (id: string, progress: number) => void;
  toggleMilestone: (id: string) => void;
  addMilestone: (m: Omit<Milestone, "id" | "done" | "progress">) => void;
  sendMentorMessage: (conversationId: string | null, content: string) => Promise<{ reply: string; conversationId: string }>;
  startConversation: () => string;
  addDeepWorkMinutes: (minutes: number) => void;
  saveReflection: (r: Omit<Reflection, "id" | "date">) => void;
  setOnboardingAnswer: (id: string, value: string) => void;
  completeOnboarding: () => Promise<boolean>;
  resetProtocol: () => void;
  updateSettings: (patch: Partial<PersistedState["settings"]>) => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState(0);

  // Sync state with Supabase when authenticated
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
        .eq("user_id", userId);

      // 3. Character Practices
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
        .eq("user_id", userId);

      setState((s) => ({
        ...s,
        onboarded: profile?.onboarding_completed ?? false,
        settings: {
          displayName: profile?.full_name ?? s.settings.displayName,
          alterEgo: identity?.alter_ego_name ?? s.settings.alterEgo,
          identityStatement: identity?.identity_thesis ?? s.settings.identityStatement,
          calendarConnected: s.settings.calendarConnected,
          mentorNudges: s.settings.mentorNudges,
          analyticsOptIn: s.settings.analyticsOptIn,
          weeklyDigest: s.settings.weeklyDigest,
        },
        tasks: (tasksData || []).map((t) => ({
          id: t.id,
          title: t.title,
          detail: t.description || "",
          layer: (t.layer as any) || "daily-os",
          block: t.priority ? "deep-work" : "morning",
          minutes: t.estimated_minutes || 30,
          done: t.status === "completed",
          priority: t.priority || false,
        })),
        habits: (practicesData || []).map((p) => ({
          id: p.id,
          name: p.title,
          trait: "Focus",
          cadence: "Daily",
          streak: p.completed ? 1 : 0,
          best: 5,
          target: 10,
          completedToday: p.completed || false,
          history: [p.completed],
        })),
        books: (booksData || []).map((b) => ({
          id: b.id,
          title: b.title,
          author: b.author || "",
          category: b.type || "book",
          progress: b.progress || 0,
          status: (b.status as any) || "queued",
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
            .sort((m1: any, m2: any) => new Date(m1.created_at).getTime() - new Date(m2.created_at).getTime())
            .map((m: any) => ({
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
      toggleTask: (id) => {
        const task = state.tasks.find((t) => t.id === id);
        if (!task) return;
        const newStatus = task.done ? "pending" : "completed";
        
        // Optimistic UI update
        patch((s) => ({
          ...s,
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        }));

        if (user) {
          supabase
            .from("daily_tasks")
            .update({ status: newStatus, completed_at: newStatus === "completed" ? new Date().toISOString() : null })
            .eq("id", id)
            .then(({ error }) => {
              if (error) {
                toast.error("Failed to update task.");
                // Rollback
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
            .update({ completed: !habit.completedToday, completed_at: !habit.completedToday ? new Date().toISOString() : null })
            .eq("id", id)
            .then(({ error }) => {
              if (error) {
                toast.error("Failed to update habit.");
                // Rollback
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
        // Note: Saved locally for presentation. Custom knowledge reflection table handles this for books.
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
            .update({ progress, status: progress >= 100 ? "completed" : progress > 0 ? "active" : "queued" })
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
                // Rollback
                patch((s) => ({
                  ...s,
                  milestones: s.milestones.map((m) =>
                    m.id === id ? { ...m, done: milestone.done, progress: milestone.progress } : m,
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
                // Rollback
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
        if (!user) {
          toast.error("Please sign in first.");
          return { reply: "Please log in to speak to the mentor.", conversationId: "" };
        }

        // Call Supabase Edge Function
        try {
          const { data, error } = await supabase.functions.invoke("mentor-chat", {
            body: { conversationId, message: content },
          });

          if (error) throw error;

          // Reload data to grab newly inserted logs
          await fetchAllData(user.id);
          return { reply: data.reply, conversationId: data.conversationId };
        } catch (e: any) {
          console.warn("AI Mentor edge function failed, running client-side fallback...", e);
          try {
            let convId = null;
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (conversationId && uuidRegex.test(conversationId)) {
              const { data: existingConv } = await supabase
                .from('mentor_conversations')
                .select('id')
                .eq('id', conversationId)
                .maybeSingle();
              if (existingConv) {
                convId = existingConv.id;
              }
            }

            if (!convId) {
              const { data: conv, error: convErr } = await supabase
                .from('mentor_conversations')
                .insert({
                  user_id: user.id,
                  title: content.slice(0, 48)
                })
                .select()
                .single();
              if (convErr) throw convErr;
              convId = conv.id;
            }

            const trait = state.habits.length > 0 ? state.habits[0].trait : "Focus";
            const priorityTask = state.tasks.find((t) => t.priority && !t.done) || state.tasks.find((t) => !t.done);
            const taskText = priorityTask ? `Your primary focus must be "${priorityTask.title}".` : "Protect your morning blocks.";
            const replyText = `Understood. Let's protect your ${trait} trait. ${taskText} Minimize inputs before output and keep execution high.`;

            const { error: msgErr } = await supabase.from('mentor_messages').insert([
              { conversation_id: convId, user_id: user.id, role: 'user', content },
              { conversation_id: convId, user_id: user.id, role: 'assistant', content: replyText }
            ]);

            if (msgErr) throw msgErr;

            await fetchAllData(user.id);
            return { reply: replyText, conversationId: convId };
          } catch (fallbackErr: any) {
            console.error("Client-side mentor chat fallback failed:", fallbackErr);
            return { reply: "I encountered a communication timeout. Let's protect your morning block and focus on execution.", conversationId: conversationId || "" };
          }
        }
      },
      addDeepWorkMinutes: (minutes) => {
        patch((s) => ({ ...s, deepWorkMinutes: s.deepWorkMinutes + minutes }));
      },
      saveReflection: (r) => {
        patch((s) => ({
          ...s,
          reflections: [{ ...r, id: Math.random().toString(36).slice(2, 10), date: new Date().toDateString() }, ...s.reflections],
        }));
      },
      setOnboardingAnswer: (id, val) => {
        patch((s) => ({ ...s, onboardingAnswers: { ...s.onboardingAnswers, [id]: val } }));
        
        // Invoke onboarding-ai Edge Function
        if (user) {
          supabase.functions.invoke("onboarding-ai", {
            body: { answer: val },
          }).then(({ data, error }) => {
            if (data?.step !== undefined) {
              setOnboardingStep(data.step);
            }
          });
        }
      },
      completeOnboarding: async () => {
        if (!user) return false;
        try {
          const { data, error } = await supabase.functions.invoke("generate-protocol");
          if (error) {
            console.warn("Edge function failed, running client-side compilation fallback...", error);
            await compileProtocolClientSide(user.id);
          }
          
          patch((s) => ({ ...s, onboarded: true }));
          await fetchAllData(user.id);
          return true;
        } catch (e) {
          console.warn("Edge function invoke error, running client-side compilation fallback...", e);
          try {
            await compileProtocolClientSide(user.id);
            patch((s) => ({ ...s, onboarded: true }));
            await fetchAllData(user.id);
            return true;
          } catch (fallbackErr: any) {
            console.error("Client-side fallback compilation failed:", fallbackErr);
            toast.error("Could not compile protocol, using draft standard.");
            return false;
          }
        }
      },
      resetProtocol: () => {
        setState(initialState);
      },
      updateSettings: (p) => {
        patch((s) => ({ ...s, settings: { ...s.settings, ...p } }));
        if (user) {
          supabase
            .from("profiles")
            .update({ full_name: p.displayName })
            .eq("user_id", user.id)
            .then(({ error }) => {
              if (error) toast.error("Failed to sync profile updates.");
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
