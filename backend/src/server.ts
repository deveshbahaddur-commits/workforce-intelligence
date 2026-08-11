import express from "express";
import cors from "cors";
import { evaluateGuardrail } from "./guardrails/router.js";
import { runWorkforcePlanningAgent } from "./agent/agentRunner.js";
import { logInteraction, getRecentAuditRecords } from "./audit/auditLogger.js";
import { EMPLOYEES, initHrisData } from "./mcp/hris/data/seed.js";
import { listManagers, getReporteeTree } from "./mcp/hris/orgChart.js";
import { draftKpis } from "./kpi/kpiAgentRunner.js";
import { saveKpiSet, listKpiSetsForEmployee } from "./kpi/kpiStore.js";
import type { KpiDraftChatMessage, KpiItem } from "./kpi/types.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT ?? 8787);

app.post("/api/chat", async (req, res) => {
  const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
  if (!query) {
    res.status(400).json({ error: "Request body must include a non-empty 'query' string." });
    return;
  }

  try {
    // Every query passes through the guardrail FIRST. The agent's reasoning
    // step is only reached if the guardrail says so.
    const decision = await evaluateGuardrail(query);

    if (!decision.allowReasoning) {
      logInteraction({
        query,
        decision,
        toolCalls: [],
        finalResponse: decision.shortCircuitResponse ?? "",
      });
      res.json({
        response: decision.shortCircuitResponse,
        decisionType: decision.classification.decisionType,
        posture: decision.posture.kind,
      });
      return;
    }

    const { responseText, toolCalls } = await runWorkforcePlanningAgent(query);

    logInteraction({ query, decision, toolCalls, finalResponse: responseText });

    res.json({
      response: responseText,
      decisionType: decision.classification.decisionType,
      posture: decision.posture.kind,
      toolCalls,
    });
  } catch (err) {
    console.error("Error handling /api/chat:", err);
    res.status(500).json({ error: "Something went wrong processing that request." });
  }
});

// --- KRA/KPI section ---
// Manager identity is a picker, not real auth — see mcp/hris/orgChart.ts
// and the README for why that's the deliberate Phase 0 stand-in.

app.get("/api/managers", (_req, res) => {
  res.json(listManagers());
});

app.get("/api/managers/:id/reportees", (req, res) => {
  const manager = EMPLOYEES.find((e) => e.employeeId === req.params.id);
  if (!manager) {
    res.status(404).json({ error: `No employee with id ${req.params.id}.` });
    return;
  }
  res.json(getReporteeTree(req.params.id));
});

app.post("/api/kpi/draft", async (req, res) => {
  const { employeeId, managerId, history } = req.body ?? {};
  if (typeof employeeId !== "string" || typeof managerId !== "string" || !Array.isArray(history)) {
    res.status(400).json({ error: "Request body must include employeeId, managerId, and a history array." });
    return;
  }
  if (!EMPLOYEES.some((e) => e.employeeId === employeeId)) {
    res.status(404).json({ error: `No employee with id ${employeeId}.` });
    return;
  }

  try {
    const result = await draftKpis({ employeeId, managerId, history: history as KpiDraftChatMessage[] });
    res.json(result);
  } catch (err) {
    console.error("Error handling /api/kpi/draft:", err);
    res.status(500).json({ error: "Something went wrong drafting KPIs." });
  }
});

app.post("/api/kpi/sets", (req, res) => {
  const { employeeId, managerId, items } = req.body ?? {};
  if (typeof employeeId !== "string" || typeof managerId !== "string" || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Request body must include employeeId, managerId, and a non-empty items array." });
    return;
  }
  const employee = EMPLOYEES.find((e) => e.employeeId === employeeId);
  const manager = EMPLOYEES.find((e) => e.employeeId === managerId);
  if (!employee || !manager) {
    res.status(404).json({ error: "Unknown employeeId or managerId." });
    return;
  }

  const saved = saveKpiSet({
    employeeId,
    employeeName: employee.name,
    managerId,
    managerName: manager.name,
    items: items as KpiItem[],
  });
  res.json(saved);
});

app.get("/api/kpi/sets", (req, res) => {
  const employeeId = typeof req.query.employeeId === "string" ? req.query.employeeId : "";
  if (!employeeId) {
    res.status(400).json({ error: "Query param employeeId is required." });
    return;
  }
  res.json(listKpiSetsForEmployee(employeeId));
});

// Read-only visibility into the audit log — handy for demoing the guardrail
// during Phase 0. No auth on this route yet (Phase 0 explicitly has none);
// don't expose this port publicly.
app.get("/api/audit", (_req, res) => {
  res.json(getRecentAuditRecords(50));
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Block startup on the first HRIS fetch so no request races an empty
// EMPLOYEES array; a failed fetch is logged loudly but doesn't crash the
// process — /api/health stays reachable and initHrisData's background
// timer (started even on this failed attempt... see seed.ts) keeps retrying.
try {
  await initHrisData();
} catch (err) {
  console.error("[hris] Initial load failed — starting anyway with no employee data:", err);
}

app.listen(PORT, () => {
  console.log(`Workforce agent backend listening on http://localhost:${PORT}`);
});
