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
