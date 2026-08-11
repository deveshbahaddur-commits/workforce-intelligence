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

db.exec(`
  CREATE TABLE IF NOT EXISTS kpi_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    set_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL,
    role TEXT NOT NULL,
    kra TEXT NOT NULL,
    kpi TEXT NOT NULL,
    goal_description TEXT NOT NULL,
    weightage_percent REAL NOT NULL,
    source_of_tracking TEXT NOT NULL,
    rating_needs_improvement TEXT NOT NULL,
    rating_below_expectation TEXT NOT NULL,
    rating_meets_expectation TEXT NOT NULL,
    rating_above_expectation TEXT NOT NULL,
    rating_exceeds_expectation TEXT NOT NULL,
    FOREIGN KEY (set_id) REFERENCES kpi_sets(id)
  );
`);

const insertSetStmt = db.prepare(`
  INSERT INTO kpi_sets (employee_id, employee_name, manager_id, manager_name, created_at)
  VALUES (@employeeId, @employeeName, @managerId, @managerName, @createdAt)
`);

const insertItemStmt = db.prepare(`
  INSERT INTO kpi_items (
    set_id, sort_order, role, kra, kpi, goal_description, weightage_percent, source_of_tracking,
    rating_needs_improvement, rating_below_expectation, rating_meets_expectation,
    rating_above_expectation, rating_exceeds_expectation
  ) VALUES (
    @setId, @sortOrder, @role, @kra, @kpi, @goalDescription, @weightagePercent, @sourceOfTracking,
    @ratingNeedsImprovement, @ratingBelowExpectation, @ratingMeetsExpectation,
    @ratingAboveExpectation, @ratingExceedsExpectation
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
    kpi: r.kpi as string,
    goalDescription: r.goal_description as string,
    weightagePercent: r.weightage_percent as number,
    sourceOfTracking: r.source_of_tracking as string,
    ratingNeedsImprovement: r.rating_needs_improvement as string,
    ratingBelowExpectation: r.rating_below_expectation as string,
    ratingMeetsExpectation: r.rating_meets_expectation as string,
    ratingAboveExpectation: r.rating_above_expectation as string,
    ratingExceedsExpectation: r.rating_exceeds_expectation as string,
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
      kpi: item.kpi,
      goalDescription: item.goalDescription,
      weightagePercent: item.weightagePercent,
      sourceOfTracking: item.sourceOfTracking,
      ratingNeedsImprovement: item.ratingNeedsImprovement,
      ratingBelowExpectation: item.ratingBelowExpectation,
      ratingMeetsExpectation: item.ratingMeetsExpectation,
      ratingAboveExpectation: item.ratingAboveExpectation,
      ratingExceedsExpectation: item.ratingExceedsExpectation,
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
