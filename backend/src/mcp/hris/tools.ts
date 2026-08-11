import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { EMPLOYEES } from "./data/seed.js";

function byTeam(team?: string) {
  return team ? EMPLOYEES.filter((e) => e.team.toLowerCase() === team.toLowerCase()) : EMPLOYEES;
}

function jsonResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

/**
 * HRIS tools, registered on a standard MCP server, reading from the live
 * EMPLOYEES array in data/seed.ts (Recykal's master employee sheet).
 * EMPLOYEES is refreshed in the background, so read it fresh on every call
 * rather than caching anything at module scope here.
 *
 * No cost/compensation tool: the source sheet has no compensation column,
 * so there's nothing real to report — a get_cost_summary tool was
 * deliberately not built rather than fabricate numbers against real
 * employees. Add one if a comp data source gets wired in later.
 */
export function registerHrisTools(server: McpServer): void {
  server.registerTool(
    "list_teams",
    {
      description:
        "List every team (business function) name present in the HRIS. Use this first if you don't already know the exact team name to query.",
    },
    async () => jsonResult({ teams: [...new Set(EMPLOYEES.map((e) => e.team))].sort() }),
  );

  server.registerTool(
    "get_headcount",
    {
      description: "Get active headcount for a team (or the whole org if no team is given), with a breakdown by role.",
      inputSchema: {
        team: z.string().optional().describe("Team name, e.g. 'Marketplace'. Omit for org-wide headcount."),
      },
    },
    async ({ team }) => {
      const rows = byTeam(team);
      const byRole: Record<string, number> = {};
      for (const e of rows) byRole[e.role] = (byRole[e.role] ?? 0) + 1;
      return jsonResult({ team: team ?? "org-wide", activeHeadcount: rows.length, byRole });
    },
  );

  server.registerTool(
    "get_team_roster",
    {
      description:
        "Get the full roster for a team: each active employee's name, role, manager, tenure in months, and location. Does not include contact info or compensation.",
      inputSchema: { team: z.string().describe("Team name, e.g. 'Marketplace'.") },
    },
    async ({ team }) => {
      const rows = byTeam(team);
      return jsonResult(
        rows.map((e) => ({
          name: e.name,
          role: e.role,
          manager: EMPLOYEES.find((m) => m.employeeId === e.manager)?.name ?? null,
          tenureMonths: e.tenureMonths,
          location: e.location,
        })),
      );
    },
  );

  server.registerTool(
    "get_tenure_summary",
    {
      description:
        "Get tenure statistics for a team (or org-wide): average tenure in months, and a breakdown into <6mo, 6-24mo, and 24mo+ buckets. Useful for retention-risk and ramp-time questions.",
      inputSchema: { team: z.string().optional().describe("Team name. Omit for org-wide.") },
    },
    async ({ team }) => {
      const rows = byTeam(team);
      const avg = rows.reduce((sum, e) => sum + e.tenureMonths, 0) / (rows.length || 1);
      const buckets = { under6mo: 0, sixTo24mo: 0, over24mo: 0 };
      for (const e of rows) {
        if (e.tenureMonths < 6) buckets.under6mo++;
        else if (e.tenureMonths < 24) buckets.sixTo24mo++;
        else buckets.over24mo++;
      }
      return jsonResult({ team: team ?? "org-wide", averageTenureMonths: Math.round(avg * 10) / 10, buckets });
    },
  );
}
