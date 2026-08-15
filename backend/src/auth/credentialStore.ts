import { db } from "../db/client.js";

export async function setPasswordHash(employeeId: string, passwordHash: string): Promise<void> {
  await db.execute({
    sql: `INSERT INTO manager_credentials (employee_id, password_hash, updated_at)
          VALUES (?, ?, ?)
          ON CONFLICT(employee_id) DO UPDATE SET password_hash = excluded.password_hash, updated_at = excluded.updated_at`,
    args: [employeeId, passwordHash, new Date().toISOString()],
  });
}

export async function getPasswordHash(employeeId: string): Promise<string | null> {
  const result = await db.execute({
    sql: `SELECT password_hash FROM manager_credentials WHERE employee_id = ?`,
    args: [employeeId],
  });
  return result.rows[0] ? (result.rows[0].password_hash as string) : null;
}
