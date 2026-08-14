import Papa from "papaparse";

/**
 * Live HRIS data, loaded from Recykal's master employee Google Sheet. This
 * is the Phase 1 swap the mock dataset was always meant to be replaced by —
 * tools.ts, orgChart.ts, and every consumer of EMPLOYEES is unchanged.
 *
 * Deliberately NOT loaded, by design: mobile number, personal email, DOB,
 * gender. The sheet has them; this app has no feature that needs them, and
 * they should never be in memory for the chat agent to reference. There's
 * also no compensation column in the source sheet, so `annualCostUsd` and
 * the get_cost_summary tool were removed rather than left fabricating
 * numbers against real employees — see mcp/hris/tools.ts.
 *
 * `email` (from "Official Mail ID") IS loaded — unlike the excluded PII
 * columns above, it's the join key auth/googleAuth.ts uses to turn a
 * verified Google sign-in into "which employee is this," so it has to be
 * in memory. It's a work email, not personal data.
 */
export interface Employee {
  employeeId: string;
  name: string;
  role: string;
  team: string;
  manager: string | null;
  tenureMonths: number;
  status: "active";
  location: string;
  email: string;
}

const SHEET_ID = process.env.HRIS_SHEET_ID;
const SHEET_GID = process.env.HRIS_SHEET_GID ?? "0";
const CACHE_TTL_MS = Number(process.env.HRIS_SHEET_CACHE_TTL_MS ?? 5 * 60 * 1000);

const MONTH_INDEX: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

/** Parses the sheet's "D-MMM-YYYY" DOJ format (e.g. "15-Nov-2021") into tenure in months. */
function tenureMonthsSinceDoj(doj: string): number {
  const match = doj.trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (!match) return 0;
  const [, day, monAbbr, year] = match;
  const month = MONTH_INDEX[monAbbr];
  if (month === undefined) return 0;

  const joined = new Date(Number(year), month, Number(day));
  const now = new Date();
  let months = (now.getFullYear() - joined.getFullYear()) * 12 + (now.getMonth() - joined.getMonth());
  if (now.getDate() < joined.getDate()) months -= 1;
  return Math.max(0, months);
}

function parseSheet(csv: string): Employee[] {
  const { data } = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });

  return data
    .filter((row) => (row["Status"] ?? "").trim() === "Active")
    .map((row): Employee => ({
      employeeId: (row["Emp Id"] ?? "").trim(),
      name: (row["Employee Name"] ?? "").trim(),
      role: (row["Designation"] ?? "").trim() || "Unknown",
      team: (row["Function"] ?? "").trim() || "Unknown",
      manager: (row["Reporting Manager Id"] ?? "").trim() || null,
      tenureMonths: tenureMonthsSinceDoj(row["DOJ"] ?? ""),
      status: "active",
      location: (row["Record Location"] ?? "").trim() || "Unknown",
      email: (row["Official Mail ID"] ?? "").trim().toLowerCase(),
    }))
    .filter((e) => e.employeeId && e.name);
}

async function fetchSheetCsv(): Promise<string> {
  if (!SHEET_ID) {
    throw new Error("HRIS_SHEET_ID is not set — cannot load employee data.");
  }
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch HRIS sheet (status ${res.status}). Is it still shared as "Anyone with the link"?`);
  }
  return res.text();
}

// Mutable by design: refreshed in place so every existing consumer
// (tools.ts, orgChart.ts, server.ts, kpiAgentRunner.ts) keeps reading it as
// a plain synchronous array — only this module knows the data is live.
export let EMPLOYEES: Employee[] = [];

let refreshTimer: ReturnType<typeof setInterval> | null = null;

async function refresh(): Promise<void> {
  const csv = await fetchSheetCsv();
  EMPLOYEES = parseSheet(csv);
  console.log(`[hris] Loaded ${EMPLOYEES.length} active employees from the HRIS sheet.`);
}

/**
 * Fetches once (blocking — call and await at server startup so the first
 * requests don't race an empty EMPLOYEES array), then refreshes in the
 * background on an interval regardless of whether that first fetch
 * succeeded — so a startup-time failure (network blip, sharing not yet
 * propagated) keeps retrying instead of leaving EMPLOYEES empty until a
 * manual restart. A failed background refresh is logged and keeps serving
 * whatever was last successfully loaded (possibly still nothing).
 */
export async function initHrisData(): Promise<void> {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    refresh().catch((err) => console.error("[hris] Background refresh failed, keeping stale data:", err));
  }, CACHE_TTL_MS);

  await refresh();
}
