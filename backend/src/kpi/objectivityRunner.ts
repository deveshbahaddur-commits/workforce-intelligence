import { GoogleGenAI } from "@google/genai";
import type { KpiItem } from "./types.js";
import { withGeminiRetry } from "../lib/withGeminiRetry.js";

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export type ObjectivityDimension = "measurability" | "falsifiability" | "data_source";

export interface ObjectivityResult {
  kra: string;
  score: number; // 0-100, the model's own holistic judgment
  passed: boolean; // derived: true iff all three per-dimension checks passed
  failingDimension: ObjectivityDimension | null; // deterministic — see DIMENSION_PRIORITY below
  reason: string;
  suggestedRewrite: string; // a concrete rewritten kpiTask fixing the failing dimension(s); "" if passed
}

/**
 * When more than one dimension fails, failingDimension is not the model's
 * call — it's whichever of these comes first, in this fixed order:
 *   1. measurability   — most fundamental; nothing else is assessable if the
 *                         goal isn't quantified in the first place.
 *   2. falsifiability  — well-defined and quantified, but can't be verified
 *                         within the cycle window.
 *   3. data_source     — most fixable of the three; metric and horizon are
 *                         both fine, it just needs a tracking source named.
 */
const DIMENSION_PRIORITY: ObjectivityDimension[] = ["measurability", "falsifiability", "data_source"];

interface RawObjectivityItem {
  kra: string;
  score: number;
  measurabilityPassed: boolean;
  falsifiabilityPassed: boolean;
  dataSourcePassed: boolean;
  reason: string;
  suggestedRewrite: string;
}

function computeFailingDimension(raw: RawObjectivityItem): ObjectivityDimension | null {
  const failed: Record<ObjectivityDimension, boolean> = {
    measurability: !raw.measurabilityPassed,
    falsifiability: !raw.falsifiabilityPassed,
    data_source: !raw.dataSourcePassed,
  };
  return DIMENSION_PRIORITY.find((d) => failed[d]) ?? null;
}

const OBJECTIVITY_ITEM_SCHEMA = {
  type: "object",
  properties: {
    kra: { type: "string", description: "The KRA name this result is for, copied exactly from the input list." },
    score: {
      type: "number",
      description:
        "0-100 objectivity score. 100 = fully objective: measurable, has a real data source, and falsifiable within its cycle. Deduct roughly 25-40 points per failing check depending on severity.",
    },
    measurabilityPassed: {
      type: "boolean",
      description: "True if the KPI has a number, percentage, binary outcome, or verifiable milestone attached — not a vague sentiment.",
    },
    falsifiabilityPassed: {
      type: "boolean",
      description: "True if the KPI can be clearly assessed as met or not-met by its relevant H1/H2/Annual checkpoint — false if the horizon is too long or open-ended for this cycle to say either way.",
    },
    dataSourcePassed: {
      type: "boolean",
      description: "True if the KPI names a real, specific place it will actually be measured from that either exists or can realistically be stood up this cycle — false if blank, 'TBD', or a placeholder.",
    },
    reason: {
      type: "string",
      description:
        "One or two sentences naming specifically what's missing or wrong — reference every failing check, not just one, even though only the highest-priority one is shown as the headline. This is shown to the manager on hover.",
    },
    suggestedRewrite: {
      type: "string",
      description: "A concrete rewritten kpiTask that would fix every failing check. Empty string if all three passed.",
    },
  },
  required: ["kra", "score", "measurabilityPassed", "falsifiabilityPassed", "dataSourcePassed", "reason", "suggestedRewrite"],
  additionalProperties: false,
} as const;

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      description: "One result per input KRA, in the same order.",
      items: OBJECTIVITY_ITEM_SCHEMA,
    },
  },
  required: ["results"],
  additionalProperties: false,
} as const;

function describeKpi(k: KpiItem, index: number): string {
  const metrics = k.metrics.length > 0
    ? k.metrics.map((m) => `${m.name}: ${m.baseline}${m.unit} -> ${m.target}${m.unit} (${m.direction})`).join("; ")
    : "none";
  const checklist = k.checklist.length > 0 ? k.checklist.map((c) => c.name).join(", ") : "none";

  return `${index + 1}. Name: ${k.kra}
   KPI/task definition: ${k.kpiTask || "(not written yet)"}
   Source of tracking: ${k.sourceOfTracking || "(not specified)"}
   Annual goal: ${k.goalAnnual || "(not written yet)"}
   H1 checkpoint: ${k.goalH1 || "(not written yet)"}
   H2 checkpoint: ${k.goalH2 || "(not written yet)"}
   Numeric sub-metrics: ${metrics}
   Checklist items: ${checklist}`;
}

/**
 * Structured objectivity scoring for KRAs/KPIs, mirroring admin/alignmentRunner.ts's
 * shape — a batched, on-demand Gemini call returning a typed result per item rather
 * than free text, so the UI can render a score/badge consistently. Not wired into
 * the draft or save flow yet.
 */
export async function assessObjectivity(params: {
  kpiItems: KpiItem[];
}): Promise<ObjectivityResult[]> {
  const prompt = `Each numbered KRA below must pass three objectivity checks:
1. Measurability — it has a number, percentage, binary outcome, or verifiable milestone attached (not a vague
   sentiment like "improve stakeholder communication").
2. Data source — it names a real, specific place this will actually be measured from that either already exists
   or can realistically be stood up this cycle (not blank, not "TBD", not someone's unstructured opinion as the
   sole measure).
3. Falsifiability — it can be assessed as clearly met or not-met by its relevant H1/H2/Annual checkpoint, not so
   long-term or open-ended that no one could tell whether it happened by then.

KRAs to assess, numbered:
${params.kpiItems.map(describeKpi).join("\n\n")}

For each numbered KRA above, return exactly one result, in the same order given. The "kra" field in your response
must be ONLY that KRA's Name line — never include any other text from its row.`;

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
  const parsed = JSON.parse(text) as { results: RawObjectivityItem[] };

  // Belt-and-suspenders, same fix as alignmentRunner.ts: trust our own input order
  // over whatever the model echoed back for "kra" rather than relying on the echo.
  const results = parsed.results.length === params.kpiItems.length
    ? parsed.results.map((r, i) => ({ ...r, kra: params.kpiItems[i].kra }))
    : parsed.results;

  // failingDimension/passed are computed here, not taken from the model — see
  // DIMENSION_PRIORITY above for why. Only score, reason, and suggestedRewrite
  // are the model's own judgment.
  return results.map((r) => {
    const failingDimension = computeFailingDimension(r);
    return {
      kra: r.kra,
      score: r.score,
      passed: failingDimension === null,
      failingDimension,
      reason: r.reason,
      suggestedRewrite: r.suggestedRewrite,
    };
  });
}
