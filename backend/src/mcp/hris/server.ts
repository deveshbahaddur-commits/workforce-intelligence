import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerHrisTools } from "./tools.js";

/**
 * Standard MCP server standing in for a real HRIS system. Built on the
 * official Model Context Protocol SDK (not a provider-specific wrapper), so
 * swapping this in-process mock for a real, network-hosted HRIS MCP
 * connector in Phase 1 means changing how it's transported (see
 * agentRunner.ts's in-memory transport) — the tool definitions and the rest
 * of the app don't change.
 */
export function createHrisServer(): McpServer {
  const server = new McpServer({
    name: "hris",
    version: "0.1.0",
  });
  registerHrisTools(server);
  return server;
}
