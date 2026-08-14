export type ChatSessionKind = "workforce-planning" | "kra-kpi";

export interface ChatSessionMessage {
  role: "user" | "model";
  text: string;
}

export interface ChatSessionSummary {
  id: number;
  kind: ChatSessionKind;
  managerId: string;
  employeeId: string | null;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSession extends ChatSessionSummary {
  messages: ChatSessionMessage[];
}

async function asJson<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed with status ${res.status}`);
  }
  return data as T;
}

export function createChatSession(params: { kind: ChatSessionKind; employeeId?: string | null }): Promise<ChatSession> {
  return fetch("/api/chat/sessions", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).then(asJson<ChatSession>);
}

export function listChatSessions(params: { kind: ChatSessionKind; employeeId?: string | null }): Promise<
  ChatSessionSummary[]
> {
  const search = new URLSearchParams({ kind: params.kind });
  if (params.employeeId) search.set("employeeId", params.employeeId);
  return fetch(`/api/chat/sessions?${search.toString()}`, { credentials: "include" }).then(
    asJson<ChatSessionSummary[]>,
  );
}

export function getChatSession(id: number): Promise<ChatSession> {
  return fetch(`/api/chat/sessions/${id}`, { credentials: "include" }).then(asJson<ChatSession>);
}

export function saveChatSessionMessages(id: number, messages: ChatSessionMessage[]): Promise<ChatSession> {
  return fetch(`/api/chat/sessions/${id}/messages`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  }).then(asJson<ChatSession>);
}
