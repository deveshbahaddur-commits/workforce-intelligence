import type { GuardrailDecision } from "../guardrails/types.js";
import { insertAuditRecord, listAuditRecords, type AuditRecord } from "./auditStore.js";

export interface ToolCallRecord {
  tool: string;
  input: unknown;
  output: unknown;
}

/**
 * Stable audit-logging contract for the rest of the app. Every query that
 * reaches the guardrail — whether it's allowed through to the agent or
 * short-circuited — is logged here, exactly once, with what was classified,
 * what data was pulled (if any), and what was returned to the user. Only
 * `auditStore.ts` (the persistence backend) is meant to change if this ever
 * moves off SQLite; this interface should not need to.
 */
export async function logInteraction(params: {
  query: string;
  decision: GuardrailDecision;
  toolCalls: ToolCallRecord[];
  finalResponse: string;
}): Promise<number> {
  const record: AuditRecord = {
    timestamp: new Date().toISOString(),
    query: params.query,
    decisionType: params.decision.classification.decisionType,
    postureKind: params.decision.posture.kind,
    classificationConfidence: params.decision.classification.confidence,
    classificationRationale: params.decision.classification.rationale,
    allowedReasoning: params.decision.allowReasoning ? 1 : 0,
    toolCalls: JSON.stringify(params.toolCalls),
    response: params.finalResponse,
  };
  return insertAuditRecord(record);
}

export function getRecentAuditRecords(limit = 100) {
  return listAuditRecords(limit);
}
