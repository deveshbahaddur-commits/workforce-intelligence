import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import fs from "node:fs";
import { evaluateGuardrail } from "./guardrails/router.js";
import { runWorkforcePlanningAgent } from "./agent/agentRunner.js";
import { logInteraction, getRecentAuditRecords } from "./audit/auditLogger.js";
import { EMPLOYEES, initHrisData } from "./mcp/hris/data/seed.js";
import { getReporteeTree, canSetKrasFor } from "./mcp/hris/orgChart.js";
import { draftKpis } from "./kpi/kpiAgentRunner.js";
import { saveKpiSet, listKpiSetsForEmployee } from "./kpi/kpiStore.js";
import type { KpiDraftChatMessage, KpiItem } from "./kpi/types.js";
import { createSession, listSessions, getSession, replaceMessages } from "./chat/chatSessionStore.js";
import type { ChatSessionKind, ChatSessionMessage } from "./chat/types.js";
import { attachUser, requireAuth, issueSessionCookie, clearSessionCookie } from "./auth/session.js";
import { getPasswordHash, setPasswordHash } from "./auth/credentialStore.js";
import { hashPassword, verifyPassword } from "./auth/passwordHash.js";
import { initSchema } from "./db/schema.js";
import { describeGeminiError } from "./lib/withGeminiRetry.js";

const app = express();
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(attachUser);

const PORT = Number(process.env.PORT ?? 8787);

// --- Auth ---
// Email + password, self-service signup. Identity is the HRIS sheet's
// "Official Mail ID" — that's the only login ID accepted, since it's also
// the join key the reportee tree and everything else is scoped by. No
// email verification on signup (deliberately, for now — see memory/
// conversation for the tradeoff): anyone who knows a manager's official
// email can create the account for it, but only once — signup fails once
// a password already exists for that employee, so it can't be used to
// take over an existing account. src/scripts/setPassword.ts remains for
// admin-driven resets.

app.post("/auth/signup", async (req, res) => {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required." });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters." });
    return;
  }

  try {
    const employee = EMPLOYEES.find((e) => e.email === email);
    if (!employee) {
      res.status(404).json({ error: "That email isn't linked to an employee record." });
      return;
    }
    const existingHash = await getPasswordHash(employee.employeeId);
    if (existingHash) {
      res.status(409).json({ error: "An account already exists for this email. Sign in instead." });
      return;
    }

    await setPasswordHash(employee.employeeId, hashPassword(password));

    const sessionUser = {
      email: employee.email,
      name: employee.name,
      employeeId: employee.employeeId,
      role: employee.role,
    };
    issueSessionCookie(res, sessionUser);
    res.json({ user: sessionUser });
  } catch (err) {
    console.error("Error handling /auth/signup:", err);
    res.status(500).json({ error: "Something went wrong creating your account." });
  }
});

app.post("/auth/login", async (req, res) => {
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

  try {
    const employee = EMPLOYEES.find((e) => e.email === email);
    if (!employee) {
      invalid();
      return;
    }
    const hash = await getPasswordHash(employee.employeeId);
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
  } catch (err) {
    console.error("Error handling /auth/login:", err);
    res.status(500).json({ error: "Something went wrong signing in." });
  }
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
      }).catch((err) => console.error("Failed to write audit record:", err));
      res.json({
        response: decision.shortCircuitResponse,
        decisionType: decision.classification.decisionType,
        posture: decision.posture.kind,
      });
      return;
    }

    const { responseText, toolCalls } = await runWorkforcePlanningAgent(query);

    logInteraction({ query, decision, toolCalls, finalResponse: responseText }).catch((err) =>
      console.error("Failed to write audit record:", err),
    );

    res.json({
      response: responseText,
      decisionType: decision.classification.decisionType,
      posture: decision.posture.kind,
      toolCalls,
    });
  } catch (err) {
    console.error("Error handling /api/chat:", err);
    res.status(502).json({ error: describeGeminiError(err) });
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
  if (!canSetKrasFor(managerId, employeeId)) {
    res.status(403).json({ error: "You can only set KRA/KPIs for yourself or your reportees." });
    return;
  }

  try {
    const result = await draftKpis({ employeeId, managerId, history: history as KpiDraftChatMessage[] });
    res.json(result);
  } catch (err) {
    console.error("Error handling /api/kpi/draft:", err);
    res.status(502).json({ error: describeGeminiError(err) });
  }
});

