import { EMPLOYEES, type Employee } from "./data/seed.js";

export interface ReporteeNode {
  employeeId: string;
  name: string;
  role: string;
  team: string;
  depth: number; // 1 = direct report, 2 = reports-to-a-direct-report, etc.
  directReportCount: number;
  reports: ReporteeNode[];
}

/**
 * Employees who manage at least one other active employee — the set Phase
 * 0's manager picker draws from, standing in for "who is logged in" until a
 * real auth system exists.
 */
export function listManagers(): Employee[] {
  const managerIds = new Set(EMPLOYEES.filter((e) => e.manager).map((e) => e.manager as string));
  return EMPLOYEES.filter((e) => managerIds.has(e.employeeId) && e.status === "active");
}

/**
 * Direct + indirect reportees of a manager, as a tree. Walks the flat
 * `manager` pointer in the HRIS data recursively — a real HRIS connector
 * would likely expose this as a single endpoint instead, in which case this
 * function is what gets replaced in Phase 1, not its callers.
 *
 * Cycle-safe: the real sheet has at least one employee listed as their own
 * manager (and reporting-chain cycles in general aren't something to trust
 * a spreadsheet to be free of), so each branch tracks the IDs already seen
 * on its path from the root and stops rather than recursing forever.
 */
export function getReporteeTree(managerId: string): ReporteeNode[] {
  function childrenOf(id: string, depth: number, seen: ReadonlySet<string>): ReporteeNode[] {
    return EMPLOYEES.filter((e) => e.manager === id && e.status === "active" && !seen.has(e.employeeId)).map(
      (e) => {
        const nextSeen = new Set(seen);
        nextSeen.add(e.employeeId);
        const reports = childrenOf(e.employeeId, depth + 1, nextSeen);
        return {
          employeeId: e.employeeId,
          name: e.name,
          role: e.role,
          team: e.team,
          depth,
          directReportCount: reports.length,
          reports,
        };
      },
    );
  }
  return childrenOf(managerId, 1, new Set([managerId]));
}

/** Flattens a reportee tree into a single list, e.g. for a dropdown. */
export function flattenReporteeTree(nodes: ReporteeNode[]): ReporteeNode[] {
  return nodes.flatMap((n) => [n, ...flattenReporteeTree(n.reports)]);
}

/** Whether `employeeId` is anywhere in `managerId`'s direct/indirect reportee tree. */
export function isReporteeOf(managerId: string, employeeId: string): boolean {
  return flattenReporteeTree(getReporteeTree(managerId)).some((n) => n.employeeId === employeeId);
}

/**
 * Whether `employeeId` is a DIRECT report of `managerId` only (depth 1) —
 * narrower than isReporteeOf, which includes the whole recursive chain.
 * getReporteeTree's own top-level return value is already just the direct
 * reports, so no depth-field check is needed here.
 */
export function isDirectReportOf(managerId: string, employeeId: string): boolean {
  return getReporteeTree(managerId).some((n) => n.employeeId === employeeId);
}

/**
 * The authorization check for every KRA/KPI EDIT action (drafting, saving,
 * starting a drafting chat): a manager may act on their own record, or a
 * DIRECT report's — not an indirect one, per PRD v3 §6. An admin may act on
 * anyone's; a Business Partner may act on anyone whose HRIS Function is in
 * their scope, regardless of reporting line. Indirect reports are read-only
 * — see canViewKrasFor for that broader, view-only check.
 */
export function canSetKrasFor(
  managerId: string,
  employeeId: string,
  isAdmin: boolean,
  bpFunctions: string[] = [],
): boolean {
  if (isAdmin || employeeId === managerId || isDirectReportOf(managerId, employeeId)) return true;
  if (bpFunctions.length === 0) return false;
  const employee = EMPLOYEES.find((e) => e.employeeId === employeeId);
  return employee !== undefined && bpFunctions.includes(employee.team);
}

/**
 * The authorization check for VIEWING (never editing) saved KPI sets: self,
 * anyone in the full recursive reporting chain (direct or indirect — the
 * "skip-level read access" case from PRD v3 §6), an admin, or a BP in
 * scope. Same shape as canSetKrasFor but with the full chain instead of
 * direct-reports-only. Anyone this returns true for who ISN'T ALSO covered
 * by canSetKrasFor (i.e. an indirect report) gets read-only access only —
 * call sites must not use this to gate a draft/save/chat-creation action.
 */
export function canViewKrasFor(
  managerId: string,
  employeeId: string,
  isAdmin: boolean,
  bpFunctions: string[] = [],
): boolean {
  if (isAdmin || employeeId === managerId || isReporteeOf(managerId, employeeId)) return true;
  if (bpFunctions.length === 0) return false;
  const employee = EMPLOYEES.find((e) => e.employeeId === employeeId);
  return employee !== undefined && bpFunctions.includes(employee.team);
}
