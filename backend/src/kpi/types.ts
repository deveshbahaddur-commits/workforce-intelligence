/**
 * Recykal's standard org-wide KRA/KPI template, extended to match the
 * interactive scorecard format managers actually use for review (see
 * frontend/src/utils/scorecardExport.ts). Field names and the 5-point
 * rating scale are fixed by the org — per row, the rating columns capture
 * what each performance band (1-5) concretely looks like for that specific
 * KPI, filled in at goal-setting time so review-time rating is against
 * pre-agreed, objective criteria.
 */
export interface KraMetric {
  name: string;
  baseline: number;
  target: number;
  unit: string; // "%" or "" for a plain number
  direction: "up" | "down"; // "up": higher is better, "down": lower is better
  note: string;
  group?: string; // optional project/workstream name, for grouping related metrics
  milestone?: string; // optional milestone label within a group
}

export interface KraChecklistItem {
  name: string;
  done: boolean;
}

export interface KpiItem {
  role: string;
  kra: string;
  goalAnnual: string;
  goalH1: string;
  goalH2: string;
  kpiTask: string; // the precise, measurable task/KPI definition
  weightagePercent: number;
  sourceOfTracking: string;
  ratingNeedsImprovement: string; // (1)
  ratingBelowExpectation: string; // (2)
  ratingMeetsExpectation: string; // (3)
  ratingAboveExpectation: string; // (4)
  ratingExceedsExpectation: string; // (5)
  metrics: KraMetric[];
  checklist: KraChecklistItem[];
  defined: boolean; // false while the target/KPI is still being worked out
}

export interface KpiSet {
  id: number;
  employeeId: string;
  employeeName: string;
  managerId: string;
  managerName: string;
  createdAt: string;
  items: KpiItem[];
}

export interface KpiDraftChatMessage {
  role: "user" | "model";
  text: string;
}
