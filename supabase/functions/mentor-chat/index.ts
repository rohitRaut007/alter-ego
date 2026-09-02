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
    const aiProvider = Deno.env.get("AI_PROVIDER") ?? "openai";
    const apiKey = Deno.env.get("AI_API_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Auth token
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { conversationId, message } = await req.json();
    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Retrieve context: Profile, Protocol, daily tasks
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    const { data: identity } = await supabase
      .from("identity_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    const { data: tasks } = await supabase
      .from("daily_tasks")
      .select("*")
      .eq("user_id", user.id)
      .limit(10);
    const { data: traits } = await supabase
      .from("character_traits")
      .select("*")
      .eq("user_id", user.id);

    // Build the system prompt
    const systemPrompt = `You are the AI Mentor for ${profile?.full_name || "the user"}, operating under the Alter Ego: ${identity?.alter_ego_name || "The Architect"}.
Your identity thesis is: "${identity?.identity_thesis || "I build systems."}".
Your archetype is: "${identity?.archetype || "Builder / Strategist"}".
Stated Ambition: "${identity?.core_ambition || "Sovereignty"}".

Traits Focus:
${(traits || []).map((t) => `- ${t.name} (Level ${t.current_level}/100): ${t.description}`).join("\n")}

Daily Tasks:
${(tasks || []).map((t) => `- [${t.status}] ${t.title}`).join("\n")}

Personality Characteristics:
- Demanding executive mentor.
- Calm, strategic, direct, analytical, and honest.
- Do NOT use fluffy motivational statements like "You got this!" or "Keep going!"
- Challenge the user directly on execution gaps, contradiction between their stated ambitions and actual actions.

Provide a concise, sharp recommendation or feedback. Reference their traits or tasks if relevant.`;

    if (!apiKey || apiKey === "your_ai_api_key_here") {
      throw new Error("AI_API_KEY environment variable is missing or unconfigured.");
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
      }),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${errJson.error?.message || res.statusText}`);
    }

    const resJson = await res.json();
    const replyText = resJson.choices?.[0]?.message?.content?.trim();
    if (!replyText) {
      throw new Error("Empty response received from AI model.");
    }

    // Insert user message and mentor reply into db
    let convId = null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (conversationId && uuidRegex.test(conversationId)) {
      const { data: existingConv } = await supabase
        .from("mentor_conversations")
        .select("id")
        .eq("id", conversationId)
        .maybeSingle();
      if (existingConv) {
        convId = existingConv.id;
      }
    }

    if (!convId) {
      const { data: conv, error: convErr } = await supabase
        .from("mentor_conversations")
        .insert({
          user_id: user.id,
          title: message.slice(0, 48),
        })
        .select()
        .single();
      if (convErr) throw convErr;
      convId = conv.id;
    }

    await supabase.from("mentor_messages").insert([
      { conversation_id: convId, user_id: user.id, role: "user", content: message },
      { conversation_id: convId, user_id: user.id, role: "assistant", content: replyText },
    ]);

    return new Response(JSON.stringify({ reply: replyText, conversationId: convId }), {
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
