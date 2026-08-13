import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import type { KpiItem, KpiSet } from "./types.js";

const dbPath = process.env.KPI_DB_PATH ?? "./data/kpi.sqlite";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec("PRAGMA journal_mode = WAL;");

db.exec(`
  CREATE TABLE IF NOT EXISTS kpi_sets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id TEXT NOT NULL,
    employee_name TEXT NOT NULL,
    manager_id TEXT NOT NULL,
    manager_name TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

// metrics_json / checklist_json hold KraMetric[] / KraChecklistItem[] as
// JSON text — both are small, per-row, always read/written whole, so a
// child table would only add join complexity with no real benefit here.
db.exec(`
  CREATE TABLE IF NOT EXISTS kpi_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    set_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL,
    role TEXT NOT NULL,
    kra TEXT NOT NULL,
    goal_annual TEXT NOT NULL,
    goal_h1 TEXT NOT NULL,
    goal_h2 TEXT NOT NULL,
    kpi_task TEXT NOT NULL,
    weightage_percent REAL NOT NULL,
    source_of_tracking TEXT NOT NULL,
    rating_needs_improvement TEXT NOT NULL,
    rating_below_expectation TEXT NOT NULL,
    rating_meets_expectation TEXT NOT NULL,
    rating_above_expectation TEXT NOT NULL,
    rating_exceeds_expectation TEXT NOT NULL,
    metrics_json TEXT NOT NULL,
    checklist_json TEXT NOT NULL,
    defined INTEGER NOT NULL,
    FOREIGN KEY (set_id) REFERENCES kpi_sets(id)
  );
`);

const insertSetStmt = db.prepare(`
  INSERT INTO kpi_sets (employee_id, employee_name, manager_id, manager_name, created_at)
  VALUES (@employeeId, @employeeName, @managerId, @managerName, @createdAt)
`);

const insertItemStmt = db.prepare(`
  INSERT INTO kpi_items (
    set_id, sort_order, role, kra, goal_annual, goal_h1, goal_h2, kpi_task, weightage_percent,
    source_of_tracking, rating_needs_improvement, rating_below_expectation, rating_meets_expectation,
    rating_above_expectation, rating_exceeds_expectation, metrics_json, checklist_json, defined
  ) VALUES (
    @setId, @sortOrder, @role, @kra, @goalAnnual, @goalH1, @goalH2, @kpiTask, @weightagePercent,
    @sourceOfTracking, @ratingNeedsImprovement, @ratingBelowExpectation, @ratingMeetsExpectation,
    @ratingAboveExpectation, @ratingExceedsExpectation, @metricsJson, @checklistJson, @defined
  )
`);

const selectSetsForEmployeeStmt = db.prepare(
  `SELECT * FROM kpi_sets WHERE employee_id = ? ORDER BY id DESC`,
);
const selectItemsForSetStmt = db.prepare(`SELECT * FROM kpi_items WHERE set_id = ? ORDER BY sort_order ASC`);
const selectSetByIdStmt = db.prepare(`SELECT * FROM kpi_sets WHERE id = ?`);

function rowToItem(r: Record<string, unknown>): KpiItem {
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

function rowToSet(r: Record<string, unknown>, items: KpiItem[]): KpiSet {
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

export function saveKpiSet(params: {
  employeeId: string;
  employeeName: string;
  managerId: string;
  managerName: string;
  items: KpiItem[];
}): KpiSet {
  const createdAt = new Date().toISOString();
  const info = insertSetStmt.run({
    employeeId: params.employeeId,
    employeeName: params.employeeName,
    managerId: params.managerId,
    managerName: params.managerName,
    createdAt,
  });
  const setId = Number(info.lastInsertRowid);

  params.items.forEach((item, index) => {
    insertItemStmt.run({
      setId,
      sortOrder: index,
      role: item.role,
      kra: item.kra,
      goalAnnual: item.goalAnnual,
      goalH1: item.goalH1,
      goalH2: item.goalH2,
      kpiTask: item.kpiTask,
      weightagePercent: item.weightagePercent,
      sourceOfTracking: item.sourceOfTracking,
      ratingNeedsImprovement: item.ratingNeedsImprovement,
      ratingBelowExpectation: item.ratingBelowExpectation,
      ratingMeetsExpectation: item.ratingMeetsExpectation,
      ratingAboveExpectation: item.ratingAboveExpectation,
      ratingExceedsExpectation: item.ratingExceedsExpectation,
      metricsJson: JSON.stringify(item.metrics ?? []),
      checklistJson: JSON.stringify(item.checklist ?? []),
      defined: item.defined ? 1 : 0,
    });
  });

  const setRow = selectSetByIdStmt.get(setId) as Record<string, unknown>;
  return rowToSet(setRow, params.items);
}

export function listKpiSetsForEmployee(employeeId: string): KpiSet[] {
  const setRows = selectSetsForEmployeeStmt.all(employeeId) as Array<Record<string, unknown>>;
  return setRows.map((setRow) => {
    const itemRows = selectItemsForSetStmt.all(setRow.id as number) as Array<Record<string, unknown>>;
    return rowToSet(setRow, itemRows.map(rowToItem));
  });
}
