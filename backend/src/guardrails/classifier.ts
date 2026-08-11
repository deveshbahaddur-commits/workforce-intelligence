import { GoogleGenAI } from "@google/genai";
import { DECISION_TYPES, type ClassificationResult } from "./types.js";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const CLASSIFIER_SYSTEM_PROMPT = `You are a strict classifier for an internal workforce decision-support tool.
Classify the user's question into exactly one decision type. Do not answer the question — only classify it.

Decision types:
- workforce_planning: headcount, team capacity, "should I hire for this role", retention strategy, org design.
- compensation: pay, salary bands, raises, bonuses, equity.
- promotion: promotion readiness, leveling, title changes for an existing employee.
- hiring_comparison: comparing specific candidates, "who should I hire between X and Y".
- termination: firing, letting someone go, performance-based exit, layoffs of a specific individual.
- restructuring: reorgs, eliminating roles/teams, department mergers, workforce reductions at team/org scale.

If a question could plausibly touch a higher-governance category (compensation, promotion, hiring_comparison,
termination, restructuring), prefer that category over workforce_planning — err toward stricter governance,
not looser.`;

const CLASSIFICATION_SCHEMA = {
  type: "object",
  properties: {
    decisionType: { type: "string", enum: [...DECISION_TYPES] },
    confidence: {
      type: "number",
      description: "0 to 1. Lower when the question is ambiguous or spans multiple categories.",
    },
    rationale: {
      type: "string",
      description: "One sentence explaining the classification, for the audit log.",
    },
  },
  required: ["decisionType", "confidence", "rationale"],
  additionalProperties: false,
} as const;

const FAIL_CLOSED_RESULT: ClassificationResult = {
  decisionType: "restructuring",
  confidence: 0,
  rationale: "Classifier produced no usable output (blocked, empty, or malformed); routed to strictest posture as a fail-safe.",
};

/**
 * Classifies a user query into a DecisionType BEFORE it reaches the agent's
 * reasoning step. This is a single, non-agentic Gemini call — deliberately
 * separate from the tool-using loop in agentRunner.ts, so a classification
 * failure can never accidentally invoke tools or produce a recommendation.
 */
export async function classifyQuery(query: string): Promise<ClassificationResult> {
  const response = await client.models.generateContent({
    model: "gemini-flash-latest",
    contents: query,
    config: {
      systemInstruction: CLASSIFIER_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseJsonSchema: CLASSIFICATION_SCHEMA,
    },
  });

  // Fail closed: a blocked prompt, safety-filtered output, or any other
  // reason the model produced no text gets routed to the strictest posture
  // rather than defaulting to "recommend freely".
  const text = response.text;
  if (!text) {
    return FAIL_CLOSED_RESULT;
  }

  let parsed: { decisionType: string; confidence: number; rationale: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    return FAIL_CLOSED_RESULT;
  }

  if (!(DECISION_TYPES as readonly string[]).includes(parsed.decisionType)) {
    return FAIL_CLOSED_RESULT;
  }

  return {
    decisionType: parsed.decisionType as ClassificationResult["decisionType"],
    confidence: Math.max(0, Math.min(1, parsed.confidence)),
    rationale: parsed.rationale,
  };
}
