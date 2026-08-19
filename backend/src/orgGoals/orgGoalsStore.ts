import { db } from "../db/client.js";
import type { OrgGoalSet, OrgGoalItem } from "./types.js";
import type { Row } from "@libsql/client";

function rowToSet(r: Row): OrgGoalSet {
  return {
    id: r.id as number,
    content: JSON.parse(r.content_json as string),
    createdBy: r.created_by as string,
    createdByName: r.created_by_name as string,
    createdAt: r.created_at as string,
  };
}

/** Every save is a new row — "current" is just the most recent one, no separate version/active flag needed. */
export async function saveOrgGoals(params: {
  content: OrgGoalItem[];
  createdBy: string;
  createdByName: string;
}): Promise<OrgGoalSet> {
  const createdAt = new Date().toISOString();
  const result = await db.execute({
    sql: `INSERT INTO org_goals (content_json, created_by, created_by_name, created_at) VALUES (?, ?, ?, ?)`,
    args: [JSON.stringify(params.content), params.createdBy, params.createdByName, createdAt],
  });
  const id = Number(result.lastInsertRowid);
  const row = await db.execute({ sql: `SELECT * FROM org_goals WHERE id = ?`, args: [id] });
  return rowToSet(row.rows[0]);
}

export async function getCurrentOrgGoals(): Promise<OrgGoalSet | null> {
  const row = await db.execute(`SELECT * FROM org_goals ORDER BY id DESC LIMIT 1`);
  return row.rows.length > 0 ? rowToSet(row.rows[0]) : null;
}
