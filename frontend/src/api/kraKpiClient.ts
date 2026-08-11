export interface ManagerOption {
  employeeId: string;
  name: string;
  role: string;
  team: string;
}

export interface ReporteeNode {
  employeeId: string;
  name: string;
  role: string;
  team: string;
  depth: number;
  directReportCount: number;
  reports: ReporteeNode[];
}

export interface KpiItem {
  role: string;
  kra: string;
  kpi: string;
  goalDescription: string;
  weightagePercent: number;
  sourceOfTracking: string;
  ratingNeedsImprovement: string;
  ratingBelowExpectation: string;
  ratingMeetsExpectation: string;
  ratingAboveExpectation: string;
  ratingExceedsExpectation: string;
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

export function getManagers(): Promise<ManagerOption[]> {
  return fetch("/api/managers").then(asJson<ManagerOption[]>);
}

export function getReporteeTree(managerId: string): Promise<ReporteeNode[]> {
  return fetch(`/api/managers/${encodeURIComponent(managerId)}/reportees`).then(asJson<ReporteeNode[]>);
}

export function draftKpis(params: {
  employeeId: string;
  managerId: string;
  history: KpiDraftChatMessage[];
}): Promise<{ reply: string; draftKpis: KpiItem[] }> {
  return fetch("/api/kpi/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).then(asJson<{ reply: string; draftKpis: KpiItem[] }>);
}

export function saveKpiSet(params: { employeeId: string; managerId: string; items: KpiItem[] }): Promise<KpiSet> {
  return fetch("/api/kpi/sets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).then(asJson<KpiSet>);
}

export function getKpiSets(employeeId: string): Promise<KpiSet[]> {
  return fetch(`/api/kpi/sets?employeeId=${encodeURIComponent(employeeId)}`).then(asJson<KpiSet[]>);
}
