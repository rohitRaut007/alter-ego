import { createServerFn } from "@tanstack/react-start";
import fs from "node:fs";
import path from "node:path";

export interface MentorChatMessage {
  role: "user" | "mentor" | "assistant" | "system";
  content: string;
}

export interface MentorChatContext {
  displayName?: string;
  identity?: {
    alterEgoName?: string;
    identityThesis?: string;
    archetype?: string;
    coreAmbition?: string;
  };
  traits?: Array<{ name: string; level: number; description?: string }>;
  tasks?: Array<{ title: string; status: string }>;
  personalityScores?: {
    openness?: number;
    conscientiousness?: number;
    extraversion?: number;
    agreeableness?: number;
    neuroticism?: number;
  } | undefined;
  onboardingAnswers?: {
    goal?: string;
    domain?: string;
    vision?: string;
    timeline?: string;
    currentPosition?: string;
    strength?: string;
    learningStyle?: string;
    fears?: string;
    sprint90Day?: string;
    keyTrait?: string;
    idealDay?: string;
    frictionPoints?: string;
    transformation?: string;
  };
}

export interface MentorChatPayload {
  message: string;
  conversationId?: string | null;
  history?: MentorChatMessage[];
  context?: MentorChatContext;
}

function parseEnvFile(filePath: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return result;
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let value = trimmed.slice(eqIdx + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        result[key] = value;
      }
    }
  } catch {
    // ignore read errors
  }
  return result;
}

function getAiConfig() {
  const rootDir = process.cwd();
  const envFile = parseEnvFile(path.join(rootDir, ".env"));
  const envLocalFile = parseEnvFile(path.join(rootDir, ".env.local"));

  const merged: Record<string, string | undefined> = {
    ...(process.env as Record<string, string | undefined>),
    ...envFile,
    ...envLocalFile,
  };

  const apiKey = (
    merged["GROQ_API_KEY"] ||
    merged["VITE_GROQ_API_KEY"] ||
    merged["AI_API_KEY"] ||
    merged["OPENAI_API_KEY"] ||
    merged["GEMINI_API_KEY"] ||
    merged["ANTHROPIC_API_KEY"] ||
    merged["VITE_AI_API_KEY"] ||
    merged["VITE_OPENAI_API_KEY"] ||
    merged["VITE_GEMINI_API_KEY"] ||
    merged["VITE_ANTHROPIC_API_KEY"] ||
    ""
  ).trim();

  let provider = (merged["AI_PROVIDER"] || merged["VITE_AI_PROVIDER"] || "").toLowerCase().trim();
  if (!provider) {
    if (apiKey.startsWith("gsk_") || merged["GROQ_API_KEY"] || merged["VITE_GROQ_API_KEY"]) provider = "groq";
    else if (merged["GEMINI_API_KEY"] || merged["VITE_GEMINI_API_KEY"]) provider = "gemini";
    else if (merged["ANTHROPIC_API_KEY"] || merged["VITE_ANTHROPIC_API_KEY"]) provider = "anthropic";
    else if (merged["OPENAI_API_KEY"] || merged["VITE_OPENAI_API_KEY"]) provider = "openai";
    else provider = apiKey.startsWith("gsk_") ? "groq" : "gemini";
  }

  const isPlaceholder =
    !apiKey ||
    apiKey === "your_ai_api_key_here" ||
    apiKey === "your_openai_api_key_here" ||
    apiKey === "your_api_key_here" ||
    apiKey === "your_gemini_api_key_here" ||
    apiKey === "your_groq_api_key_here";

  return { apiKey, provider, isPlaceholder };
}

function buildPersonalityContext(scores: MentorChatContext["personalityScores"]): string {
  if (!scores) return "";
  const traits = [];
  if (scores.openness !== undefined) {
    traits.push(`Openness ${scores.openness}% (${scores.openness >= 60 ? "high curiosity & creativity" : "practical & focused"})`);
  }
  if (scores.conscientiousness !== undefined) {
    traits.push(`Conscientiousness ${scores.conscientiousness}% (${scores.conscientiousness >= 60 ? "highly organized & disciplined" : "flexible & spontaneous"})`);
  }
  if (scores.extraversion !== undefined) {
    traits.push(`Extraversion ${scores.extraversion}% (${scores.extraversion >= 60 ? "socially energized" : "solitude-powered"})`);
  }
  if (scores.neuroticism !== undefined) {
    traits.push(`Emotional Stability ${scores.neuroticism}% (${scores.neuroticism >= 60 ? "stable under pressure" : "emotionally sensitive"})`);
  }
  return traits.length > 0 ? `\nPersonality Profile:\n${traits.map((t) => `- ${t}`).join("\n")}` : "";
}

