import { createClient } from "@supabase/supabase-js";

const env = import.meta.env as Record<string, string | undefined>;

const supabaseUrl = env["VITE_SUPABASE_URL"] || "https://placeholder-url.supabase.co";
const supabaseAnonKey = env["VITE_SUPABASE_ANON_KEY"] || "placeholder-anon-key";

if (!env["VITE_SUPABASE_URL"] || !env["VITE_SUPABASE_ANON_KEY"]) {
  console.warn("Supabase credentials missing. Check your environment variables.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
