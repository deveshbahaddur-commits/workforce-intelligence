import { GoogleGenAI, type Content } from "@google/genai";
import { EMPLOYEES } from "../mcp/hris/data/seed.js";
import type { KpiDraftChatMessage, KpiItem } from "./types.js";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const KPI_ITEM_PROPERTIES = {
  role: { type: "string", description: "The employee's role/designation." },
  kra: { type: "string", description: "Key Result Area — the broad area of responsibility, e.g. 'Customer Retention'." },
  kpi: { type: "string", description: "Key Performance Indicator / metric that measures the KRA, e.g. 'NPS score'." },
  goalDescription: { type: "string", description: "The specific, concrete goal/target for this KPI." },
  weightagePercent: { type: "number", description: "This KPI's weight, in percent. All KPIs for one employee must sum to 100." },
  sourceOfTracking: { type: "string", description: "Where/how this KPI is measured, e.g. 'CRM dashboard', 'Support ticket system'." },
  ratingNeedsImprovement: { type: "string", description: "What performance at level 1/5 (Needs Improvement) concretely looks like for this specific KPI." },
  ratingBelowExpectation: { type: "string", description: "What performance at level 2/5 (Below Expectation) concretely looks like for this specific KPI." },
  ratingMeetsExpectation: { type: "string", description: "What performance at level 3/5 (Meets Expectation) concretely looks like for this specific KPI." },
  ratingAboveExpectation: { type: "string", description: "What performance at level 4/5 (Above Expectation) concretely looks like for this specific KPI." },
  ratingExceedsExpectation: { type: "string", description: "What performance at level 5/5 (Exceeds Expectation) concretely looks like for this specific KPI." },
} as const;

const KPI_ITEM_REQUIRED = Object.keys(KPI_ITEM_PROPERTIES);

const DRAFT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    reply: {
      type: "string",
      description: "Conversational message shown to the manager in the chat panel.",
    },
    draftKpis: {
      type: "array",
      description:
        "The CURRENT FULL draft of KPI rows — always the complete set, not just what changed this turn. Empty while you're still gathering context from the manager.",
      items: {
        type: "object",
        properties: KPI_ITEM_PROPERTIES,
        required: KPI_ITEM_REQUIRED,
        additionalProperties: false,
      },
    },
  },
  required: ["reply", "draftKpis"],
  additionalProperties: false,
} as const;

function buildSystemPrompt(employeeId: string, managerId: string): string {
  const employee = EMPLOYEES.find((e) => e.employeeId === employeeId);
  const manager = EMPLOYEES.find((e) => e.employeeId === managerId);

  return `You help a manager draft KRAs/KPIs for one of their reportees, in Recykal's standard org-wide template.

You are drafting for: ${employee ? `${employee.name}, ${employee.role}, ${employee.team} team` : "an employee not found in the HRIS — ask the manager to confirm who this is for"}.
The manager drafting these is: ${manager ? `${manager.name}, ${manager.role}` : "unknown"}.

The template has exactly these fields per KPI row: Role, KRA, KPI, Goal Description, Weightage (%), Source of
Tracking, and a description of what each of the 5 rating bands (Needs Improvement, Below Expectation, Meets
Expectation, Above Expectation, Exceeds Expectation) concretely looks like for that specific KPI — these rating
descriptions are agreed up front, at goal-setting time, so review-time rating is against objective, pre-agreed
criteria rather than a generic 1-5 scale.

Rules:
- Weightage (%) across all KPI rows in the set must sum to 100. Keep a running check as you add/adjust rows and
  say so explicitly if the current draft doesn't sum to 100.
- Typical sets have 3-6 KRA/KPI rows — enough to cover the role's real priorities without being unwieldy.
- Ask about the employee's priorities for this review period before drafting anything. Don't invent goals with no
  basis in what the manager told you.
- Ground the KPIs in the employee's actual role and team.
- Every turn, return the CURRENT FULL draft (all rows, not just what changed) in draftKpis — the UI replaces its
  table with whatever you return. Return an empty array only if there's nothing to show yet.
- You never save anything — the manager reviews the draft table and saves it themselves when satisfied. Don't
  claim to have saved it or tell them it's final.
- Keep replies concise and focused on moving the draft forward.`;
}

function toContents(history: KpiDraftChatMessage[]): Content[] {
  return history.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
}

/**
 * One turn of the chat-assisted KPI drafting flow. Stateless on the server
 * side, matching the rest of this app: the caller resends the full
 * conversation history each turn (mirroring how agentRunner.ts and
 * classifier.ts work), rather than the backend holding session state.
 */
export async function draftKpis(params: {
  employeeId: string;
  managerId: string;
  history: KpiDraftChatMessage[];
}): Promise<{ reply: string; draftKpis: KpiItem[] }> {
  const response = await client.models.generateContent({
    model: "gemini-flash-latest",
    contents: toContents(params.history),
    config: {
      systemInstruction: buildSystemPrompt(params.employeeId, params.managerId),
      responseMimeType: "application/json",
      responseJsonSchema: DRAFT_RESPONSE_SCHEMA,
    },
  });

  const text = response.text;
  if (!text) {
    return {
      reply: "I couldn't generate a response for that — could you rephrase, or try again?",
      draftKpis: [],
    };
  }

  const parsed = JSON.parse(text) as { reply: string; draftKpis: KpiItem[] };
  return parsed;
}
