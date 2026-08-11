import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

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

const dbPath = process.env.AUDIT_DB_PATH ?? "./data/audit.sqlite";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// Uses Node's built-in node:sqlite (stable since Node 22.5, no native
// compilation required) instead of better-sqlite3 — this environment's
// Python/build-tools setup couldn't compile better-sqlite3's native binding
// for this Node version, and node:sqlite avoids that class of problem
// entirely while keeping the same SQLite-backed audit log.
const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    query TEXT NOT NULL,
    decision_type TEXT NOT NULL,
    posture_kind TEXT NOT NULL,
    classification_confidence REAL NOT NULL,
    classification_rationale TEXT NOT NULL,
    allowed_reasoning INTEGER NOT NULL,
    tool_calls TEXT NOT NULL,
    response TEXT NOT NULL
  );
`);

const insertStmt = db.prepare(`
  INSERT INTO audit_log (
    timestamp, query, decision_type, posture_kind, classification_confidence,
    classification_rationale, allowed_reasoning, tool_calls, response
  ) VALUES (
    @timestamp, @query, @decisionType, @postureKind, @classificationConfidence,
    @classificationRationale, @allowedReasoning, @toolCalls, @response
  )
`);

const selectRecentStmt = db.prepare(`SELECT * FROM audit_log ORDER BY id DESC LIMIT ?`);

export function insertAuditRecord(record: AuditRecord): number {
  // node:sqlite rejects bind objects that carry keys with no matching named
  // parameter in the SQL (unlike better-sqlite3, which ignores them) — so
  // this must list exactly the @-params above, not spread `record` as-is.
  const info = insertStmt.run({
    timestamp: record.timestamp,
    query: record.query,
    decisionType: record.decisionType,
    postureKind: record.postureKind,
    classificationConfidence: record.classificationConfidence,
    classificationRationale: record.classificationRationale,
    allowedReasoning: record.allowedReasoning,
    toolCalls: record.toolCalls,
    response: record.response,
  });
  return Number(info.lastInsertRowid);
}

export function listAuditRecords(limit = 100): AuditRecord[] {
  const rows = selectRecentStmt.all(limit) as Array<Record<string, unknown>>;
  return rows.map((r) => ({
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
