import { createServerFn } from "@tanstack/react-start";
import fs from "node:fs";
import path from "node:path";

export interface KnowledgeAIPayload {
  query: string;
  userGoal?: string;
  userDomain?: string;
  currentBooks?: Array<{ title: string; author: string; progress: number }>;
  notes?: Array<{ title: string; body: string }>;
  personalityScores?: Record<string, number | undefined> | undefined;
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
    // ignore
  }
  return result;
}

function getAiApiKey(): { apiKey: string; provider: string; isPlaceholder: boolean } {
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
    merged["VITE_AI_API_KEY"] ||
    merged["GEMINI_API_KEY"] ||
    merged["VITE_GEMINI_API_KEY"] ||
    ""
  ).trim();

  let provider = (merged["AI_PROVIDER"] || merged["VITE_AI_PROVIDER"] || "").toLowerCase().trim();
  if (!provider) {
    if (apiKey.startsWith("gsk_") || merged["GROQ_API_KEY"] || merged["VITE_GROQ_API_KEY"]) {
      provider = "groq";
    } else {
      provider = "gemini";
    }
  }

  const isPlaceholder =
    !apiKey ||
    apiKey === "your_ai_api_key_here" ||
    apiKey === "your_gemini_api_key_here" ||
    apiKey === "your_groq_api_key_here";

  return { apiKey, provider, isPlaceholder };
}

function generateFallbackRecommendation(payload: KnowledgeAIPayload): string {
  const goal = payload.userGoal || "your goals";
  const domain = payload.userDomain || "your domain";
  const query = payload.query.toLowerCase();

  if (query.includes("recommend") || query.includes("what") || query.includes("read")) {
    return `Based on your focus in ${domain} and your goal to ${goal}, I recommend prioritizing books that build systems thinking and execution frameworks. 

**Immediate reads:**
- *Thinking in Systems* by Donella Meadows — foundational for understanding how to build durable structures
- *Deep Work* by Cal Newport — essential for protecting the focus blocks your protocol demands
- *The War of Art* by Steven Pressfield — directly addresses the resistance patterns that block execution

**For your 90-day sprint:**
Read one chapter per day during your evening block. Capture a single insight per session in your collision notebook — don't annotate everything, just the idea that collides with your current mission.`;
  }

  if (query.includes("summar") || query.includes("notes")) {
    const noteSummary = (payload.notes || [])
      .slice(0, 3)
      .map((n) => `• **${n.title}**: ${n.body.slice(0, 100)}...`)
      .join("\n");

    return `Your captured insights reveal a pattern worth examining:\n\n${noteSummary || "No notes captured yet."}\n\nThe thread connecting these insights is about leverage — specifically, how small system changes produce disproportionate outputs. This maps directly to your identity architecture work.`;
  }

  return `Your knowledge system is a competitive advantage. Based on your current reading list and goals in ${domain}, focus on synthesis over accumulation. The goal is not more books — it is deeper collision between the ideas you are already encountering. Use your collision notebook actively.`;
}

export const callKnowledgeAiServerFn = createServerFn({ method: "POST" })
  .validator((data: KnowledgeAIPayload) => data)
  .handler(async ({ data }) => {
    const { query, userGoal, userDomain, currentBooks, notes, personalityScores } = data;
    console.log(`[KNOWLEDGE AI] Query: "${query.slice(0, 60)}"`);

    const { apiKey, provider, isPlaceholder } = getAiApiKey();

    if (isPlaceholder) {
      console.log("[KNOWLEDGE AI] No API key, using fallback.");
      return { response: generateFallbackRecommendation(data) };
    }

    const openness = personalityScores?.["openness"];
    const conscientiousness = personalityScores?.["conscientiousness"];
    const extraversion = personalityScores?.["extraversion"];

    const personalityStr = personalityScores
      ? `Openness ${openness ?? "N/A"}%, Conscientiousness ${conscientiousness ?? "N/A"}%, Extraversion ${extraversion ?? "N/A"}%`
      : "Not assessed";

    const systemPrompt = `You are a world-class knowledge curator and learning strategist for a high-performance personal operating system called Alter Ego OS.

User Profile:
- Primary Goal: ${userGoal || "Not specified"}
- Domain: ${userDomain || "Not specified"}
- Personality: ${personalityStr}

Current Reading:
${(currentBooks || []).map((b) => `- "${b.title}" by ${b.author} (${b.progress}% complete)`).join("\n") || "No books tracked yet."}

Recent Notes:
${(notes || [])
  .slice(0, 5)
  .map((n) => `- ${n.title}: ${n.body.slice(0, 150)}`)
  .join("\n") || "No notes captured yet."}

Instructions:
1. Be specific and actionable — no generic book lists.
2. Calibrate recommendations to the user's actual goal and domain.
3. Prioritize depth over breadth.
4. Use markdown formatting for clarity.
5. Keep responses to 150-250 words maximum.
6. Reference their current reading when relevant.`;

    try {
      let response = "";
      if (provider === "groq" || apiKey.startsWith("gsk_")) {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "groq/compound",
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: query },
            ],
            temperature: 0.7,
            max_tokens: 512,
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error?.message || `Groq HTTP ${res.status}`);
        }

        const resJson = await res.json();
        response = resJson.choices?.[0]?.message?.content?.trim() || "";
      } else {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: query }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 512,
            },
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error?.message || `Gemini HTTP ${res.status}`);
        }

        const resJson = await res.json();
        response = resJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      }

      if (!response) throw new Error("Empty response from AI model");

      console.log(`[KNOWLEDGE AI] Success. Length: ${response.length}`);
      return { response };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[KNOWLEDGE AI ERROR] ${msg}`);
      return { response: generateFallbackRecommendation(data) };
    }
  });
