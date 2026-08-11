/**
 * Decision types the agent can be asked about. This enum is the seam the whole
 * guardrail system pivots on — adding a new decision type later means adding
 * one entry here plus one posture handler, not restructuring the router.
 */
export const DECISION_TYPES = [
  "workforce_planning",
  "compensation",
  "promotion",
  "hiring_comparison",
  "termination",
  "restructuring",
] as const;

export type DecisionType = (typeof DECISION_TYPES)[number];

/**
 * The governance posture attached to a decision type. This is the contract
 * every posture handler must satisfy, independent of which decision type it
 * serves.
 */
export type PostureKind =
  | "recommend_freely"
  | "recommend_with_signoff"
  | "analysis_only"
  | "flag_and_route";

export interface PostureConfig {
  kind: PostureKind;
  decisionType: DecisionType;
  /** Human-readable description surfaced in the UI / audit log. */
  description: string;
  /** Whether this posture is fully implemented (calls the agent) in the current phase. */
  implemented: boolean;
}

export interface ClassificationResult {
  decisionType: DecisionType;
  /** Model's confidence, 0-1. Low-confidence classifications should be treated conservatively. */
  confidence: number;
  /** Short justification, kept for the audit trail. */
  rationale: string;
}

export interface GuardrailDecision {
  classification: ClassificationResult;
  posture: PostureConfig;
  /** Whether the query is allowed to reach the reasoning step at all. */
  allowReasoning: boolean;
  /** If allowReasoning is false, the response to return to the user instead. */
  shortCircuitResponse?: string;
}
