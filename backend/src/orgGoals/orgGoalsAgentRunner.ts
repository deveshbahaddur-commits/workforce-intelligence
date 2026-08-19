import { GoogleGenAI, type Content } from "@google/genai";
import type { OrgGoalDraftChatMessage, OrgGoalItem } from "./types.js";
import { withGeminiRetry } from "../lib/withGeminiRetry.js";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const ORG_GOAL_ITEM_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Short name for this organisational goal, e.g. 'Operational Excellence'." },
    description: {
      type: "string",
      description: "One or two sentences on what this goal means and what success looks like this period.",
    },
  },
  required: ["title", "description"],
  additionalProperties: false,
} as const;

const DRAFT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description: "Conversational message shown to the admin in the chat panel.",
    },
    draftGoals: {
      type: "array",
      description:
        "The CURRENT FULL draft of organisational goals — always the complete set, not just what changed this turn. Empty while still gathering context.",
      items: ORG_GOAL_ITEM_SCHEMA,
    },
  },
  required: ["reply", "draftGoals"],
  additionalProperties: false,
} as const;

const SYSTEM_PROMPT = `You help an admin at Recykal draft the organisation's goals/priorities for a review period —
a short list (typically 3-7 items) of concrete organisational goals that individual employees' KRAs/KPIs will
later be checked for alignment against.

Each goal has a title (short name) and a description (1-2 sentences on what success looks like this period).

Rules:
- Ask about the org's actual priorities for this period before drafting anything — don't invent goals with no
  basis in what the admin told you.
- Every turn, return the CURRENT FULL draft (all goals, not just what changed) in draftGoals. Return an empty
  array only if there's nothing to show yet.
- Keep each goal concrete enough that a specific employee KRA could plausibly be judged "aligned" or "not aligned"
  against it — avoid pure platitudes like "be excellent."
- You never save anything — the admin reviews the draft and saves it themselves when satisfied.
- Keep replies concise and focused on moving the draft forward.`;

function toContents(history: OrgGoalDraftChatMessage[]): Content[] {
  return history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
}

/** Stateless per turn, same pattern as kpiAgentRunner.ts — caller resends full history each turn. */
export async function draftOrgGoals(params: {
  history: OrgGoalDraftChatMessage[];
}): Promise<{ reply: string; draftGoals: OrgGoalItem[] }> {
  const response = await withGeminiRetry(() =>
    client.models.generateContent({
      model: "gemini-flash-latest",
      contents: toContents(params.history),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: DRAFT_RESPONSE_SCHEMA,
      },
    }),
  );

  const text = response.text;
  if (!text) {
    return {
      reply: "I couldn't generate a response for that — could you rephrase, or try again?",
      draftGoals: [],
    };
  }

  return JSON.parse(text) as { reply: string; draftGoals: OrgGoalItem[] };
}
