-- This seed script provides mock data for a test user during local development.
-- Replace user_id with your test user's UUID if you want to apply it manually.

-- Helper: We'll assume a dummy user with ID '00000000-0000-0000-0000-000000000000' or similar can be used for testing,
-- but typically seeds are applied to a clean DB, or manually associated.
-- In Supabase local development, we can insert into auth.users first if needed,
-- but we will write conditional inserts or insert statements that assume a user exists.
-- For local CLI seeding, supabase/seed.sql can seed auth.users as well.

-- Seed user into auth.users (Supabase Local Development Auth Schema)
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES (
    'd3b07384-d113-4ec5-a58d-71b073c683b5',
    'test@alteregoos.com',
    -- password is 'password123' hashed using bcrypt
    '$2a$10$wzUaE94xX0q6X3pWl6qOieE16s3d1cPyq3P9pP7V1v5m/uK1P7y1C', 
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Arjun Mehta"}',
    now(),
    now()
) ON CONFLICT (id) DO NOTHING;

-- Seed profile (Automatically created by trigger on auth.users, but we update details)
UPDATE public.profiles
SET 
    full_name = 'Arjun Mehta',
    timezone = 'America/New_York',
    bio = 'Builder & Strategist engineering Alter Ego OS',
    occupation = 'Product Builder',
    location = 'New York, NY',
    onboarding_completed = true,
    protocol_generated = true
WHERE user_id = 'd3b07384-d113-4ec5-a58d-71b073c683b5';

-- Seed Protocol
INSERT INTO public.protocols (id, user_id, version, status, identity_summary, character_summary, knowledge_summary, mission_summary, daily_os_summary, presence_summary, legacy_summary, generated_at)
VALUES (
    'f4b07384-d113-4ec5-a58d-71b073c683b6',
    'd3b07384-d113-4ec5-a58d-71b073c683b5',
    1,
    'active',
    'Alter Ego: The Quiet Architect. Builds systems that outlive transient moods.',
    'Focus, Voice, Discipline, Sovereignty, Clarity.',
    'Systems thinking, leverage, and presence roadmap.',
    'Sprint 02: Build in public, ship the core product.',
    '4h deep work block daily. Morning brief + identity check.',
    'Weekly public essay cadence. Physical strength training.',
    'Legacy horizon. Multi-generational institution building.',
    now()
) ON CONFLICT (id) DO NOTHING;

-- Seed Identity Profile
INSERT INTO public.identity_profiles (user_id, protocol_id, alter_ego_name, identity_thesis, archetype, core_ambition, future_self, legacy_definition)
VALUES (
    'd3b07384-d113-4ec5-a58d-71b073c683b5',
    'f4b07384-d113-4ec5-a58d-71b073c683b6',
    'The Quiet Architect',
    'I build systems that outlive the mood I was in when I built them.',
    'Builder / Strategist',
    'Ship a category-defining AI product and become a public thinker on human systems.',
    'A sovereign creator whose distribution and products compound autonomously.',
    'Build an institution that trains builders to engineer themselves.'
) ON CONFLICT (user_id) DO NOTHING;

-- Seed Character Traits
INSERT INTO public.character_traits (id, user_id, name, description, importance, current_level, target_level)
VALUES 
    ('c0000001-d113-4ec5-a58d-71b073c683b7', 'd3b07384-d113-4ec5-a58d-71b073c683b5', 'Focus', 'Protecting four hours a day for high-leverage work only I can do.', 'High', 74, 100),
    ('c0000002-d113-4ec5-a58d-71b073c683b7', 'd3b07384-d113-4ec5-a58d-71b073c683b5', 'Voice', 'Thinking in public weekly without waiting to feel ready.', 'Medium', 58, 90),
    ('c0000003-d113-4ec5-a58d-71b073c683b7', 'd3b07384-d113-4ec5-a58d-71b073c683b5', 'Discipline', 'Actions dictated by the calendar, not short-term emotions.', 'High', 81, 100),
    ('c0000004-d113-4ec5-a58d-71b073c683b7', 'd3b07384-d113-4ec5-a58d-71b073c683b5', 'Sovereignty', 'Creating value before consuming information.', 'High', 46, 85),
    ('c0000005-d113-4ec5-a58d-71b073c683b7', 'd3b07384-d113-4ec5-a58d-71b073c683b5', 'Clarity', 'Evaluating weekly outcomes honestly to adjust execution.', 'Medium', 63, 90)
ON CONFLICT (id) DO NOTHING;

-- Seed Character Practices (Habits)
INSERT INTO public.character_practices (user_id, trait_id, title, description, scheduled_date, completed)
VALUES
    ('d3b07384-d113-4ec5-a58d-71b073c683b5', 'c0000001-d113-4ec5-a58d-71b073c683b7', '4 hours of deep work', 'Tracked daily in 90-minute blocks', current_date, false),
    ('d3b07384-d113-4ec5-a58d-71b073c683b5', 'c0000002-d113-4ec5-a58d-71b073c683b7', 'Publish or draft 500 words', 'No editing during generation phase', current_date, true),
    ('d3b07384-d113-4ec5-a58d-71b073c683b5', 'c0000003-d113-4ec5-a58d-71b073c683b7', 'Strength training session', 'Compound lifts, 45 mins', current_date, true),
    ('d3b07384-d113-4ec5-a58d-71b073c683b5', 'c0000004-d113-4ec5-a58d-71b073c683b7', 'No inputs before output', 'No email, Slack, or socials until 12pm', current_date, false);

