import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    // Insert daily OS tasks
    const { data: insertedTasks } = await supabase
      .from("daily_tasks")
      .insert([
        {
          user_id: user.id,
          title: "Write the core narrative for the launch essay",
          description: "90 minutes, no research tabs. Draft ugly, ship clean.",
          layer: "mission",
          priority: true,
          estimated_minutes: 90,
          status: "pending",
        },
        {
          user_id: user.id,
          title: "Morning brief + identity read",
          description: "Read identity statement aloud.",
          layer: "identity",
          priority: false,
          estimated_minutes: 10,
          status: "completed",
        },
      ])
      .select();

    return new Response(JSON.stringify({ success: true, tasks: insertedTasks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred.";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