function generateDynamicMentorResponse(message: string, context: MentorChatContext): string {
  const lowerMsg = message.toLowerCase();
  const name = context.displayName || "the operator";
  const alterEgo = context.identity?.alterEgoName || "The Quiet Architect";
  const identityThesis =
    context.identity?.identityThesis ||
    "I build systems that outlive the mood I was in when I built them.";
  const priorityTask =
    context.tasks?.find((t) => t.status === "pending")?.title ||
    context.onboardingAnswers?.sprint90Day ||
    "Execute your primary mission objective";
  const topTrait = context.traits?.[0]?.name || "Focus";
  const goal = context.onboardingAnswers?.goal || "your primary goal";
  const fears = context.onboardingAnswers?.fears || "drifting from the protocol";

  if (
    lowerMsg.includes("first today") ||
    lowerMsg.includes("what should i do") ||
    lowerMsg.includes("priority")
  ) {
    return `${name}, as ${alterEgo}, your single highest-leverage action today is: "${priorityTask}".

Do not check inputs or open communication channels until this block is complete. Your ${topTrait} practice requires protecting your prime hours before accepting external demands.

Set a 90-minute timer. Execute without interruption.`;
  }

  if (
    lowerMsg.includes("sprint") ||
    lowerMsg.includes("recalibrate") ||
    lowerMsg.includes("90-day")
  ) {
    return `Recalibrating your 90-day sprint against your stated goal: "${goal}".

Audit your schedule from the past week. Eliminate low-signal work that does not directly advance "${priorityTask}". Schedule a dedicated 90-minute deep work block tomorrow morning and execute without switching contexts.

Your progress metric is output, not effort. Measure by what ships.`;
  }

  if (
    lowerMsg.includes("drifting") ||
    lowerMsg.includes("identity") ||
    lowerMsg.includes("statement")
  ) {
    return `Your identity thesis: "${identityThesis}".

Drift occurs when short-term comfort replaces long-term alignment. Your stated fear — "${fears}" — is already happening if you are asking this question.

Re-anchor: Inspect where you accepted reactive work over proactive execution today. Enforce strict boundaries for the next 72 hours.`;
  }

  if (lowerMsg.includes("personality") || lowerMsg.includes("profile")) {
    const personalityNote = buildPersonalityContext(context.personalityScores);
    return `Your personality profile reveals key leverage points for your protocol:
${personalityNote || "No personality assessment data available yet. Complete the assessment in your dashboard."}

Your AI Mentor calibrates coaching to these scores. High conscientiousness means structure is your advantage — enforce it. High openness means novelty is a risk — protect your focus blocks from idea hopping.`;
  }

  return `Analyzing your query against your identity as ${alterEgo}:

To honor your thesis ("${identityThesis}"), execute "${priorityTask}" as your first block. Strengthen your ${topTrait} practice by tracking daily completion. Eliminate noise that does not advance your primary mission.

Your protocol is already designed. The only variable is execution.`;
}

