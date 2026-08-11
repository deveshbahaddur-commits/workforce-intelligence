import type { DecisionType, PostureConfig } from "./types.js";

/**
 * The posture table is the single source of truth for governance behavior.
 * Only "workforce_planning" is implemented in Phase 0 — everything else is
 * wired up (classified, routed, audited) but returns a stub response instead
 * of reaching the agent. This is intentional: adding a posture later means
 * flipping `implemented: true` and writing its handler, not touching the
 * classifier or the router.
 */
export const POSTURE_TABLE: Record<DecisionType, PostureConfig> = {
  workforce_planning: {
    kind: "recommend_freely",
    decisionType: "workforce_planning",
    description:
      "Workforce planning, headcount, and retention strategy questions. The agent may recommend directly.",
    implemented: true,
  },
  compensation: {
    kind: "recommend_with_signoff",
    decisionType: "compensation",
    description:
      "Compensation questions. The agent may recommend, but the recommendation requires human sign-off before acting on it.",
    implemented: false,
  },
  promotion: {
    kind: "recommend_with_signoff",
    decisionType: "promotion",
    description:
      "Promotion questions. The agent may recommend, but the recommendation requires human sign-off before acting on it.",
    implemented: false,
  },
  hiring_comparison: {
    kind: "analysis_only",
    decisionType: "hiring_comparison",
    description:
      "Hiring or candidate comparison questions. The agent may analyze and present data, but must not recommend a candidate.",
    implemented: false,
  },
  termination: {
    kind: "flag_and_route",
    decisionType: "termination",
    description:
      "Termination questions. The agent never recommends or analyzes — it flags the request and routes it to HR/Legal.",
    implemented: false,
  },
  restructuring: {
    kind: "flag_and_route",
    decisionType: "restructuring",
    description:
      "Restructuring questions. The agent never recommends or analyzes — it flags the request and routes it to HR/Legal.",
    implemented: false,
  },
};
