import { GoogleGenAI, type Content } from "@google/genai";
import { EMPLOYEES } from "../mcp/hris/data/seed.js";
import type { KpiDraftChatMessage, KpiItem } from "./types.js";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const KRA_METRIC_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "Short label for this tracked metric, e.g. 'Infant Attrition (exits <180 days)'." },
    baseline: { type: "number", description: "Current/baseline value the manager gave you." },
    target: { type: "number", description: "Target value to hit by the end of the tracked period." },
    unit: { type: "string", description: "Unit for baseline/target, e.g. '%'. Use an empty string for a plain score/count." },
    direction: {
      type: "string",
      enum: ["up", "down"],
      description: "'down' if a lower number is better (e.g. attrition %), 'up' if higher is better (e.g. survey score, completion %).",
    },
    note: { type: "string", description: "Short context the manager gave, e.g. '20 of 97 new hires exited before 180 days'. Empty string if none given." },
    group: { type: "string", description: "Optional project/workstream name if this is one of several milestones under a larger project. Empty string if not grouped." },
    milestone: { type: "string", description: "Optional milestone label within the group, e.g. 'Phase 1'. Empty string if not applicable." },
  },
  required: ["name", "baseline", "target", "unit", "direction", "note", "group", "milestone"],
  additionalProperties: false,
} as const;

const KRA_CHECKLIST_ITEM_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "Name of the unit/item being tracked, e.g. a department name." },
    done: { type: "boolean", description: "Whether this item is complete yet." },
  },
  required: ["name", "done"],
  additionalProperties: false,
} as const;

const KPI_ITEM_PROPERTIES = {
  role: { type: "string", description: "The employee's role/designation." },
  kra: { type: "string", description: "Key Result Area — the broad area of responsibility, e.g. 'Employee Attrition & Retention'." },
  goalAnnual: { type: "string", description: "The full-year goal narrative for this KRA — the complete, precise target for the whole review period." },
  goalH1: { type: "string", description: "The H1 (first-half) checkpoint narrative — what's expected by the halfway point of the year, phrased as a checkpoint against the annual goal." },
  goalH2: { type: "string", description: "The H2 (second-half / year-end) narrative — the full-year target restated for the final review, reflecting anything already achieved in H1." },
  kpiTask: { type: "string", description: "The precise, measurable KPI/task definition, one or two sentences stating exactly what is measured and the pass/fail line — this is what appears in the review table." },
  weightagePercent: { type: "number", description: "This KRA's weight, in percent. All KRAs for one employee must sum to 100." },
  sourceOfTracking: { type: "string", description: "Where/how this KRA is measured, e.g. 'P&C Dashboard', 'Exit Tracker'." },
  ratingNeedsImprovement: { type: "string", description: "What performance at level 1/5 (Needs Improvement) concretely looks like for this specific KRA." },
  ratingBelowExpectation: { type: "string", description: "What performance at level 2/5 (Below Expectation) concretely looks like for this specific KRA." },
  ratingMeetsExpectation: { type: "string", description: "What performance at level 3/5 (Meets Expectation) concretely looks like for this specific KRA." },
  ratingAboveExpectation: { type: "string", description: "What performance at level 4/5 (Above Expectation) concretely looks like for this specific KRA." },
  ratingExceedsExpectation: { type: "string", description: "What performance at level 5/5 (Exceeds Expectation) concretely looks like for this specific KRA." },
  metrics: {
    type: "array",
    description: "0 or more numeric sub-metrics with a baseline and target, drafted from numbers the manager gave you. Leave empty if this KRA isn't tracked with specific numbers yet.",
    items: KRA_METRIC_SCHEMA,
  },
  checklist: {
    type: "array",
    description: "0 or more named checklist items tracked as done/pending (e.g. per-department rollout status). Leave empty unless the manager describes a rollout-style checklist.",
    items: KRA_CHECKLIST_ITEM_SCHEMA,
  },
  defined: {
    type: "boolean",
    description: "True once this KRA's goal, KPI, and rating bands are concrete and ready to save. False while it's still vague or you're waiting on more input from the manager — a 'pending input' KRA can still appear in the draft as a placeholder.",
  },
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
        "The CURRENT FULL draft of KRA rows — always the complete set, not just what changed this turn. Empty while you're still gathering context from the manager.",
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

  return `You help a manager draft KRAs/KPIs for one of their reportees, in Recykal's standard org-wide scorecard
template — the same interactive format used at review time, not just a flat table.

You are drafting for: ${employee ? `${employee.name}, ${employee.role}, ${employee.team} team` : "an employee not found in the HRIS — ask the manager to confirm who this is for"}.
The manager drafting these is: ${manager ? `${manager.name}, ${manager.role}` : "unknown"}.

Each KRA row has these parts:
- Role, KRA (name), Weightage (%) — weightage across all KRAs in the set must sum to 100.
- THREE goal narratives, not one: goalAnnual (the full-year target), goalH1 (the first-half checkpoint —
  what's expected by mid-year), and goalH2 (the year-end target, restated for the final review). Ask the manager
  whether the expectation genuinely differs between H1 and H2 (common for ramping targets, e.g. "reduce
  attrition 5% by H1, 10% by H2") — if it's the same target throughout, all three can say essentially the same
  thing in different words, but still fill in all three.
- kpiTask: one or two precise, measurable sentences — exactly what is measured and the line between pass/fail.
- sourceOfTracking, and the 5 rating-band descriptions (Needs Improvement..Exceeds Expectation), same as before —
  agreed up front so review-time rating is against objective, pre-agreed criteria.
- metrics: an array of numeric sub-metrics (name, baseline, target, unit, direction, note), used when the KRA is
  tracked by specific numbers — e.g. "attrition from 20.6% to 18.5%". ONLY draft a metric when the manager has
  given you an actual baseline and target number; don't invent numbers. It's fine and common for a KRA to have
  zero metrics (purely qualitative KRAs) or several (e.g. one project's several milestones — use the optional
  group/milestone fields to cluster those together).
- checklist: an array of named done/pending items, used only for rollout-style KRAs where the manager describes
  tracking multiple units/departments/items individually (e.g. "org structure published, unit by unit"). Leave
  empty for KRAs that don't work this way — most won't.
- defined: true once the KRA is concrete enough to save (goal, KPI, and rating bands filled in with real
  content); false while it's still a placeholder you're waiting on more input for.

Rules:
- Weightage (%) across all KRA rows in the set must sum to 100. Keep a running check as you add/adjust rows and
  say so explicitly if the current draft doesn't sum to 100.
- Typical sets have 3-7 KRA rows — enough to cover the role's real priorities without being unwieldy.
- Ask about the employee's priorities for this review period before drafting anything. Don't invent goals,
  numbers, or checklists with no basis in what the manager told you — leave metrics/checklist empty and defined
  false rather than fabricate specifics.
- Ground the KRAs in the employee's actual role and team.
- Every turn, return the CURRENT FULL draft (all rows, not just what changed) in draftKpis — the UI replaces its
  view with whatever you return. Return an empty array only if there's nothing to show yet.
- You never save anything — the manager reviews the draft and saves it themselves when satisfied. Don't claim to
  have saved it or tell them it's final.
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
