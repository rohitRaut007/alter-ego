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

  const merged: Record<string, string> = {
    ...(process.env as Record<string, string>),
    ...envFile,
    ...envLocalFile,
  };

  const apiKey = (
    merged.AI_API_KEY ||
    merged.OPENAI_API_KEY ||
    merged.GEMINI_API_KEY ||
    merged.ANTHROPIC_API_KEY ||
    merged.VITE_AI_API_KEY ||
    merged.VITE_OPENAI_API_KEY ||
    merged.VITE_GEMINI_API_KEY ||
    merged.VITE_ANTHROPIC_API_KEY ||
    ""
  ).trim();

  let provider = (merged.AI_PROVIDER || merged.VITE_AI_PROVIDER || "").toLowerCase().trim();
  if (!provider) {
    if (merged.GEMINI_API_KEY || merged.VITE_GEMINI_API_KEY) provider = "gemini";
    else if (merged.ANTHROPIC_API_KEY || merged.VITE_ANTHROPIC_API_KEY) provider = "anthropic";
    else provider = "openai";
  }

  const isPlaceholder =
    !apiKey ||
    apiKey === "your_ai_api_key_here" ||
    apiKey === "your_openai_api_key_here" ||
    apiKey === "your_api_key_here";

  return { apiKey, provider, isPlaceholder };
}

function generateDynamicMentorResponse(message: string, context: MentorChatContext): string {
  const lowerMsg = message.toLowerCase();
  const alterEgo = context.identity?.alterEgoName || "The Quiet Architect";
  const identityThesis =
    context.identity?.identityThesis ||
    "I build systems that outlive the mood I was in when I built them.";
  const priorityTask =
    context.tasks?.find((t) => t.status === "pending")?.title || "Write narrative for launch";
  const topTrait = context.traits?.[0]?.name || "Focus";

  if (
    lowerMsg.includes("first today") ||
    lowerMsg.includes("what should i do") ||
    lowerMsg.includes("priority")
  ) {
    return `As ${alterEgo}, your single highest-leverage action today is: "${priorityTask}".

Do not check inputs or open communication channels until this block is complete. Your ${topTrait} practice requires protecting your morning prime hours before accepting external demands.`;
  }

  if (
    lowerMsg.includes("sprint") ||
    lowerMsg.includes("recalibrate") ||
    lowerMsg.includes("90-day")
  ) {
    return `Recalibrating your 90-day sprint: Your core objective remains establishing momentum on "${priorityTask}".

Audit your schedule from the past week. Eliminate low-signal meetings and passive consumption that do not directly advance your primary mission. Schedule a dedicated 90-minute deep work block tomorrow morning and execute without interruption.`;
  }

  if (
    lowerMsg.includes("drifting") ||
    lowerMsg.includes("identity") ||
    lowerMsg.includes("statement")
  ) {
    return `Your identity thesis states: "${identityThesis}".

Drift occurs when short-term comfort replaces long-term alignment. Inspect where you accepted reactive work over proactive execution today. Re-anchor your schedule around your core ambition as ${alterEgo} and enforce strict boundaries.`;
  }

  if (
    lowerMsg.includes("uncomfortable") ||
    lowerMsg.includes("action") ||
    lowerMsg.includes("challenge")
  ) {
    return `Here is your uncomfortable action for today: Take the task you have been procrastinating on—"${priorityTask}"—and execute a complete draft in a single 60-minute block without editing or pausing.

Shipping an imperfect initial draft beats waiting for ideal conditions. Run the protocol.`;
  }

  return `Analyzing your query against your identity architecture as ${alterEgo}:

To honor your thesis ("${identityThesis}"), focus your energy on executing "${priorityTask}" while strengthening your ${topTrait} practice. Eliminate low-signal noise, protect your morning block, and measure progress strictly by tangible output.`;
}

