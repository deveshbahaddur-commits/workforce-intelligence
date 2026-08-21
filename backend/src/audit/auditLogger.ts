import type { GuardrailDecision } from "../guardrails/types.js";
import type { KpiItem } from "../kpi/types.js";
import type { ObjectivityDimension } from "../kpi/objectivityRunner.js";
import {
  insertAuditRecord,
  listAuditRecords,
  insertKpiAuditRecord,
  listKpiAuditRecords,
  type AuditRecord,
} from "./auditStore.js";

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

/**
 * Logs one KPI set save. Call this only after the save has actually
 * succeeded — logging a rejected or failed save attempt as if it happened
 * would make the audit trail lie.
 *
 * `kind` is supplied by the caller rather than derived in here: whether this
 * is the employee's first saved set ("initial") or a later one ("revision")
 * has to be read BEFORE saveKpiSet's own INSERT runs, or the just-inserted
 * row would count itself and every save would look like a "revision". See
 * the read in POST /api/kpi/sets (server.ts) for that ordering.
 */
export async function logKpiSetSaved(params: {
  kind: "initial" | "revision";
  kpiSetId: number;
  employeeId: string;
  employeeName: string;
  savedById: string;
  savedByName: string;
  items: KpiItem[];
}): Promise<number> {
  return insertKpiAuditRecord({
    timestamp: new Date().toISOString(),
    kind: params.kind,
    kpiSetId: params.kpiSetId,
    employeeId: params.employeeId,
    employeeName: params.employeeName,
    savedById: params.savedById,
    savedByName: params.savedByName,
    items: JSON.stringify(params.items),
  });
}

export function getRecentKpiAuditRecords(limit = 100) {
  return listKpiAuditRecords(limit);
}

/** One KRA that was still failing its objectivity check at the moment a manager overrode the Finalize warning. */
export interface ObjectivityOverrideItem {
  kra: string;
  score: number;
  failingDimension: ObjectivityDimension;
  reason: string;
}

/**
 * Logs a manager's "Finalize anyway" acknowledgment past a failing
 * objectivity check (PRD v3 §4) — a distinct event from the save itself,
 * logged in ADDITION to (never instead of) the paired logKpiSetSaved call
 * for the same action, sharing the same kpiSetId.
 *
 * Reuses the kpi_audit_log table rather than a new one — same rationale as
 * "initial"/"revision": one audit trail for everything that happens to a
 * KPI set, not a parallel mechanism. `failingKras` (only the KRAs that were
 * still failing, not the full set — that's already in the paired
 * "initial"/"revision" row) is what items_json holds for this kind.
 *
 * Not called anywhere yet — the Finalize/Review-stage UI this belongs to
 * (PRD v3 §3/§4) hasn't been built this session. Wire this in once it is.
 */
export async function logObjectivityOverride(params: {
  kpiSetId: number;
  employeeId: string;
  employeeName: string;
  overriddenById: string;
  overriddenByName: string;
  failingKras: ObjectivityOverrideItem[];
}): Promise<number> {
  return insertKpiAuditRecord({
    timestamp: new Date().toISOString(),
    kind: "objectivity_override",
    kpiSetId: params.kpiSetId,
    employeeId: params.employeeId,
    employeeName: params.employeeName,
    savedById: params.overriddenById,
    savedByName: params.overriddenByName,
    items: JSON.stringify(params.failingKras),
  });
}