-- Seed Knowledge Items
INSERT INTO public.knowledge_items (id, user_id, type, title, author, description, status, progress)
VALUES
    ('k0000001-d113-4ec5-a58d-71b073c683b8', 'd3b07384-d113-4ec5-a58d-71b073c683b5', 'book', 'Thinking in Systems', 'Donella Meadows', 'Understanding feedback loops and leverage points.', 'active', 62),
    ('k0000002-d113-4ec5-a58d-71b073c683b8', 'd3b07384-d113-4ec5-a58d-71b073c683b5', 'book', 'The Almanack of Naval Ravikant', 'Eric Jorgenson', 'Specific knowledge, leverage, and judgment.', 'completed', 100),
    ('k0000003-d113-4ec5-a58d-71b073c683b8', 'd3b07384-d113-4ec5-a58d-71b073c683b5', 'book', 'Impro', 'Keith Johnstone', 'Status, presence, and expressive performance.', 'active', 24)
ON CONFLICT (id) DO NOTHING;

-- Seed Missions
INSERT INTO public.missions (id, user_id, title, description, strategic_thesis, status, priority)
VALUES (
    'm0000001-d113-4ec5-a58d-71b073c683b9',
    'd3b07384-d113-4ec5-a58d-71b073c683b5',
    'Alter Ego OS Alpha Launch',
    'Build and launch the personal transformation operating system to 25 core users.',
    'A premium full-stack system is high value. Validating with 25 active users establishes the feedback loop for expansion.',
    'active',
    1
) ON CONFLICT (id) DO NOTHING;

-- Seed Sprint
INSERT INTO public.sprints (id, user_id, name, description, start_date, end_date, status, completion_percentage)
VALUES (
    's0000001-d113-4ec5-a58d-71b073c683ba',
    'd3b07384-d113-4ec5-a58d-71b073c683b5',
    'Sprint 02 — Build in public, ship the core',
    'Prove the product with 25 real users and publish weekly.',
    current_date - interval '34 days',
    current_date + interval '56 days',
    'active',
    38
) ON CONFLICT (id) DO NOTHING;

-- Seed Sprint Goals / Objectives
INSERT INTO public.sprint_goals (sprint_id, user_id, title, description, priority, status, progress)
VALUES
    ('s0000001-d113-4ec5-a58d-71b073c683ba', 'd3b07384-d113-4ec5-a58d-71b073c683b5', '25 activated users', 'Onboarded and engaging with mentor weekly', 1, 'in_progress', 68),
    ('s0000001-d113-4ec5-a58d-71b073c683ba', 'd3b07384-d113-4ec5-a58d-71b073c683b5', '12 public essays', 'Publish weekly on build in public themes', 2, 'in_progress', 58),
    ('s0000001-d113-4ec5-a58d-71b073c683ba', 'd3b07384-d113-4ec5-a58d-71b073c683b5', '90 deep work hours', 'Logged focus hours in Daily OS', 3, 'in_progress', 67);

-- Seed Daily Tasks
INSERT INTO public.daily_tasks (id, user_id, title, description, layer, priority, scheduled_date, estimated_minutes, status)
VALUES
    ('t0000001-d113-4ec5-a58d-71b073c683bb', 'd3b07384-d113-4ec5-a58d-71b073c683b5', 'Write the core narrative for the launch essay', '90 minutes, no research tabs. Draft ugly, ship clean.', 'mission', true, current_date, 90, 'pending'),
    ('t0000002-d113-4ec5-a58d-71b073c683bb', 'd3b07384-d113-4ec5-a58d-71b073c683b5', 'Morning brief + identity read', 'Read your identity statement aloud before touching a screen.', 'identity', false, current_date, 10, 'completed'),
    ('t0000003-d113-4ec5-a58d-71b073c683bb', 'd3b07384-d113-4ec5-a58d-71b073c683b5', 'Ship onboarding polish to 3 beta users', 'Send personally, ask one question each.', 'mission', false, current_date, 60, 'pending')
ON CONFLICT (id) DO NOTHING;

-- Seed Legacy Milestones
INSERT INTO public.legacy_milestones (user_id, time_horizon, title, description, what_must_be_true, target_date, progress, status)
VALUES
    ('d3b07384-d113-4ec5-a58d-71b073c683b5', '2_years', 'Alter Ego OS at 10,000 paying members', 'Sustainable revenue and product market fit.', 'Robust onboarding & retention logic', 'Q3 2028', 18, 'pending'),
    ('d3b07384-d113-4ec5-a58d-71b073c683b5', '5_years', 'Write the book on personal operating systems', 'Traditional or self-published, 60k words.', 'Compiled notes from hundreds of protocol versions', '2031', 8, 'pending'),
    ('d3b07384-d113-4ec5-a58d-71b073c683b5', 'legacy', 'Build an institution that outlives me', 'A school/fund for personal engineering.', 'Multi-generational trust and cash reserves', 'Lifetime', 5, 'pending');

-- Seed Mentor Conversation
INSERT INTO public.mentor_conversations (id, user_id, title)
VALUES ('v0000001-d113-4ec5-a58d-71b073c683bc', 'd3b07384-d113-4ec5-a58d-71b073c683b5', 'Why the essay keeps slipping')
ON CONFLICT (id) DO NOTHING;

-- Seed Mentor Messages
INSERT INTO public.mentor_messages (conversation_id, user_id, role, content)
VALUES
    ('v0000001-d113-4ec5-a58d-71b073c683bc', 'd3b07384-d113-4ec5-a58d-71b073c683b5', 'user', 'I keep pushing the launch essay. Third week now.'),
    ('v0000001-d113-4ec5-a58d-71b073c683bc', 'd3b07384-d113-4ec5-a58d-71b073c683b5', 'assistant', 'It is not a writing problem. Your Sovereignty trait sits at 46 — you open inputs before you produce output, so the essay never gets your first, sharpest hours. Move it to the 9am block tomorrow and cap it at 90 minutes.');