export const callMentorAiServerFn = createServerFn({ method: "POST" })
  .validator((data: MentorChatPayload) => data)
  .handler(async ({ data }) => {
    const { message, history = [], context = {} } = data;
    const trimmedMessage = message?.trim();

    console.log(`[MENTOR SERVER] Received: "${trimmedMessage?.slice(0, 60)}"`);

    if (!trimmedMessage) {
      throw new Error("Message content cannot be empty.");
    }

    const { apiKey, provider, isPlaceholder } = getAiConfig();

    console.log(`[MENTOR SERVER] Provider: ${provider} | API key present: ${!isPlaceholder}`);

    if (isPlaceholder) {
      console.log("[MENTOR SERVER] No API key — using dynamic contextual fallback.");
      const reply = generateDynamicMentorResponse(trimmedMessage, context);
      return { reply, conversationId: data.conversationId || null };
    }

    // Build rich system prompt from user context
    const personalitySection = buildPersonalityContext(context.personalityScores);
    const onboardingSection = context.onboardingAnswers
      ? `\nUser's Background (from onboarding):\n${Object.entries(context.onboardingAnswers)
          .filter(([, v]) => v)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n")}`
      : "";

    const systemPrompt = `You are the AI Mentor for ${context.displayName || "the user"}, operating as the voice of their alter ego: "${context.identity?.alterEgoName || "The Quiet Architect"}".

Identity Thesis: "${context.identity?.identityThesis || "I build systems that outlive the mood I was in when I built them."}"
Core Ambition: "${context.identity?.coreAmbition || "Ship a category-defining product."}"
${personalitySection}
${onboardingSection}

Character Traits Under Development:
${(context.traits || []).map((t) => `- ${t.name} (${t.level}%): ${t.description || ""}`).join("\n") || "- Focus: Protecting four hours a day for high-leverage work."}

Active Tasks:
${(context.tasks || []).slice(0, 8).map((t) => `- [${t.status}] ${t.title}`).join("\n") || "- [pending] Execute primary mission objective"}

Instructions for your role as AI Mentor:
1. You are a sharp, demanding executive mentor and strategic advisor.
2. Be direct, analytical, concise, and pragmatic — 2 to 4 paragraphs maximum.
3. NEVER use generic filler: no "Keep it up!", "You got this!", "As an AI...", "Understood. Let's..."
4. Address the EXACT question with personalized insight calibrated to this person's alter ego, traits, and active tasks.
5. Always tie advice back to their specific identity thesis, ambition, or current tasks.
6. When relevant, reference their personality profile to explain WHY something is working or not.
7. End with one concrete, immediate action they can take in the next 90 minutes.`;

    let replyText = "";

    try {
      if (provider === "groq" || provider === "openai") {
        const endpoint =
          provider === "groq"
            ? "https://api.groq.com/openai/v1/chat/completions"
            : "https://api.openai.com/v1/chat/completions";
        const model = provider === "groq" ? "groq/compound" : "gpt-4o-mini";

        const formattedHistory = history.map((m) => ({
          role: m.role === "mentor" ? "assistant" : m.role,
          content: m.content,
        }));

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: "system", content: systemPrompt },
              ...formattedHistory,
              { role: "user", content: trimmedMessage },
            ],
            temperature: 0.7,
            max_tokens: 512,
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(`${provider.toUpperCase()} API Error: ${errBody.error?.message || `HTTP ${res.status}`}`);
        }

        const resJson = await res.json();
        replyText = resJson.choices?.[0]?.message?.content?.trim() || "";
      } else if (provider === "gemini" || provider === "google") {
        const geminiHistory = history
          .filter((m) => m.role !== "system")
          .map((m) => ({
            role: m.role === "mentor" || m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          }));

        // Use gemini-2.0-flash for better responses
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [
              ...geminiHistory,
              { role: "user", parts: [{ text: trimmedMessage }] },
            ],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 512,
            },
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const errMsg = errBody.error?.message || `HTTP ${res.status} ${res.statusText}`;
          throw new Error(`Gemini API Error: ${errMsg}`);
        }

        const resJson = await res.json();
        replyText = resJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      } else if (provider === "anthropic" || provider === "claude") {
        const anthropicHistory = history.map((m) => ({
          role: m.role === "mentor" ? "assistant" : "user",
          content: m.content,
        }));

        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 512,
            system: systemPrompt,
            messages: [...anthropicHistory, { role: "user", content: trimmedMessage }],
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(`Anthropic Error: ${errBody.error?.message || `HTTP ${res.status}`}`);
        }

        const resJson = await res.json();
        replyText = resJson.content?.[0]?.text?.trim() || "";
      } else {
        throw new Error(
          `Unsupported AI_PROVIDER "${provider}". Supported: "openai", "gemini", "anthropic".`,
        );
      }

      if (!replyText) {
        throw new Error("AI provider returned an empty response.");
      }

      console.log(`[MENTOR SERVER] Success. Response length: ${replyText.length} chars.`);
      return { reply: replyText, conversationId: data.conversationId || null };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Unknown AI model error";
      console.error(`[MENTOR SERVER FAILURE] ${errMsg}`);
      // Fall back to dynamic response
      const fallbackReply = generateDynamicMentorResponse(trimmedMessage, context);
      return { reply: fallbackReply, conversationId: data.conversationId || null };
    }
  });
