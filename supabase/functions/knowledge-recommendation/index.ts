import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const recommendations = [
    {
      title: "The Beginning of Infinity",
      author: "David Deutsch",
      why: "Calibrates legacy layer goals with optimistic, long-horizon epistemics.",
    },
    {
      title: "Working in Public",
      author: "Nadia Eghbal",
      why: "Serves the build-in-public thesis of Sprint 02 directly.",
    },
  ];

  return new Response(JSON.stringify(recommendations), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
