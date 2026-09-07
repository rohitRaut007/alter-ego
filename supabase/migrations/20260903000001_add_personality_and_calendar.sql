-- Migration: Add columns needed for personality test, onboarding answers, calendar, and other features

-- Add personality_scores and personality_test_completed to profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS personality_scores JSONB,
  ADD COLUMN IF NOT EXISTS personality_test_completed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_answers TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS calendar_connected BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS calendar_account TEXT,
  ADD COLUMN IF NOT EXISTS mentor_nudges BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS analytics_opt_in BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS weekly_digest BOOLEAN DEFAULT true;

-- Add recurrence and due_date to daily_tasks
ALTER TABLE public.daily_tasks
  ADD COLUMN IF NOT EXISTS recurrence TEXT DEFAULT 'once' CHECK (recurrence IN ('once', 'daily', 'weekly')),
  ADD COLUMN IF NOT EXISTS due_date DATE;

-- Add streak tracking to character_practices
ALTER TABLE public.character_practices
  ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_streak INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '[]'::jsonb;

-- Update handle_new_user to also capture email from Supabase auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, full_name, email)
    VALUES (
        NEW.id, 
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email
    )
    ON CONFLICT (user_id) DO UPDATE
    SET 
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        email = COALESCE(EXCLUDED.email, profiles.email),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
