# Workforce Decision Support Agent — Phase 0

A slice of a larger workforce decision-support agent, backed by Recykal's live master employee Google Sheet and
Google's Gemini API. Two sections so far:

- **Workforce Planning** — chat questions ("should I hire for this role", "what's my team's capacity"), gated by
  a code-enforced guardrail layer, every interaction audit-logged.
- **Set KRA/KPIs for Team** — a manager pulls their direct + indirect reportees and drafts KRA/KPIs for one of
  them, chat-assisted, in Recykal's standard org-wide template.

## What's in Phase 0

### Workforce Planning
- One decision type fully implemented: workforce planning (recommends freely).
- A guardrail layer (`backend/src/guardrails`) that classifies every incoming query by decision type and resolves
  its governance posture **before** the agent's reasoning step runs. `compensation`, `promotion`,
  `hiring_comparison`, `termination`, and `restructuring` are classified and routed correctly but return a stub
  response — the routing plumbing for all four postures already exists.
- An audit log (SQLite, via Node's built-in `node:sqlite`) recording every query, its classification, the HRIS
  data pulled to answer it, and the response given.

### Set KRA/KPIs for Team
- Manager identity is a **picker**, not real auth (Phase 0 explicitly has none) — see `mcp/hris/orgChart.ts`.
- Direct + indirect reportees are computed by walking the mock HRIS's `manager` pointer recursively
  (`GET /api/managers/:id/reportees`) — a real HRIS connector would likely expose this as one endpoint, in which
  case that function is what gets replaced, not its callers.
- KPI drafting is a stateless, chat-assisted flow (`backend/src/kpi/kpiAgentRunner.ts`): the manager describes the
  employee's priorities, Gemini drafts rows in the standard template, the manager edits inline and saves. Nothing
  auto-saves — the manager always reviews the table before persisting it.
- The KRA/KPI template (`backend/src/kpi/types.ts`) is Recykal's actual org-wide format: Role, KRA, KPI, Goal
  Description, Weightage (%), Source of Tracking, and a description of what each of the 5 rating bands (Needs
  Improvement → Exceeds Expectation) concretely looks like *for that specific KPI* — agreed at goal-setting time
  so review-time rating is against pre-agreed, objective criteria rather than a generic 1–5 scale.
- Saved KPI sets persist to their own SQLite store (`backend/src/kpi/kpiStore.ts`, `node:sqlite`, separate DB file
  from the audit log).

### Shared
- HRIS data (`backend/src/mcp/hris`) is exposed as a real, provider-agnostic MCP server, built on the official
  `@modelcontextprotocol/sdk` — the agent, guardrail, and KPI code all go through it and don't know or care where
  the data actually comes from.
- A Recykal-branded home page with navigation into each section (`frontend/src/components/Header.tsx`,
  `HomePage.tsx`) — the "Recykal" wordmark is a placeholder, not a real logo asset; swap in real brand
  colors/assets when available.
- Single-user, no auth, throughout.

## Data source — live Google Sheet

`backend/src/mcp/hris/data/seed.ts` loads Recykal's real master employee Google Sheet (not mock data) as CSV,
filters to `Status = Active`, and refreshes on a background interval (`HRIS_SHEET_CACHE_TTL_MS`, default 5 min).
This is the exact swap point the mock dataset was originally designed for — nothing downstream (`tools.ts`,
`orgChart.ts`, the KPI agent) needed to change.

**Access model:** the sheet is read as a public CSV export (`.../export?format=csv`), which requires it to be
shared as **"Anyone with the link" → Viewer**. No credentials, no service account — but that also means anyone
with the sheet URL can read it, which is why this is documented plainly rather than left implicit. If this stops
being acceptable (e.g. once real compensation data gets added to the sheet), the proper fix is a Google service
account with the sheet shared only to it, reading via the Sheets API instead of the CSV export — `seed.ts`'s
`fetchSheetCsv()` is the only function that would need to change.

**Deliberately not loaded**, even though the sheet has them: mobile number, personal email, DOB, gender. There's
no feature that needs them, and they should never be in memory for the chat agent to reference. There's also no
compensation column in the sheet, so `get_cost_summary` was removed rather than left fabricating numbers against
real employees — see the comment at the top of `mcp/hris/tools.ts`.

**Scope:** all entities in the sheet (Recykal, Recykal Foundation, Retearn, Anubhuti Welfare Foundation, 3rd-party
contractors), active employees only (~520 of the sheet's ~2,076 rows).

## Architecture note

The agent loops are hand-rolled against the Gemini API (`@google/genai`), not run through a packaged harness —
there isn't a Gemini equivalent of the Claude Agent SDK. Tool execution for Workforce Planning is still handled
for you: the HRIS MCP server's tools are wrapped via `mcpToTool()`, and Gemini's SDK performs automatic function
calling — it calls the model, detects function calls, executes them against the MCP server, feeds results back,
and loops (capped at 8 calls) before returning a final response with the full call history attached. See the
comment at the top of `backend/src/agent/agentRunner.ts`. The KPI drafting agent doesn't need tool calls — it's
given the employee's HRIS context directly in the system prompt — so it's a single structured-output call per
turn instead (`backend/src/kpi/kpiAgentRunner.ts`), with the frontend resending the full chat history each turn
(the backend holds no session state, consistent with the rest of the app).

## Prerequisites

- Node.js 20+
- A Gemini API key ([Google AI Studio](https://aistudio.google.com/apikey))

## Setup

```powershell
cd backend
npm install
cp .env.example .env   # then fill in GEMINI_API_KEY and HRIS_SHEET_ID
npm run dev             # starts the API on http://localhost:8787
```

In a second terminal:

```powershell
cd frontend
npm install
npm run dev              # starts the UI on http://localhost:5173
```

The frontend dev server proxies `/api/*` to `http://localhost:8787` (see `frontend/vite.config.ts`).

## Windows notes

- Run each line above separately, or join them with `;` — Windows PowerShell 5.1 does **not** support `&&` as a
  command separator (it's a parser error there, unlike bash/PowerShell 7+).
- The audit log and KPI store both use Node's built-in `node:sqlite` — no native compilation, no build tools
  needed.

## Trying it out

Open http://localhost:5173.

**Workforce Planning:**
- "What's the headcount and average tenure for the ITC WOW team?" → workforce planning, answered directly.
- "List every team" → workforce planning, calls `list_teams` to see the real business-function list.
- "What should we pay the new hire on the Marketplace team?" → compensation, short-circuited with a stub
  message — never reaches the agent.
- "Should we let go of someone on the Marketplace team?" → termination, flagged and routed — never reaches
  the agent.

`GET /api/audit` returns the last 50 audit records if you want to see what got logged.

**Set KRA/KPIs for Team:**
- Pick any manager from the dropdown (~130 real managers in the current data) to see their direct and indirect
  reportees in one tree.
- Select a reportee, describe their priorities for the review period in the chat panel, and a draft KPI table
  appears below.
- Edit any field inline, add/remove rows, then **Save KPI set** once the weightage total reads 100%.

## Project layout

```
backend/src/
  agent/          Hand-rolled Gemini agent loop (via mcpToTool automatic function calling) for the
                   workforce-planning persona
  guardrails/      classify -> resolve posture -> allow/block, before the agent ever runs
  kpi/             chat-assisted KRA/KPI drafting agent + SQLite store
  mcp/hris/        live HRIS data (Google Sheet) as a real, provider-agnostic MCP server, plus org-chart traversal
  audit/           SQLite-backed audit log (node:sqlite)
  server.ts        Express app tying it together
frontend/src/
  components/      Header, HomePage, ChatWindow (workforce planning), KraKpiPage, ReporteeTree
  api/             backend API clients
```
