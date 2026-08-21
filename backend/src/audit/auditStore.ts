import { db } from "../db/client.js";

export interface AuditRecord {
  id?: number;
  timestamp: string;
  query: string;
  decisionType: string;
  postureKind: string;
  classificationConfidence: number;
  classificationRationale: string;
  allowedReasoning: number; // SQLite has no boolean; 0/1
  toolCalls: string; // JSON-stringified array of { tool, input, output }
  response: string;
}

export async function insertAuditRecord(record: AuditRecord): Promise<number> {
  const result = await db.execute({
    sql: `INSERT INTO audit_log (
      timestamp, query, decision_type, posture_kind, classification_confidence,
      classification_rationale, allowed_reasoning, tool_calls, response
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      record.timestamp,
      record.query,
      record.decisionType,
      record.postureKind,
      record.classificationConfidence,
      record.classificationRationale,
      record.allowedReasoning,
      record.toolCalls,
      record.response,
    ],
  });
  return Number(result.lastInsertRowid);
}

export async function listAuditRecords(limit = 100): Promise<AuditRecord[]> {
  const result = await db.execute({
    sql: `SELECT * FROM audit_log ORDER BY id DESC LIMIT ?`,
    args: [limit],
  });
  return result.rows.map((r) => ({
    id: r.id as number,
    timestamp: r.timestamp as string,
    query: r.query as string,
    decisionType: r.decision_type as string,
    postureKind: r.posture_kind as string,
    classificationConfidence: r.classification_confidence as number,
    classificationRationale: r.classification_rationale as string,
    allowedReasoning: r.allowed_reasoning as number,
    toolCalls: r.tool_calls as string,
    response: r.response as string,
  }));
}

/** Separate from AuditRecord/audit_log above — a KPI save is a different
 * shape of event (who/what was saved, not a guardrail decision), so it gets
 * its own table rather than being force-fit into the guardrail columns. */
export interface KpiAuditRecord {
  id?: number;
  timestamp: string;
  kind: "initial" | "revision" | "objectivity_override";
  kpiSetId: number;
  employeeId: string;
  employeeName: string;
  savedById: string;
  savedByName: string;
  // JSON-stringified payload — shape depends on `kind`: the full KpiItem[]
  // for "initial"/"revision", or an ObjectivityOverrideItem[] (see
  // auditLogger.ts) for "objectivity_override" — only the KRAs that were
  // still failing at the moment a manager clicked "Finalize anyway".
  items: string;
}

export async function insertKpiAuditRecord(record: KpiAuditRecord): Promise<number> {
  const result = await db.execute({
    sql: `INSERT INTO kpi_audit_log (
      timestamp, kind, kpi_set_id, employee_id, employee_name, saved_by_id, saved_by_name, items_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      record.timestamp,
      record.kind,
      record.kpiSetId,
      record.employeeId,
      record.employeeName,
      record.savedById,
      record.savedByName,
      record.items,
    ],
  });
  return Number(result.lastInsertRowid);
}

export async function listKpiAuditRecords(limit = 100): Promise<KpiAuditRecord[]> {
  const result = await db.execute({
    sql: `SELECT * FROM kpi_audit_log ORDER BY id DESC LIMIT ?`,
    args: [limit],
  });
  return result.rows.map((r) => ({
    id: r.id as number,
    timestamp: r.timestamp as string,
    kind: r.kind as "initial" | "revision" | "objectivity_override",
    kpiSetId: r.kpi_set_id as number,
    employeeId: r.employee_id as string,
    employeeName: r.employee_name as string,
    savedById: r.saved_by_id as string,
    savedByName: r.saved_by_name as string,
    items: r.items_json as string,
  }));
}
