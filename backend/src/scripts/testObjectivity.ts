/**
 * Ad-hoc verification for kpi/objectivityRunner.ts against five hand-picked
 * KRAs, each isolating a different pass/fail case. Not wired to any route —
 * run directly: npm run test-objectivity
 */
import { assessObjectivity } from "../kpi/objectivityRunner.js";
import type { KpiItem } from "../kpi/types.js";

function item(partial: Partial<KpiItem> & Pick<KpiItem, "kra" | "kpiTask">): KpiItem {
  return {
    role: "Manager",
    goalAnnual: "",
    goalH1: "",
    goalH2: "",
    weightagePercent: 20,
    sourceOfTracking: "",
    ratingNeedsImprovement: "",
    ratingBelowExpectation: "",
    ratingMeetsExpectation: "",
    ratingAboveExpectation: "",
    ratingExceedsExpectation: "",
    metrics: [],
    checklist: [],
    defined: true,
    ...partial,
  };
}

const cases: KpiItem[] = [
  // 1. Good — clear metric, named source, checkpoint-assessable.
  item({
    kra: "Employee Attrition Reduction",
    kpiTask: "Reduce voluntary attrition from 20% to 15% by year end, with an interim checkpoint of 17.5% at H1.",
    sourceOfTracking: "P&C HRIS dashboard (monthly attrition report)",
    goalAnnual: "Reduce annual voluntary attrition to 15%.",
    goalH1: "Reach 17.5% voluntary attrition by H1.",
    goalH2: "Reach 15% voluntary attrition by year end.",
    metrics: [
      { name: "Voluntary attrition", baseline: 20, target: 15, unit: "%", direction: "down", note: "20% trailing 12-month attrition as of today" },
    ],
  }),

  // 2. Vague/unmeasurable — no number, percentage, binary outcome, or milestone.
  item({
    kra: "Stakeholder Communication",
    kpiTask: "Improve communication and relationships with cross-functional stakeholders.",
    sourceOfTracking: "Manager's periodic 1:1 feedback",
    goalAnnual: "Stakeholders feel communication has improved this year.",
    goalH1: "Communication feels better by H1.",
    goalH2: "Communication feels better by H2.",
  }),

  // 3. Has a metric, but the data source is blank/placeholder.
  item({
    kra: "Customer Escalation Resolution",
    kpiTask: "Resolve 95% of customer escalations within 48 hours by year end.",
    sourceOfTracking: "TBD",
    goalAnnual: "95% of escalations resolved within 48 hours.",
    goalH1: "85% of escalations resolved within 48 hours by H1.",
    goalH2: "95% of escalations resolved within 48 hours by H2.",
    metrics: [
      { name: "Escalations resolved within 48h", baseline: 70, target: 95, unit: "%", direction: "up", note: "currently ~70%" },
    ],
  }),

  // 4. Measurable and sourced, but not falsifiable by any H1/H2 checkpoint — a 3-year outcome.
  item({
    kra: "Market Leadership in EPR Category",
    kpiTask: "Become the #1 market share player in the EPR compliance category within 3 years, reaching 40% share.",
    sourceOfTracking: "Annual industry analyst market-share report",
    goalAnnual: "Grow market share as part of a 3-year plan to reach the #1 position (40% share); no single-year milestone is defined.",
    goalH1: "Same 3-year trajectory — the analyst report has no interim H1 data point.",
    goalH2: "Same 3-year trajectory — the analyst report has no interim H2 data point.",
    metrics: [
      { name: "EPR category market share", baseline: 12, target: 40, unit: "%", direction: "up", note: "3-year target per market entry plan" },
    ],
  }),

  // 5. Fails two dimensions at once — no data source AND unfalsifiable this cycle.
  item({
    kra: "Industry Thought Leadership Recognition",
    kpiTask: "Achieve a top-3 ranking in the industry's circular economy thought leadership index within 5 years.",
    sourceOfTracking: "",
    goalAnnual: "Make progress toward a top-3 industry ranking over a 5-year horizon; the index has no defined refresh within a single year.",
    goalH1: "Same 5-year horizon — no interim checkpoint exists within this cycle.",
    goalH2: "Same 5-year horizon — no interim checkpoint exists within this cycle.",
    metrics: [
      { name: "Thought leadership index ranking", baseline: 15, target: 3, unit: "", direction: "down", note: "currently ranked ~15th" },
    ],
  }),
];

const results = await assessObjectivity({ kpiItems: cases });

for (const [i, r] of results.entries()) {
  console.log(`\n${i + 1}. ${r.kra}`);
  console.log(`   score: ${r.score}  passed: ${r.passed}  failingDimension: ${r.failingDimension ?? "none"}`);
  console.log(`   reason: ${r.reason}`);
  if (r.suggestedRewrite) console.log(`   suggestedRewrite: ${r.suggestedRewrite}`);
}
