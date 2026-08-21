/**
 * Read-only: reports how many existing kpi_sets rows would violate the new
 * count (3-7 KRAs) or weightage-sum (=100%) rules from kpi/kpiSetValidation.ts,
 * had that validation existed when they were saved. Issues no writes.
 *
 * Usage: npm run audit-kpi-violations
 */
import { listAllKpiSets } from "../kpi/kpiStore.js";
import { validateKpiSet } from "../kpi/kpiSetValidation.js";

const sets = await listAllKpiSets();

let violatingCount = 0;
const details: string[] = [];

for (const set of sets) {
  const violations = validateKpiSet(set.items);
  if (violations.length > 0) {
    violatingCount++;
    details.push(
      `  set #${set.id} — ${set.employeeName} (${set.employeeId}), saved ${set.createdAt}, ${set.items.length} KRAs\n` +
        violations.map((v) => `    - ${v}`).join("\n"),
    );
  }
}

console.log(`Total kpi_sets rows: ${sets.length}`);
console.log(`Violating either rule: ${violatingCount}`);
console.log(`Clean: ${sets.length - violatingCount}`);
if (details.length > 0) {
  console.log(`\nDetails:\n${details.join("\n")}`);
}
