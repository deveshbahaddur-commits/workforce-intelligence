import { GoogleGenAI, mcpToTool } from "@google/genai";
import { Client as McpClient } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createHrisServer } from "../mcp/hris/server.js";
import { WORKFORCE_PLANNING_SYSTEM_PROMPT } from "./systemPrompt.js";
import type { ToolCallRecord } from "../audit/auditLogger.js";
import { withGeminiRetry } from "../lib/withGeminiRetry.js";

export interface AgentRunResult {
  responseText: string;
  toolCalls: ToolCallRecord[];
}

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Runs the workforce-planning agent for a query that has already been
 * cleared by the pre-reasoning guardrail (see guardrails/router.ts).
 *
 * Unlike a harness with a built-in general-purpose toolset, there is nothing
 * here for the model to reach for beyond what this function wires up: a
 * fresh MCP client/server pair is created per call, connected in-process,
 * and its only registered tools are the four HRIS read-only queries in
 * mcp/hris/tools.ts. That MCP server IS the allowlist — there's no bash,
 * filesystem, or general tool access to strip, so no second permission gate
 * is needed on top of it (unlike a full agent harness, which would need one).
 *
 * Tool execution itself is handled by the Gemini SDK's automatic function
 * calling (`mcpToTool`): it calls the model, detects function calls, invokes
 * them via the MCP client, feeds results back, and loops — up to
 * maximumRemoteCalls — before returning a final response with the full
 * call history attached.
 */
export async function runWorkforcePlanningAgent(userQuery: string): Promise<AgentRunResult> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const hrisServer = createHrisServer();
  const mcpClient = new McpClient({ name: "workforce-agent-backend", version: "0.1.0" });

  await hrisServer.connect(serverTransport);
  await mcpClient.connect(clientTransport);

  try {
    const response = await withGeminiRetry(() =>
      client.models.generateContent({
        model: "gemini-flash-latest",
        contents: userQuery,
        config: {
          systemInstruction: WORKFORCE_PLANNING_SYSTEM_PROMPT,
          tools: [mcpToTool(mcpClient)],
          automaticFunctionCalling: { maximumRemoteCalls: 8 },
        },
      }),
    );

    const toolCalls: ToolCallRecord[] = [];
    const history = response.automaticFunctionCallingHistory ?? [];
    const pending: Array<{ id?: string; name: string; input: unknown }> = [];

    for (const turn of history) {
      for (const part of turn.parts ?? []) {
        if (part.functionCall) {
          pending.push({ id: part.functionCall.id, name: part.functionCall.name ?? "unknown", input: part.functionCall.args });
        } else if (part.functionResponse) {
          const byId = part.functionResponse.id
            ? pending.findIndex((p) => p.id === part.functionResponse!.id)
            : -1;
          const index = byId >= 0 ? byId : pending.findIndex((p) => p.name === part.functionResponse!.name);
          if (index >= 0) {
            const [matched] = pending.splice(index, 1);
            toolCalls.push({ tool: matched.name, input: matched.input, output: part.functionResponse.response });
          }
        }
      }
    }

    return { responseText: (response.text ?? "").trim(), toolCalls };
  } finally {
    await mcpClient.close();
    await hrisServer.close();
  }
}
