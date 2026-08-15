/**
 * Admin tool: set or reset a manager's login password. Not exposed via any
 * route — run directly (see package.json's "set-password" script), since
 * there's no self-service signup or reset flow by design.
 *
 * Usage: npm run set-password -- someone@recykal.com "TempPass123"
 */
import { EMPLOYEES, initHrisData } from "../mcp/hris/data/seed.js";
import { setPasswordHash } from "../auth/credentialStore.js";
import { hashPassword } from "../auth/passwordHash.js";
import { initSchema } from "../db/schema.js";

const [, , emailArg, passwordArg] = process.argv;

if (!emailArg || !passwordArg) {
  console.error('Usage: npm run set-password -- <official-email> "<password>"');
  process.exit(1);
}

if (passwordArg.length < 8) {
  console.error("Password must be at least 8 characters.");
  process.exit(1);
}

await initSchema();
await initHrisData();

const email = emailArg.trim().toLowerCase();
const employee = EMPLOYEES.find((e) => e.email === email);

if (!employee) {
  console.error(`No active employee found with Official Mail ID "${email}". Check the sheet and try again.`);
  process.exit(1);
}

await setPasswordHash(employee.employeeId, hashPassword(passwordArg));
console.log(`Password set for ${employee.name} (${employee.employeeId}, ${employee.role}). Share it with them directly.`);
process.exit(0);
