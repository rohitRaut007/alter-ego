-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    avatar_url TEXT,
    timezone TEXT DEFAULT 'UTC',
    bio TEXT,
    occupation TEXT,
    location TEXT,
    onboarding_completed BOOLEAN DEFAULT false,
    protocol_generated BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. ONBOARDING SESSIONS
CREATE TABLE IF NOT EXISTS public.onboarding_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    current_step INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. ONBOARDING RESPONSES
CREATE TABLE IF NOT EXISTS public.onboarding_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.onboarding_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    layer TEXT CHECK (layer IN ('identity', 'character', 'knowledge', 'mission', 'daily_os', 'presence', 'legacy')),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    step_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. PROTOCOLS
CREATE TABLE IF NOT EXISTS public.protocols (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    version INTEGER DEFAULT 1,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    identity_summary TEXT,
    character_summary TEXT,
    knowledge_summary TEXT,
    mission_summary TEXT,
    daily_os_summary TEXT,
    presence_summary TEXT,
    legacy_summary TEXT,
    ai_model TEXT,
    generated_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. PROTOCOL SECTIONS
CREATE TABLE IF NOT EXISTS public.protocol_sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    protocol_id UUID NOT NULL REFERENCES public.protocols(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    layer TEXT CHECK (layer IN ('identity', 'character', 'knowledge', 'mission', 'daily_os', 'presence', 'legacy')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. IDENTITY PROFILES
CREATE TABLE IF NOT EXISTS public.identity_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    protocol_id UUID REFERENCES public.protocols(id) ON DELETE SET NULL,
    alter_ego_name TEXT NOT NULL,
    identity_thesis TEXT,
    archetype TEXT,
    core_ambition TEXT,
    future_self TEXT,
    legacy_definition TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. CHARACTER TRAITS
CREATE TABLE IF NOT EXISTS public.character_traits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    importance TEXT,
    current_level INTEGER DEFAULT 50,
    target_level INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. CHARACTER PRACTICES
CREATE TABLE IF NOT EXISTS public.character_practices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trait_id UUID REFERENCES public.character_traits(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    scheduled_date DATE DEFAULT current_date,
    completed BOOLEAN DEFAULT false,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. CHARACTER PROGRESS
CREATE TABLE IF NOT EXISTS public.character_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    trait_id UUID REFERENCES public.character_traits(id) ON DELETE CASCADE,
    date DATE DEFAULT current_date,
    score INTEGER NOT NULL,
    reflection TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 10. KNOWLEDGE ITEMS
CREATE TABLE IF NOT EXISTS public.knowledge_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('book', 'article', 'paper', 'video', 'course', 'note')),
    title TEXT NOT NULL,
    author TEXT,
    url TEXT,
    description TEXT,
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'active', 'completed', 'archived')),
    progress INTEGER DEFAULT 0,
    current_chapter TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 11. KNOWLEDGE REFLECTIONS
CREATE TABLE IF NOT EXISTS public.knowledge_reflections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    knowledge_item_id UUID NOT NULL REFERENCES public.knowledge_items(id) ON DELETE CASCADE,
    reflection_type TEXT CHECK (reflection_type IN ('destruction_test', 'collision', 'weekly_intelligence', 'general')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 12. KNOWLEDGE CONNECTIONS
CREATE TABLE IF NOT EXISTS public.knowledge_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    source_item_id UUID NOT NULL REFERENCES public.knowledge_items(id) ON DELETE CASCADE,
    target_item_id UUID NOT NULL REFERENCES public.knowledge_items(id) ON DELETE CASCADE,
    relationship TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 13. MISSIONS
CREATE TABLE IF NOT EXISTS public.missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    strategic_thesis TEXT,
    status TEXT DEFAULT 'active',
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 14. OBJECTIVES
CREATE TABLE IF NOT EXISTS public.objectives (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    priority INTEGER DEFAULT 1,
    progress INTEGER DEFAULT 0,
    deadline DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 15. MILESTONES
CREATE TABLE IF NOT EXISTS public.milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID REFERENCES public.missions(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    target_date DATE,
    status TEXT DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 16. SPRINTS
CREATE TABLE IF NOT EXISTS public.sprints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'active',
    completion_percentage INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 17. SPRINT GOALS
CREATE TABLE IF NOT EXISTS public.sprint_goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sprint_id UUID NOT NULL REFERENCES public.sprints(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    priority INTEGER DEFAULT 1,
    status TEXT DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 18. DAILY TASKS
CREATE TABLE IF NOT EXISTS public.daily_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    layer TEXT CHECK (layer IN ('identity', 'character', 'knowledge', 'mission', 'daily-os', 'presence', 'legacy')),
    priority BOOLEAN DEFAULT false,
    scheduled_date DATE DEFAULT current_date,
    start_time TIME WITHOUT TIME ZONE,
    end_time TIME WITHOUT TIME ZONE,
    estimated_minutes INTEGER DEFAULT 30,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 19. DAILY BLOCKS
CREATE TABLE IF NOT EXISTS public.daily_blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    block_type TEXT CHECK (block_type IN ('deep_work', 'exercise', 'learning', 'meeting', 'recovery', 'reflection', 'other')),
    start_time TIME WITHOUT TIME ZONE NOT NULL,
    end_time TIME WITHOUT TIME ZONE NOT NULL,
    date DATE DEFAULT current_date,
    task_id UUID REFERENCES public.daily_tasks(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 20. FOCUS SESSIONS
CREATE TABLE IF NOT EXISTS public.focus_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_id UUID REFERENCES public.daily_tasks(id) ON DELETE SET NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    planned_minutes INTEGER,
    actual_minutes INTEGER,
    status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'abandoned', 'interrupted')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 21. PRESENCE PRACTICES
CREATE TABLE IF NOT EXISTS public.presence_practices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT CHECK (category IN ('voice', 'physical_presence', 'wardrobe', 'manners', 'social_dynamics')),
    title TEXT NOT NULL,
    description TEXT,
    scheduled_date DATE DEFAULT current_date,
    completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 22. PRESENCE ASSESSMENTS
CREATE TABLE IF NOT EXISTS public.presence_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category TEXT CHECK (category IN ('voice', 'physical_presence', 'wardrobe', 'manners', 'social_dynamics')),
    score INTEGER CHECK (score BETWEEN 0 AND 100),
    notes TEXT,
    assessment_date DATE DEFAULT current_date,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 23. LEGACY MILESTONES
CREATE TABLE IF NOT EXISTS public.legacy_milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    time_horizon TEXT CHECK (time_horizon IN ('today', '2_years', '5_years', 'legacy')),
    title TEXT NOT NULL,
    description TEXT,
    what_must_be_true TEXT,
    target_date TEXT,
    progress INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 24. CALENDAR EVENTS
CREATE TABLE IF NOT EXISTS public.calendar_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    event_type TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    date DATE NOT NULL,
    external_provider TEXT,
    external_event_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 25. MONTHLY REVIEWS
CREATE TABLE IF NOT EXISTS public.monthly_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    what_worked TEXT,
    what_failed TEXT,
    what_changed TEXT,
    what_next TEXT,
    ai_summary TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE (user_id, month, year)
);

-- 26. MENTOR CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.mentor_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 27. MENTOR MESSAGES
CREATE TABLE IF NOT EXISTS public.mentor_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.mentor_conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 28. AI MEMORIES
CREATE TABLE IF NOT EXISTS public.ai_memories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    memory_type TEXT CHECK (memory_type IN ('identity', 'goal', 'belief', 'preference', 'behavior', 'pattern', 'contradiction', 'achievement', 'failure', 'lesson', 'relationship', 'mission')),
    content TEXT NOT NULL,
    importance INTEGER DEFAULT 1,
    source TEXT,
    -- Embedding vector defined if pgvector loaded. We placeholder it for compatibility or use raw text if pgvector not yet loaded.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger for updating timestamps automatically
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to profiles, onboarding_sessions, onboarding_responses, protocols, protocol_sections, identity_profiles, character_traits, knowledge_items, missions, objectives, milestones, sprints, sprint_goals, daily_tasks, daily_blocks, presence_practices, legacy_milestones, calendar_events, monthly_reviews, mentor_conversations, ai_memories.
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_onboarding_sessions_updated_at BEFORE UPDATE ON public.onboarding_sessions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_onboarding_responses_updated_at BEFORE UPDATE ON public.onboarding_responses FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_protocols_updated_at BEFORE UPDATE ON public.protocols FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_protocol_sections_updated_at BEFORE UPDATE ON public.protocol_sections FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_identity_profiles_updated_at BEFORE UPDATE ON public.identity_profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_character_traits_updated_at BEFORE UPDATE ON public.character_traits FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_knowledge_items_updated_at BEFORE UPDATE ON public.knowledge_items FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_missions_updated_at BEFORE UPDATE ON public.missions FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_objectives_updated_at BEFORE UPDATE ON public.objectives FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_milestones_updated_at BEFORE UPDATE ON public.milestones FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_sprints_updated_at BEFORE UPDATE ON public.sprints FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_sprint_goals_updated_at BEFORE UPDATE ON public.sprint_goals FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_daily_tasks_updated_at BEFORE UPDATE ON public.daily_tasks FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_daily_blocks_updated_at BEFORE UPDATE ON public.daily_blocks FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_presence_practices_updated_at BEFORE UPDATE ON public.presence_practices FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_legacy_milestones_updated_at BEFORE UPDATE ON public.legacy_milestones FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_calendar_events_updated_at BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_monthly_reviews_updated_at BEFORE UPDATE ON public.monthly_reviews FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_mentor_conversations_updated_at BEFORE UPDATE ON public.mentor_conversations FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER update_ai_memories_updated_at BEFORE UPDATE ON public.ai_memories FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger: Automatically create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_traits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_practices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_reflections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sprint_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence_practices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presence_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legacy_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mentor_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_memories ENABLE ROW LEVEL SECURITY;

-- Add RLS Policies matching auth.uid() = user_id
CREATE POLICY all_own_profiles ON public.profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_onboarding_sessions ON public.onboarding_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_onboarding_responses ON public.onboarding_responses FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_protocols ON public.protocols FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_protocol_sections ON public.protocol_sections FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_identity_profiles ON public.identity_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_character_traits ON public.character_traits FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_character_practices ON public.character_practices FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_character_progress ON public.character_progress FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_knowledge_items ON public.knowledge_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_knowledge_reflections ON public.knowledge_reflections FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_knowledge_connections ON public.knowledge_connections FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_missions ON public.missions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_objectives ON public.objectives FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_milestones ON public.milestones FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_sprints ON public.sprints FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_sprint_goals ON public.sprint_goals FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_daily_tasks ON public.daily_tasks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_daily_blocks ON public.daily_blocks FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_focus_sessions ON public.focus_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_presence_practices ON public.presence_practices FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_presence_assessments ON public.presence_assessments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_legacy_milestones ON public.legacy_milestones FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_calendar_events ON public.calendar_events FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_monthly_reviews ON public.monthly_reviews FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_mentor_conversations ON public.mentor_conversations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_mentor_messages ON public.mentor_messages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY all_own_ai_memories ON public.ai_memories FOR ALL USING (auth.uid() = user_id);

-- Create optimization indexes
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_onboarding_sessions_user_id ON public.onboarding_sessions(user_id);
CREATE INDEX idx_onboarding_responses_session_id ON public.onboarding_responses(session_id);
CREATE INDEX idx_protocols_user_id ON public.protocols(user_id);
CREATE INDEX idx_protocol_sections_protocol_id ON public.protocol_sections(protocol_id);
CREATE INDEX idx_character_traits_user_id ON public.character_traits(user_id);
CREATE INDEX idx_character_practices_user_id_date ON public.character_practices(user_id, scheduled_date);
CREATE INDEX idx_knowledge_items_user_id ON public.knowledge_items(user_id);
CREATE INDEX idx_missions_user_id ON public.missions(user_id);
CREATE INDEX idx_daily_tasks_user_id_date ON public.daily_tasks(user_id, scheduled_date);
CREATE INDEX idx_mentor_conversations_user_id ON public.mentor_conversations(user_id);
CREATE INDEX idx_mentor_messages_conversation_id ON public.mentor_messages(conversation_id);
