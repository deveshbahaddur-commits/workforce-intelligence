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
 * `manager` pointer in the mock HRIS data recursively — a real HRIS
 * connector would likely expose this as a single endpoint instead, in which
 * case this function is what gets replaced in Phase 1, not its callers.
 */
export function getReporteeTree(managerId: string): ReporteeNode[] {
  function childrenOf(id: string, depth: number): ReporteeNode[] {
    return EMPLOYEES.filter((e) => e.manager === id && e.status === "active").map((e) => {
      const reports = childrenOf(e.employeeId, depth + 1);
      return {
        employeeId: e.employeeId,
        name: e.name,
        role: e.role,
        team: e.team,
        depth,
        directReportCount: reports.length,
        reports,
      };
    });
  }
  return childrenOf(managerId, 1);
}

/** Flattens a reportee tree into a single list, e.g. for a dropdown. */
export function flattenReporteeTree(nodes: ReporteeNode[]): ReporteeNode[] {
  return nodes.flatMap((n) => [n, ...flattenReporteeTree(n.reports)]);
}
