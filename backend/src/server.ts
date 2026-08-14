import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import { evaluateGuardrail } from "./guardrails/router.js";
import { runWorkforcePlanningAgent } from "./agent/agentRunner.js";
import { logInteraction, getRecentAuditRecords } from "./audit/auditLogger.js";
import { EMPLOYEES, initHrisData } from "./mcp/hris/data/seed.js";
import { getReporteeTree, isReporteeOf } from "./mcp/hris/orgChart.js";
import { draftKpis } from "./kpi/kpiAgentRunner.js";
import { saveKpiSet, listKpiSetsForEmployee } from "./kpi/kpiStore.js";
import type { KpiDraftChatMessage, KpiItem } from "./kpi/types.js";
import { createSession, listSessions, getSession, replaceMessages } from "./chat/chatSessionStore.js";
import type { ChatSessionKind, ChatSessionMessage } from "./chat/types.js";
import { attachUser, requireAuth, issueSessionCookie, clearSessionCookie } from "./auth/session.js";
import { getPasswordHash } from "./auth/credentialStore.js";
import { verifyPassword } from "./auth/passwordHash.js";

const app = express();
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(attachUser);

const PORT = Number(process.env.PORT ?? 8787);

// --- Auth ---
// Email + admin-provisioned password, checked against the HRIS sheet's
// "Official Mail ID" for identity and a separate credential store for the
// password hash. No self-service signup or reset — see
// src/scripts/setPassword.ts, run directly by whoever administers this.

app.post("/auth/login", (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }

  // Same generic error whether the email doesn't match an employee, no
  // password has been set yet, or the password is simply wrong — don't
  // reveal which of those it was.
  const invalid = () => res.status(401).json({ error: "Incorrect email or password." });

  const employee = EMPLOYEES.find((e) => e.email === email);
  if (!employee) {
    invalid();
    return;
  }
  const hash = getPasswordHash(employee.employeeId);
  if (!hash || !verifyPassword(password, hash)) {
    invalid();
    return;
  }

  const sessionUser = {
    email: employee.email,
    name: employee.name,
    employeeId: employee.employeeId,
    role: employee.role,
  };
  issueSessionCookie(res, sessionUser);
  res.json({ user: sessionUser });
});

app.post("/auth/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

app.get("/auth/me", (req, res) => {
  res.json({ user: req.user ?? null });
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Everything below this line requires a signed-in session — the manager's
// identity comes from req.user (set by attachUser from the session cookie),
// never from a client-supplied id, so a logged-in manager can only ever act
// as themselves.
app.use("/api", requireAuth);

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

app.get("/api/reportees", (req, res) => {
  res.json(getReporteeTree(req.user!.employeeId));
});

app.post("/api/kpi/draft", async (req, res) => {
  const { employeeId, history } = req.body ?? {};
  const managerId = req.user!.employeeId;
  if (typeof employeeId !== "string" || !Array.isArray(history)) {
    res.status(400).json({ error: "Request body must include employeeId and a history array." });
    return;
  }
  if (!isReporteeOf(managerId, employeeId)) {
    res.status(403).json({ error: "That employee is not one of your reportees." });
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
  const { employeeId, items } = req.body ?? {};
  const managerId = req.user!.employeeId;
  if (typeof employeeId !== "string" || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Request body must include employeeId and a non-empty items array." });
    return;
  }
  if (!isReporteeOf(managerId, employeeId)) {
    res.status(403).json({ error: "That employee is not one of your reportees." });
    return;
  }
  const employee = EMPLOYEES.find((e) => e.employeeId === employeeId)!;

  const saved = saveKpiSet({
    employeeId,
    employeeName: employee.name,
    managerId,
    managerName: req.user!.name,
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
  if (!isReporteeOf(req.user!.employeeId, employeeId)) {
    res.status(403).json({ error: "That employee is not one of your reportees." });
    return;
  }
  res.json(listKpiSetsForEmployee(employeeId));
});

// --- Chat session persistence (sidebar history) ---
// Sessions are keyed by the signed-in manager's own employeeId (and,
// for kra-kpi chats, which reportee) — never a client-supplied managerId.

const CHAT_KINDS: ChatSessionKind[] = ["workforce-planning", "kra-kpi"];

function parseKind(value: unknown): ChatSessionKind | null {
  return typeof value === "string" && (CHAT_KINDS as string[]).includes(value) ? (value as ChatSessionKind) : null;
}

app.post("/api/chat/sessions", (req, res) => {
  const kind = parseKind(req.body?.kind);
  const employeeId = typeof req.body?.employeeId === "string" ? req.body.employeeId : null;
  if (!kind) {
    res.status(400).json({ error: "Request body must include a valid kind." });
    return;
  }
  if (employeeId && !isReporteeOf(req.user!.employeeId, employeeId)) {
    res.status(403).json({ error: "That employee is not one of your reportees." });
    return;
  }
  res.json(createSession({ kind, managerId: req.user!.employeeId, employeeId }));
});

app.get("/api/chat/sessions", (req, res) => {
  const kind = parseKind(req.query.kind);
  const employeeId = typeof req.query.employeeId === "string" ? req.query.employeeId : null;
  if (!kind) {
    res.status(400).json({ error: "Query param kind is required." });
    return;
  }
  res.json(listSessions({ kind, managerId: req.user!.employeeId, employeeId }));
});

app.get("/api/chat/sessions/:id", (req, res) => {
  const id = Number(req.params.id);
  const session = Number.isInteger(id) ? getSession(id) : null;
  if (!session || session.managerId !== req.user!.employeeId) {
    res.status(404).json({ error: `No chat session with id ${req.params.id}.` });
    return;
  }
  res.json(session);
});

app.put("/api/chat/sessions/:id/messages", (req, res) => {
  const id = Number(req.params.id);
  const messages = req.body?.messages;
  if (!Number.isInteger(id) || !Array.isArray(messages)) {
    res.status(400).json({ error: "Request body must include a messages array." });
    return;
  }
  const existing = getSession(id);
  if (!existing || existing.managerId !== req.user!.employeeId) {
    res.status(404).json({ error: `No chat session with id ${req.params.id}.` });
    return;
  }
  const session = replaceMessages(id, messages as ChatSessionMessage[]);
  res.json(session);
});

// Read-only visibility into the audit log — handy for demoing the guardrail.
app.get("/api/audit", (_req, res) => {
  res.json(getRecentAuditRecords(50));
});

// In production, this same server also serves the built frontend, so the
// whole app is one origin — no cross-site cookie configuration needed for
// the session cookie. In local dev, frontend/dist doesn't exist (Vite's own
// dev server serves the frontend on :5173 instead), so this is a no-op.
const frontendDist = path.resolve(process.cwd(), "../frontend/dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api|\/auth).*/, (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

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
