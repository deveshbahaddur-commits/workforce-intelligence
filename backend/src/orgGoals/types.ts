/**
 * A short list of organisational goals/priorities for a review period,
 * admin-drafted the same chat-assisted way KRAs are drafted for employees.
 * Individual KRAs are later checked for alignment against the current
 * (most recently saved) set — see admin/alignmentRunner.ts.
 */
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
