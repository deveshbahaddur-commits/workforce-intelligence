import { db } from "../db/client.js";
import type { KpiItem, KpiSet } from "./types.js";
import type { Row } from "@libsql/client";

function rowToItem(r: Row): KpiItem {
  return {
    role: r.role as string,
    kra: r.kra as string,
    goalAnnual: r.goal_annual as string,
    goalH1: r.goal_h1 as string,
    goalH2: r.goal_h2 as string,
    kpiTask: r.kpi_task as string,
    weightagePercent: r.weightage_percent as number,
    sourceOfTracking: r.source_of_tracking as string,
    ratingNeedsImprovement: r.rating_needs_improvement as string,
    ratingBelowExpectation: r.rating_below_expectation as string,
    ratingMeetsExpectation: r.rating_meets_expectation as string,
    ratingAboveExpectation: r.rating_above_expectation as string,
    ratingExceedsExpectation: r.rating_exceeds_expectation as string,
    metrics: JSON.parse(r.metrics_json as string),
    checklist: JSON.parse(r.checklist_json as string),
    defined: Boolean(r.defined),
  };
}

function rowToSet(r: Row, items: KpiItem[]): KpiSet {
  return {
    id: r.id as number,
    employeeId: r.employee_id as string,
    employeeName: r.employee_name as string,
    managerId: r.manager_id as string,
    managerName: r.manager_name as string,
    createdAt: r.created_at as string,
    items,
  };
}

export async function saveKpiSet(params: {
  employeeId: string;
  employeeName: string;
  managerId: string;
  managerName: string;
  items: KpiItem[];
}): Promise<KpiSet> {
  const createdAt = new Date().toISOString();
  const setResult = await db.execute({
    sql: `INSERT INTO kpi_sets (employee_id, employee_name, manager_id, manager_name, created_at) VALUES (?, ?, ?, ?, ?)`,
    args: [params.employeeId, params.employeeName, params.managerId, params.managerName, createdAt],
  });
  const setId = Number(setResult.lastInsertRowid);

  if (params.items.length > 0) {
    await db.batch(
      params.items.map((item, index) => ({
        sql: `INSERT INTO kpi_items (
          set_id, sort_order, role, kra, goal_annual, goal_h1, goal_h2, kpi_task, weightage_percent,
          source_of_tracking, rating_needs_improvement, rating_below_expectation, rating_meets_expectation,
          rating_above_expectation, rating_exceeds_expectation, metrics_json, checklist_json, defined
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          setId,
          index,
          item.role,
          item.kra,
          item.goalAnnual,
          item.goalH1,
          item.goalH2,
          item.kpiTask,
          item.weightagePercent,
          item.sourceOfTracking,
          item.ratingNeedsImprovement,
          item.ratingBelowExpectation,
          item.ratingMeetsExpectation,
          item.ratingAboveExpectation,
          item.ratingExceedsExpectation,
          JSON.stringify(item.metrics ?? []),
          JSON.stringify(item.checklist ?? []),
          item.defined ? 1 : 0,
        ],
      })),
      "write",
    );
  }

  const setRow = await db.execute({ sql: `SELECT * FROM kpi_sets WHERE id = ?`, args: [setId] });
  return rowToSet(setRow.rows[0], params.items);
}

export async function listKpiSetsForEmployee(employeeId: string): Promise<KpiSet[]> {
  const setRows = await db.execute({
    sql: `SELECT * FROM kpi_sets WHERE employee_id = ? ORDER BY id DESC`,
    args: [employeeId],
  });
  return hydrateSets(setRows.rows);
}

/** Admin-only: every saved KPI set across the whole org, newest first. */
export async function listAllKpiSets(): Promise<KpiSet[]> {
  const setRows = await db.execute(`SELECT * FROM kpi_sets ORDER BY id DESC`);
  return hydrateSets(setRows.rows);
}

async function hydrateSets(setRows: Row[]): Promise<KpiSet[]> {
  const sets: KpiSet[] = [];
  for (const setRow of setRows) {
    const itemRows = await db.execute({
      sql: `SELECT * FROM kpi_items WHERE set_id = ? ORDER BY sort_order ASC`,
      args: [setRow.id as number],
    });
    sets.push(rowToSet(setRow, itemRows.rows.map(rowToItem)));
  }
  return sets;
}
