import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const reflection = {
    compounded: "Deep work focus hours structured cleanly.",
    leaked: "Digital inputs before writing outputs.",
    tomorrow: "Protect first 90 minutes of the morning for production.",
    rating: 8,
  };

  return new Response(JSON.stringify(reflection), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
