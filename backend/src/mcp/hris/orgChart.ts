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