app.post("/api/kpi/sets", async (req, res) => {
  const { employeeId, items } = req.body ?? {};
  const managerId = req.user!.employeeId;
  if (typeof employeeId !== "string" || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "Request body must include employeeId and a non-empty items array." });
    return;
  }
  if (!canSetKrasFor(managerId, employeeId)) {
    res.status(403).json({ error: "You can only set KRA/KPIs for yourself or your reportees." });
    return;
  }
  const employee = EMPLOYEES.find((e) => e.employeeId === employeeId)!;

  try {
    const saved = await saveKpiSet({
      employeeId,
      employeeName: employee.name,
      managerId,
      managerName: req.user!.name,
      items: items as KpiItem[],
    });
    res.json(saved);
  } catch (err) {
    console.error("Error handling POST /api/kpi/sets:", err);
    res.status(500).json({ error: "Something went wrong saving the KPI set." });
  }
});

app.get("/api/kpi/sets", async (req, res) => {
  const employeeId = typeof req.query.employeeId === "string" ? req.query.employeeId : "";
  if (!employeeId) {
    res.status(400).json({ error: "Query param employeeId is required." });
    return;
  }
  if (!canSetKrasFor(req.user!.employeeId, employeeId)) {
    res.status(403).json({ error: "You can only view KRA/KPIs for yourself or your reportees." });
    return;
  }
  try {
    res.json(await listKpiSetsForEmployee(employeeId));
  } catch (err) {
    console.error("Error handling GET /api/kpi/sets:", err);
    res.status(500).json({ error: "Something went wrong loading KPI sets." });
  }
});

// --- Chat session persistence (sidebar history) ---
// Sessions are keyed by the signed-in manager's own employeeId (and,
// for kra-kpi chats, which reportee) — never a client-supplied managerId.

const CHAT_KINDS: ChatSessionKind[] = ["workforce-planning", "kra-kpi"];

function parseKind(value: unknown): ChatSessionKind | null {
  return typeof value === "string" && (CHAT_KINDS as string[]).includes(value) ? (value as ChatSessionKind) : null;
}

app.post("/api/chat/sessions", async (req, res) => {
  const kind = parseKind(req.body?.kind);
  const employeeId = typeof req.body?.employeeId === "string" ? req.body.employeeId : null;
  if (!kind) {
    res.status(400).json({ error: "Request body must include a valid kind." });
    return;
  }
  if (employeeId && !canSetKrasFor(req.user!.employeeId, employeeId)) {
    res.status(403).json({ error: "You can only manage chats for yourself or your reportees." });
    return;
  }
  try {
    res.json(await createSession({ kind, managerId: req.user!.employeeId, employeeId }));
  } catch (err) {
    console.error("Error handling POST /api/chat/sessions:", err);
    res.status(500).json({ error: "Something went wrong creating the chat session." });
  }
});

app.get("/api/chat/sessions", async (req, res) => {
  const kind = parseKind(req.query.kind);
  const employeeId = typeof req.query.employeeId === "string" ? req.query.employeeId : null;
  if (!kind) {
    res.status(400).json({ error: "Query param kind is required." });
    return;
  }
  try {
    res.json(await listSessions({ kind, managerId: req.user!.employeeId, employeeId }));
  } catch (err) {
    console.error("Error handling GET /api/chat/sessions:", err);
    res.status(500).json({ error: "Something went wrong loading chat sessions." });
  }
});

app.get("/api/chat/sessions/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    const session = Number.isInteger(id) ? await getSession(id) : null;
    if (!session || session.managerId !== req.user!.employeeId) {
      res.status(404).json({ error: `No chat session with id ${req.params.id}.` });
      return;
    }
    res.json(session);
  } catch (err) {
    console.error("Error handling GET /api/chat/sessions/:id:", err);
    res.status(500).json({ error: "Something went wrong loading the chat session." });
  }
});

app.put("/api/chat/sessions/:id/messages", async (req, res) => {
  const id = Number(req.params.id);
  const messages = req.body?.messages;
  if (!Number.isInteger(id) || !Array.isArray(messages)) {
    res.status(400).json({ error: "Request body must include a messages array." });
    return;
  }
  try {
    const existing = await getSession(id);
    if (!existing || existing.managerId !== req.user!.employeeId) {
      res.status(404).json({ error: `No chat session with id ${req.params.id}.` });
      return;
    }
    const session = await replaceMessages(id, messages as ChatSessionMessage[]);
    res.json(session);
  } catch (err) {
    console.error("Error handling PUT /api/chat/sessions/:id/messages:", err);
    res.status(500).json({ error: "Something went wrong saving the chat session." });
  }
});

// Read-only visibility into the audit log — handy for demoing the guardrail.
app.get("/api/audit", async (_req, res) => {
  try {
    res.json(await getRecentAuditRecords(50));
  } catch (err) {
    console.error("Error handling GET /api/audit:", err);
    res.status(500).json({ error: "Something went wrong loading the audit log." });
  }
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

await initSchema();

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
