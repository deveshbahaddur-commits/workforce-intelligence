import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import type { ChatSession, ChatSessionKind, ChatSessionMessage, ChatSessionSummary } from "./types.js";

const dbPath = process.env.CHAT_DB_PATH ?? "./data/chat.sqlite";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
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

db.exec(`
  CREATE TABLE IF NOT EXISTS chat_session_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL,
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
  );
`);

const insertSessionStmt = db.prepare(`
  INSERT INTO chat_sessions (kind, manager_id, employee_id, title, created_at, updated_at)
  VALUES (@kind, @managerId, @employeeId, @title, @createdAt, @updatedAt)
`);

const selectSessionByIdStmt = db.prepare(`SELECT * FROM chat_sessions WHERE id = ?`);

const selectSessionsStmt = db.prepare(`
  SELECT * FROM chat_sessions
  WHERE kind = ? AND manager_id = ? AND (
    (? IS NULL AND employee_id IS NULL) OR employee_id = ?
  )
  ORDER BY updated_at DESC
`);

const deleteMessagesStmt = db.prepare(`DELETE FROM chat_session_messages WHERE session_id = ?`);

const insertMessageStmt = db.prepare(`
  INSERT INTO chat_session_messages (session_id, sort_order, role, text)
  VALUES (@sessionId, @sortOrder, @role, @text)
`);

const selectMessagesStmt = db.prepare(
  `SELECT * FROM chat_session_messages WHERE session_id = ? ORDER BY sort_order ASC`,
);

const updateSessionStmt = db.prepare(`
  UPDATE chat_sessions SET title = @title, updated_at = @updatedAt WHERE id = @id
`);

function rowToSummary(r: Record<string, unknown>): ChatSessionSummary {
  return {
    id: r.id as number,
    kind: r.kind as ChatSessionKind,
    managerId: r.manager_id as string,
    employeeId: (r.employee_id as string | null) ?? null,
    title: (r.title as string | null) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

function deriveTitle(messages: ChatSessionMessage[]): string | null {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return null;
  const text = firstUser.text.trim();
  return text.length > 60 ? `${text.slice(0, 60)}…` : text || null;
}

export function createSession(params: {
  kind: ChatSessionKind;
  managerId: string;
  employeeId: string | null;
}): ChatSession {
  const now = new Date().toISOString();
  const info = insertSessionStmt.run({
    kind: params.kind,
    managerId: params.managerId,
    employeeId: params.employeeId,
    title: null,
    createdAt: now,
    updatedAt: now,
  });
  const id = Number(info.lastInsertRowid);
  const row = selectSessionByIdStmt.get(id) as Record<string, unknown>;
  return { ...rowToSummary(row), messages: [] };
}

export function listSessions(params: {
  kind: ChatSessionKind;
  managerId: string;
  employeeId: string | null;
}): ChatSessionSummary[] {
  const rows = selectSessionsStmt.all(
    params.kind,
    params.managerId,
    params.employeeId,
    params.employeeId,
  ) as Array<Record<string, unknown>>;
  return rows.map(rowToSummary);
}

export function getSession(id: number): ChatSession | null {
  const row = selectSessionByIdStmt.get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  const messageRows = selectMessagesStmt.all(id) as Array<Record<string, unknown>>;
  const messages: ChatSessionMessage[] = messageRows.map((m) => ({
    role: m.role as "user" | "model",
    text: m.text as string,
  }));
  return { ...rowToSummary(row), messages };
}

export function replaceMessages(id: number, messages: ChatSessionMessage[]): ChatSession | null {
  const existing = selectSessionByIdStmt.get(id) as Record<string, unknown> | undefined;
  if (!existing) return null;

  deleteMessagesStmt.run(id);
  messages.forEach((m, index) => {
    insertMessageStmt.run({ sessionId: id, sortOrder: index, role: m.role, text: m.text });
  });

  const now = new Date().toISOString();
  const title = (existing.title as string | null) ?? deriveTitle(messages);
  updateSessionStmt.run({ id, title, updatedAt: now });

  return getSession(id);
}
