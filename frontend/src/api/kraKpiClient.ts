export interface ReporteeNode {
  employeeId: string;
  name: string;
  role: string;
  team: string;
  depth: number;
  directReportCount: number;
  reports: ReporteeNode[];
}

export interface KraMetric {
  name: string;
  baseline: number;
  target: number;
  unit: string;
  direction: "up" | "down";
  note: string;
  group?: string;
  milestone?: string;
}

export interface KraChecklistItem {
  name: string;
  done: boolean;
}

export interface KpiItem {
  role: string;
  kra: string;
  goalAnnual: string;
  goalH1: string;
  goalH2: string;
  kpiTask: string;
  weightagePercent: number;
  sourceOfTracking: string;
  ratingNeedsImprovement: string;
  ratingBelowExpectation: string;
  ratingMeetsExpectation: string;
  ratingAboveExpectation: string;
  ratingExceedsExpectation: string;
  metrics: KraMetric[];
  checklist: KraChecklistItem[];
  defined: boolean;
}

export interface KpiSet {
  id: number;
  employeeId: string;
  employeeName: string;
  managerId: string;
  managerName: string;
  createdAt: string;
  items: KpiItem[];
}

export interface KpiDraftChatMessage {
  role: "user" | "model";
  text: string;
}

async function asJson<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed with status ${res.status}`);
  }
  return data as T;
}

/** Direct + indirect reportees of the signed-in manager — identity comes from the session, not a client-supplied id. */
export function getReporteeTree(): Promise<ReporteeNode[]> {
  return fetch("/api/reportees", { credentials: "include" }).then(asJson<ReporteeNode[]>);
}

/** Every active employee in the signed-in user's own BP scope — empty array if they're not a BP for anything. */
export interface BpEmployee {
  employeeId: string;
  name: string;
  role: string;
  team: string;
}
export function getBpEmployees(): Promise<BpEmployee[]> {
  return fetch("/api/bp/employees", { credentials: "include" }).then(asJson<BpEmployee[]>);
}

export function draftKpis(params: { employeeId: string; history: KpiDraftChatMessage[] }): Promise<{
  reply: string;
  draftKpis: KpiItem[];
}> {
  return fetch("/api/kpi/draft", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).then(asJson<{ reply: string; draftKpis: KpiItem[] }>);
}

export function saveKpiSet(params: { employeeId: string; items: KpiItem[] }): Promise<KpiSet> {
  return fetch("/api/kpi/sets", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).then(asJson<KpiSet>);
}

export function getKpiSets(employeeId: string): Promise<KpiSet[]> {
  return fetch(`/api/kpi/sets?employeeId=${encodeURIComponent(employeeId)}`, { credentials: "include" }).then(
    asJson<KpiSet[]>,
  );
}
