import type { KpiItem, KpiSet } from "./kraKpiClient.js";

export interface AdminEmployee {
  employeeId: string;
  name: string;
  role: string;
  team: string;
}

export interface OrgGoalItem {
  title: string;
  description: string;
}

export interface OrgGoalSet {
  id: number;
  content: OrgGoalItem[];
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface OrgGoalDraftChatMessage {
  role: "user" | "model";
  text: string;
}

export interface AlignmentResult {
  kra: string;
  verdict: "aligned" | "partial" | "not_aligned";
  reason: string;
}

async function asJson<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed with status ${res.status}`);
  }
  return data as T;
}

export function getAllEmployees(): Promise<AdminEmployee[]> {
  return fetch("/api/admin/employees", { credentials: "include" }).then(asJson<AdminEmployee[]>);
}

export function getAllKpiSets(): Promise<KpiSet[]> {
  return fetch("/api/admin/kpi-sets", { credentials: "include" }).then(asJson<KpiSet[]>);
}

export function getOrgGoals(): Promise<OrgGoalSet | null> {
  return fetch("/api/admin/org-goals", { credentials: "include" }).then(asJson<OrgGoalSet | null>);
}

export function draftOrgGoals(params: { history: OrgGoalDraftChatMessage[] }): Promise<{
  reply: string;
  draftGoals: OrgGoalItem[];
}> {
  return fetch("/api/admin/org-goals/draft", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).then(asJson<{ reply: string; draftGoals: OrgGoalItem[] }>);
}

export function saveOrgGoals(content: OrgGoalItem[]): Promise<OrgGoalSet> {
  return fetch("/api/admin/org-goals", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  }).then(asJson<OrgGoalSet>);
}

export function checkAlignment(items: KpiItem[]): Promise<{ results: AlignmentResult[] }> {
  return fetch("/api/admin/alignment", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  }).then(asJson<{ results: AlignmentResult[] }>);
}
