import { db } from "../db/client.js";
import type { Row } from "@libsql/client";
import type { ChatSession, ChatSessionKind, ChatSessionMessage, ChatSessionSummary } from "./types.js";

function rowToSummary(r: Row): ChatSessionSummary {
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

export async function createSession(params: {
  kind: ChatSessionKind;
  managerId: string;
  employeeId: string | null;
}): Promise<ChatSession> {
  const now = new Date().toISOString();
  const result = await db.execute({
    sql: `INSERT INTO chat_sessions (kind, manager_id, employee_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [params.kind, params.managerId, params.employeeId, null, now, now],
  });
  const id = Number(result.lastInsertRowid);
  const row = await db.execute({ sql: `SELECT * FROM chat_sessions WHERE id = ?`, args: [id] });
  return { ...rowToSummary(row.rows[0]), messages: [] };
}

export async function listSessions(params: {
  kind: ChatSessionKind;
  managerId: string;
  employeeId: string | null;
}): Promise<ChatSessionSummary[]> {
  const result = await db.execute({
    sql: `SELECT * FROM chat_sessions
          WHERE kind = ? AND manager_id = ? AND (
            (? IS NULL AND employee_id IS NULL) OR employee_id = ?
          )
          ORDER BY updated_at DESC`,
    args: [params.kind, params.managerId, params.employeeId, params.employeeId],
  });
  return result.rows.map(rowToSummary);
}

export async function getSession(id: number): Promise<ChatSession | null> {
  const row = await db.execute({ sql: `SELECT * FROM chat_sessions WHERE id = ?`, args: [id] });
  if (row.rows.length === 0) return null;
  const messageRows = await db.execute({
    sql: `SELECT * FROM chat_session_messages WHERE session_id = ? ORDER BY sort_order ASC`,
    args: [id],
  });
  const messages: ChatSessionMessage[] = messageRows.rows.map((m) => ({
    role: m.role as "user" | "model",
    text: m.text as string,
  }));
  return { ...rowToSummary(row.rows[0]), messages };
}

export async function replaceMessages(id: number, messages: ChatSessionMessage[]): Promise<ChatSession | null> {
  const existingRow = await db.execute({ sql: `SELECT * FROM chat_sessions WHERE id = ?`, args: [id] });
  if (existingRow.rows.length === 0) return null;
  const existing = existingRow.rows[0];

  await db.execute({ sql: `DELETE FROM chat_session_messages WHERE session_id = ?`, args: [id] });
  if (messages.length > 0) {
    await db.batch(
      messages.map((m, index) => ({
        sql: `INSERT INTO chat_session_messages (session_id, sort_order, role, text) VALUES (?, ?, ?, ?)`,
        args: [id, index, m.role, m.text],
      })),
      "write",
    );
  }

  const now = new Date().toISOString();
  const title = (existing.title as string | null) ?? deriveTitle(messages);
  await db.execute({
    sql: `UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?`,
    args: [title, now, id],
  });

  return getSession(id);
}
