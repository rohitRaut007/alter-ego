import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const analysis = {
    summary:
      "You are ahead of pace on deep work hours, but behind on weekly publishing objectives.",
    wins: ["Completed 61 of 90 planned deep work hours", "Maintained 34-day training streak"],
    problems: ["Avoided publishing launch essay for three consecutive weeks"],
    patterns: ["Opening browser inputs before completing core morning outputs"],
    contradictions: [
      "Values Sovereignty but spends initial 45 minutes of work hours consuming feed content",
    ],
    recommendations: [
      "Move launch essay to 9:00 AM block tomorrow",
      "Keep phone in another room until noon",
    ],
    nextPriority: "Publish launch essay draft before Friday 5:00 PM",
  };

  return new Response(JSON.stringify(analysis), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
