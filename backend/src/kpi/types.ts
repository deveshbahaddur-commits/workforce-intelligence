/**
 * Recykal's standard org-wide KRA/KPI template. Field names and the 5-point
 * rating scale are fixed by the org, not something Phase 0 should redesign —
 * per row, the rating columns capture what each performance band (1-5)
 * concretely looks like for that specific KPI, filled in at goal-setting
 * time so review-time rating is against pre-agreed, objective criteria.
 */
export interface KpiItem {
  role: string;
  kra: string;
  kpi: string;
  goalDescription: string;
  weightagePercent: number;
  sourceOfTracking: string;
  ratingNeedsImprovement: string; // (1)
  ratingBelowExpectation: string; // (2)
  ratingMeetsExpectation: string; // (3)
  ratingAboveExpectation: string; // (4)
  ratingExceedsExpectation: string; // (5)
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
