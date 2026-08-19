import { GoogleGenAI } from "@google/genai";
import type { KpiItem } from "../kpi/types.js";
import type { OrgGoalItem } from "../orgGoals/types.js";
import { withGeminiRetry } from "../lib/withGeminiRetry.js";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface AlignmentResult {
  kra: string;
  verdict: "aligned" | "partial" | "not_aligned";
  reason: string;
}

const ALIGNMENT_ITEM_SCHEMA = {
  type: "object",
  properties: {
    kra: { type: "string", description: "The KRA name this verdict is for, copied exactly from the input list." },
    verdict: {
      type: "string",
      enum: ["aligned", "partial", "not_aligned"],
      description: "How well this KRA supports the stated organisational goals.",
    },
    reason: {
      type: "string",
      description: "One or two sentences explaining the verdict, naming the specific org goal(s) it does or doesn't support.",
    },
  },
  required: ["kra", "verdict", "reason"],
  additionalProperties: false,
} as const;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      description: "One result per input KRA, in the same order.",
      items: ALIGNMENT_ITEM_SCHEMA,
    },
  },
  required: ["results"],
  additionalProperties: false,
} as const;

/**
 * On-demand only (admin clicks "Check alignment" per saved set) — this is a
 * Gemini call per click, not run automatically on every page load, since
 * this project's free-tier key has a low daily request quota (see memory).
 */
export async function assessAlignment(params: {
  kraItems: KpiItem[];
  orgGoals: OrgGoalItem[];
}): Promise<AlignmentResult[]> {
  const prompt = `Organisation goals for this period:
${params.orgGoals.map((g) => `- ${g.title}: ${g.description}`).join("\n")}

Employee's KRAs to assess:
${params.kraItems.map((k) => `- ${k.kra}: ${k.goalAnnual}`).join("\n")}

For each KRA listed above, judge how well it supports the organisation's stated goals above. Return exactly one
result per KRA, in the same order given, using the exact KRA name as provided.`;

  const response = await withGeminiRetry(() =>
    client.models.generateContent({
      model: "gemini-flash-latest",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: RESPONSE_SCHEMA,
      },
    }),
  );

  const text = response.text;
  if (!text) return [];
  const parsed = JSON.parse(text) as { results: AlignmentResult[] };
  return parsed.results;
}
