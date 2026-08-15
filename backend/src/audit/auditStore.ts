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
