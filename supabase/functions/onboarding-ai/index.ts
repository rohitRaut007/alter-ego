import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ONBOARDING_STAGES = [
  { id: 'q1', stage: 'Ambition', question: "What is the largest thing you want to be true about your life in ten years?" },
  { id: 'q2', stage: 'Position', question: "Where are you right now — honestly? Work, money, health, relationships." },
  { id: 'q3', stage: 'Personality', question: "How would the people closest to you describe your character?" },
  { id: 'q4', stage: 'Fears', question: "What are you most afraid of becoming?" },
  { id: 'q5', stage: 'Goals', question: "What must be true 90 days from now for this to have worked?" },
  { id: 'q6', stage: 'Timeline', question: "What horizon are you building on?" }
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }

    const { sessionId, answer } = await req.json();

    // Check if session exists or create one
    let activeSession;
    if (sessionId) {
      const { data } = await supabase.from('onboarding_sessions').select('*').eq('id', sessionId).single();
      activeSession = data;
    } else {
      const { data: existingSession } = await supabase
        .from('onboarding_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSession) {
        activeSession = existingSession;
      } else {
        const { data } = await supabase.from('onboarding_sessions').insert({
          user_id: user.id,
          status: 'active',
          current_step: 0
        }).select().single();
        activeSession = data;
      }
    }

    const step = activeSession.current_step;

    if (answer && step < ONBOARDING_STAGES.length) {
      const currentStage = ONBOARDING_STAGES[step];
      // Save response
      await supabase.from('onboarding_responses').insert({
        session_id: activeSession.id,
        user_id: user.id,
        layer: 'identity',
        question: currentStage.question,
        answer: answer,
        step_number: step
      });

      // Update session step
      const nextStep = step + 1;
      const completed = nextStep >= ONBOARDING_STAGES.length;
      await supabase.from('onboarding_sessions').update({
        current_step: nextStep,
        status: completed ? 'completed' : 'active',
        completed_at: completed ? new Date() : null
      }).eq('id', activeSession.id);

      activeSession.current_step = nextStep;
    }

    const currentStep = activeSession.current_step;
    if (currentStep < ONBOARDING_STAGES.length) {
      return new Response(JSON.stringify({
        sessionId: activeSession.id,
        step: currentStep,
        question: ONBOARDING_STAGES[currentStep].question,
        stage: ONBOARDING_STAGES[currentStep].stage,
        done: false
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } else {
      return new Response(JSON.stringify({
        sessionId: activeSession.id,
        step: currentStep,
        done: true
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
})
