import type { KpiItem } from "./types.js";

const MIN_KRAS = 3;
const MAX_KRAS = 7;
const REQUIRED_WEIGHTAGE_SUM = 100;

/**
 * Deterministic — no LLM involved. Weightage is floating-point (e.g. three
 * KRAs at 33.33/33.33/33.34), so the sum is rounded to 2 decimal places
 * before comparing to 100 to absorb binary floating-point rounding noise
 * (0.1 + 0.2 !== 0.3) without weakening the "must be exactly 100" rule
 * itself — a set that's actually off by a whole point or more still fails.
 */
function roundedWeightageSum(items: KpiItem[]): number {
  const sum = items.reduce((total, item) => total + item.weightagePercent, 0);
  return Math.round(sum * 100) / 100;
}

/**
 * Validates one KPI set (all KRA rows submitted together for one employee)
 * before it's persisted. Returns a list of violation messages — empty means
 * the set is valid. Call sites decide how to surface multiple violations at
 * once (see POST /api/kpi/sets in server.ts).
 */
export function validateKpiSet(items: KpiItem[]): string[] {
  const violations: string[] = [];

  if (items.length < MIN_KRAS || items.length > MAX_KRAS) {
    violations.push(`A KPI set must have ${MIN_KRAS}-${MAX_KRAS} KRAs — this one has ${items.length}.`);
  }

  const sum = roundedWeightageSum(items);
  if (sum !== REQUIRED_WEIGHTAGE_SUM) {
    violations.push(`Weightage across all KRAs must sum to exactly ${REQUIRED_WEIGHTAGE_SUM}% — this set sums to ${sum}%.`);
  }

  return violations;
}
