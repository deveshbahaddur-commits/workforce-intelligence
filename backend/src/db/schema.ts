import { db } from "./client.js";

/** Idempotent — safe to call on every startup. Awaited once before the server starts accepting requests. */
export async function initSchema(): Promise<void> {
  await db.execute(`
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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS kpi_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      manager_id TEXT NOT NULL,
      manager_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS kpi_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      set_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      role TEXT NOT NULL,
      kra TEXT NOT NULL,
      goal_annual TEXT NOT NULL,
      goal_h1 TEXT NOT NULL,
      goal_h2 TEXT NOT NULL,
      kpi_task TEXT NOT NULL,
      weightage_percent REAL NOT NULL,
      source_of_tracking TEXT NOT NULL,
      rating_needs_improvement TEXT NOT NULL,
      rating_below_expectation TEXT NOT NULL,
      rating_meets_expectation TEXT NOT NULL,
      rating_above_expectation TEXT NOT NULL,
      rating_exceeds_expectation TEXT NOT NULL,
      metrics_json TEXT NOT NULL,
      checklist_json TEXT NOT NULL,
      defined INTEGER NOT NULL,
      FOREIGN KEY (set_id) REFERENCES kpi_sets(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      manager_id TEXT NOT NULL,
      employee_id TEXT,
      title TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_session_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      role TEXT NOT NULL,
      text TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS manager_credentials (
      employee_id TEXT PRIMARY KEY,
      password_hash TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS kpi_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      kind TEXT NOT NULL,
      kpi_set_id INTEGER NOT NULL,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      saved_by_id TEXT NOT NULL,
      saved_by_name TEXT NOT NULL,
      items_json TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS org_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_json TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
}
