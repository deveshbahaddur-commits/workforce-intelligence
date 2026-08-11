export interface ChatResponse {
  response: string;
  decisionType: string;
  posture: string;
  toolCalls?: Array<{ tool: string; input: unknown; output: unknown }>;
  error?: string;
}

export async function sendChatQuery(query: string): Promise<ChatResponse> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  const data = (await res.json()) as ChatResponse;
  if (!res.ok) {
    throw new Error(data.error ?? `Request failed with status ${res.status}`);
  }
  return data;
}
