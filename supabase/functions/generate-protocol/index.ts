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
    const apiKey = Deno.env.get("AI_API_KEY") ?? "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: corsHeaders,
      });
    }
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

    // Load onboarding responses for the latest session
    const { data: latestSession } = await supabase
      .from("onboarding_sessions")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let responsesQuery = supabase.from("onboarding_responses").select("*").eq("user_id", user.id);
    if (latestSession) {
      responsesQuery = responsesQuery.eq("session_id", latestSession.id);
    }
    const { data: responses } = await responsesQuery.order("step_number", { ascending: true });

    if (!responses || responses.length === 0) {
      return new Response(JSON.stringify({ error: "No onboarding responses found" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const formattedResponses = responses
      .map((r) => `Question: ${r.question}\nAnswer: ${r.answer}`)
      .join("\n\n");

    const systemPrompt = `You are the Alter Ego OS Protocol Engine.
Analyze the user's onboarding interview and generate a customized, structured 7-layer Personal Operating System Protocol in JSON format.

Onboarding Responses:
${formattedResponses}

Your output must be strict JSON that parses successfully. Avoid any surrounding markdown tags.

Required JSON Schema structure:
{
  "identity": {
    "alterEgoName": "e.g., The Quiet Architect",
    "identityThesis": "e.g., I build systems that outlive the mood I was in when I built them.",
    "archetype": "e.g., Builder / Strategist",
    "coreAmbition": "e.g., Ship a category-defining AI product.",
    "futureSelf": "e.g., A sovereign builder.",
    "legacyDefinition": "e.g., Build an institution that outlives me."
  },
  "character": {
    "traits": [
      { "name": "Focus", "description": "Description of why Focus is needed.", "importance": "High", "level": 74 },
      { "name": "Voice", "description": "Description of why Voice is needed.", "importance": "Medium", "level": 58 }
    ],
    "practices": [
      { "traitName": "Focus", "title": "4 hours of deep work", "description": "Phone in another room until noon" },
      { "traitName": "Voice", "title": "Publish or draft 500 words", "description": "Write daily" }
    ]
  },
  "knowledge": {
    "books": [
      { "title": "Thinking in Systems", "author": "Donella Meadows", "why": "Understand feedback loops" }
    ]
  },
  "mission": {
    "title": "Launch core product",
    "description": "Ship MVP and get 25 active users.",
    "strategicThesis": "Direct outreach to builders closes the loop.",
    "milestones": [
      { "title": "First paying user", "target": "Q3 2026", "horizon": "2_years" }
    ]
  },
  "dailyOS": {
    "principles": ["Create before consuming", "Protect morning block"],
    "tasks": [
      { "title": "Write narrative for launch", "detail": "90 mins, no inputs.", "layer": "mission", "minutes": 90, "priority": true }
    ]
  },
  "presence": {
    "practices": [
      { "category": "voice", "title": "Weekly essay publication" }
    ]
  },
  "legacy": {
    "milestones": [
      { "timeHorizon": "2_years", "title": "10,000 paying users", "description": "Product-market fit" }
    ]
  }
}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let protocolJson: Record<string, any>;

    if (apiKey) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: "Generate protocol now." },
          ],
        }),
      });
      const data = await res.json();
      protocolJson = JSON.parse(data.choices?.[0]?.message?.content || "{}");
    } else {
      // Fallback dummy json
      protocolJson = {
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
            {
              title: "Thinking in Systems",
              author: "Donella Meadows",
              why: "Understand feedback loops",
            },
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
            {
              timeHorizon: "2_years",
              title: "10,000 paying users",
              description: "Product-market fit",
            },
          ],
        },
      };
    }

    // Insert protocol record
    const { data: protoRecord, error: protoErr } = await supabase
      .from("protocols")
      .insert({
        user_id: user.id,
        status: "active",
        identity_summary: protocolJson.identity.identityThesis,
        character_summary: JSON.stringify(protocolJson.character.traits),
        knowledge_summary: JSON.stringify(protocolJson.knowledge.books),
        mission_summary: protocolJson.mission.title,
        daily_os_summary: JSON.stringify(protocolJson.dailyOS.principles),
        presence_summary: JSON.stringify(protocolJson.presence.practices),
        legacy_summary: JSON.stringify(protocolJson.legacy.milestones),
        generated_at: new Date(),
      })
      .select()
      .single();

    if (protoErr) throw protoErr;

    // Clean up existing records to prevent duplication or unique constraint violations
    await supabase.from("identity_profiles").delete().eq("user_id", user.id);
    await supabase.from("character_traits").delete().eq("user_id", user.id);
    await supabase.from("knowledge_items").delete().eq("user_id", user.id);
    await supabase.from("milestones").delete().eq("user_id", user.id);
    await supabase.from("legacy_milestones").delete().eq("user_id", user.id);
    await supabase.from("daily_tasks").delete().eq("user_id", user.id);
    await supabase.from("missions").delete().eq("user_id", user.id);

    // Create identity profile
    await supabase.from("identity_profiles").insert({
      user_id: user.id,
      protocol_id: protoRecord.id,
      alter_ego_name: protocolJson.identity.alterEgoName,
      identity_thesis: protocolJson.identity.identityThesis,
      archetype: protocolJson.identity.archetype,
      core_ambition: protocolJson.identity.coreAmbition,
      future_self: protocolJson.identity.futureSelf,
      legacy_definition: protocolJson.identity.legacyDefinition,
    });

    // Create character traits
    for (const t of protocolJson.character.traits) {
      const { data: traitRecord } = await supabase
        .from("character_traits")
        .insert({
          user_id: user.id,
          name: t.name,
          description: t.description,
          importance: t.importance,
          current_level: t.level,
        })
        .select()
        .single();

      // practices for this trait
      const practicesForTrait = protocolJson.character.practices.filter(
        (p: { traitName: string }) => p.traitName === t.name,
      );
      for (const p of practicesForTrait) {
        await supabase.from("character_practices").insert({
          user_id: user.id,
          trait_id: traitRecord.id,
          title: p.title,
          description: p.description,
          scheduled_date: new Date().toISOString().split("T")[0],
        });
      }
    }

    // Create knowledge items
    for (const b of protocolJson.knowledge.books) {
      await supabase.from("knowledge_items").insert({
        user_id: user.id,
        type: "book",
        title: b.title,
        author: b.author,
        description: b.why,
        status: "active",
      });
    }

    // Create missions
    const { data: missionRecord } = await supabase
      .from("missions")
      .insert({
        user_id: user.id,
        title: protocolJson.mission.title,
        description: protocolJson.mission.description,
        strategic_thesis: protocolJson.mission.strategicThesis,
        status: "active",
      })
      .select()
      .single();

    // Create milestones
    for (const m of protocolJson.mission.milestones) {
      await supabase.from("milestones").insert({
        user_id: user.id,
        mission_id: missionRecord.id,
        title: m.title,
        target_date: new Date().toISOString().split("T")[0],
        status: "pending",
      });
    }

    // Create legacy milestones
    for (const lm of protocolJson.legacy.milestones) {
      await supabase.from("legacy_milestones").insert({
        user_id: user.id,
        time_horizon: lm.timeHorizon,
        title: lm.title,
        description: lm.description,
        status: "pending",
      });
    }

    // Create daily tasks
    for (const t of protocolJson.dailyOS.tasks) {
      const allowedLayers = [
        "identity",
        "character",
        "knowledge",
        "mission",
        "daily-os",
        "presence",
        "legacy",
      ];
      let taskLayer = t.layer?.toLowerCase().replace("_", "-");
      if (!allowedLayers.includes(taskLayer)) {
        taskLayer = "daily-os";
      }
      await supabase.from("daily_tasks").insert({
        user_id: user.id,
        title: t.title,
        description: t.detail,
        layer: taskLayer,
        priority: t.priority,
        estimated_minutes: t.minutes,
        status: "pending",
      });
    }

    // Update Profile status
    await supabase
      .from("profiles")
      .update({
        onboarding_completed: true,
        protocol_generated: true,
      })
      .eq("user_id", user.id);

    return new Response(JSON.stringify({ success: true, protocol: protocolJson }), {
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
