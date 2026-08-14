import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";

const dbPath = process.env.AUTH_DB_PATH ?? "./data/auth.sqlite";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");

// One row per manager who's been given a password — deliberately separate
// from the HRIS EMPLOYEES data (which is re-fetched from the Google Sheet
// wholesale on a timer and has no business holding secrets).
db.exec(`
  CREATE TABLE IF NOT EXISTS manager_credentials (
    employee_id TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const upsertStmt = db.prepare(`
  INSERT INTO manager_credentials (employee_id, password_hash, updated_at)
  VALUES (@employeeId, @passwordHash, @updatedAt)
  ON CONFLICT(employee_id) DO UPDATE SET password_hash = excluded.password_hash, updated_at = excluded.updated_at
`);

const selectStmt = db.prepare(`SELECT password_hash FROM manager_credentials WHERE employee_id = ?`);

export function setPasswordHash(employeeId: string, passwordHash: string): void {
  upsertStmt.run({ employeeId, passwordHash, updatedAt: new Date().toISOString() });
}

export function getPasswordHash(employeeId: string): string | null {
  const row = selectStmt.get(employeeId) as { password_hash: string } | undefined;
  return row ? row.password_hash : null;
}