export const callMentorAiServerFn = createServerFn({ method: "POST" })
  .validator((data: MentorChatPayload) => data)
  .handler(async ({ data }) => {
    const { message, history = [], context = {} } = data;
    const trimmedMessage = message?.trim();

    console.log(`[MENTOR SERVER] Received user message: "${trimmedMessage?.slice(0, 60)}"`);

    if (!trimmedMessage) {
      throw new Error("Message content cannot be empty.");
    }

    const { apiKey, provider, isPlaceholder } = getAiConfig();

    console.log(`[MENTOR SERVER] Provider: ${provider} | Real API Key detected: ${!isPlaceholder}`);

    if (isPlaceholder) {
      console.log(
        "[MENTOR SERVER] No active API key found; generating dynamic contextual response.",
      );
      const reply = generateDynamicMentorResponse(trimmedMessage, context);
      return { reply, conversationId: data.conversationId || null };
    }

    const systemPrompt = `You are the AI Mentor for ${context.displayName || "the user"}, operating under the Alter Ego: "${context.identity?.alterEgoName || "The Quiet Architect"}".
Identity Thesis: "${context.identity?.identityThesis || "I build systems that outlive the mood I was in when I built them."}".
Archetype: "${context.identity?.archetype || "Builder / Strategist"}".
Core Ambition: "${context.identity?.coreAmbition || "Ship a category-defining AI product."}".

Character Traits Focus:
${(context.traits || []).map((t) => `- ${t.name} (Level ${t.level}/100): ${t.description || ""}`).join("\n") || "- Focus (Level 74/100): Protecting four hours a day for high-leverage work."}

Active Tasks & Priorities:
${(context.tasks || []).map((t) => `- [${t.status}] ${t.title}`).join("\n") || "- [pending] Write narrative for launch"}

Instructions for your role as AI Mentor:
1. You are a sharp, demanding executive mentor and strategic advisor.
2. Be direct, analytical, concise, and pragmatic.
3. NEVER use generic filler or empty encouragement like "Keep it up!", "You got this!", "Understood. Let's protect...", or "As an AI...".
4. Address the user's EXACT question directly with personalized insight calibrated to their specific alter ego, traits, and active tasks.
5. Provide actionable, high-leverage guidance in 2 to 4 paragraphs.`;

    let replyText = "";

    try {
      if (provider === "openai") {
        const formattedHistory = history.map((m) => ({
          role: m.role === "mentor" ? "assistant" : m.role,
          content: m.content,
        }));

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
              ...formattedHistory,
              { role: "user", content: trimmedMessage },
            ],
            temperature: 0.7,
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const errMsg = errBody.error?.message || `HTTP ${res.status} ${res.statusText}`;
          throw new Error(`OpenAI API Error: ${errMsg}`);
        }

        const resJson = await res.json();
        replyText = resJson.choices?.[0]?.message?.content?.trim() || "";
      } else if (provider === "gemini" || provider === "google") {
        const geminiHistory = history.map((m) => ({
          role: m.role === "mentor" || m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        }));

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [...geminiHistory, { role: "user", parts: [{ text: trimmedMessage }] }],
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
            max_tokens: 1024,
            system: systemPrompt,
            messages: [...anthropicHistory, { role: "user", content: trimmedMessage }],
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const errMsg = errBody.error?.message || `HTTP ${res.status} ${res.statusText}`;
          throw new Error(`Anthropic API Error: ${errMsg}`);
        }

        const resJson = await res.json();
        replyText = resJson.content?.[0]?.text?.trim() || "";
      } else {
        throw new Error(
          `Unsupported AI_PROVIDER "${provider}". Expected "openai", "gemini", or "anthropic".`,
        );
      }

      if (!replyText) {
        throw new Error("AI provider returned an empty response.");
      }

      console.log(
        `[MENTOR SERVER] Success. Generated response length: ${replyText.length} characters.`,
      );
      return { reply: replyText, conversationId: data.conversationId || null };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Unknown AI model error";
      console.error(`[MENTOR SERVER FAILURE] ${errMsg}`);
      // Fall back to dynamic response if API call fails
      const fallbackReply = generateDynamicMentorResponse(trimmedMessage, context);
      return { reply: fallbackReply, conversationId: data.conversationId || null };
    }
  });
