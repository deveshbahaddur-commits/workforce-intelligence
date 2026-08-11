import { classifyQuery } from "./classifier.js";
import { POSTURE_TABLE } from "./postures.js";
import type { GuardrailDecision, PostureConfig } from "./types.js";

/**
 * Canned responses for postures that are classified correctly but not yet
 * implemented in this phase, and for the flag_and_route posture, which
 * NEVER reaches the agent regardless of phase. These strings are the entire
 * enforcement mechanism for "never recommends" — they are returned directly
 * by the router, in code, before any model call that could reason about the
 * request even happens.
 */
function shortCircuitMessageFor(posture: PostureConfig): string {
  switch (posture.kind) {
    case "flag_and_route":
      return (
        `This looks like a ${posture.decisionType.replace(/_/g, " ")} question. ` +
        `That decision type is routed to HR/Legal and is never analyzed or recommended on by this assistant. ` +
        `Your query has been logged and flagged for HR/Legal follow-up.`
      );
    case "analysis_only":
      return (
        `This looks like a ${posture.decisionType.replace(/_/g, " ")} question. ` +
        `That decision type isn't available yet in this phase of the assistant — in a later phase it will provide ` +
        `analysis only, without a recommendation.`
      );
    case "recommend_with_signoff":
      return (
        `This looks like a ${posture.decisionType.replace(/_/g, " ")} question. ` +
        `That decision type isn't available yet in this phase of the assistant — in a later phase it will ` +
        `require human sign-off before acting on any recommendation.`
      );
    case "recommend_freely":
      return (
        `This looks like a ${posture.decisionType.replace(/_/g, " ")} question, but that pathway isn't wired up yet.`
      );
  }
}

/**
 * The single entrypoint every incoming chat query must pass through before
 * it reaches agentRunner. This is the guardrail: it classifies the query,
 * resolves the governance posture for that classification, and decides in
 * code — not via a system-prompt instruction the model could ignore or be
 * talked out of — whether the agent's reasoning step is allowed to run at
 * all.
 */
export async function evaluateGuardrail(query: string): Promise<GuardrailDecision> {
  const classification = await classifyQuery(query);
  const posture = POSTURE_TABLE[classification.decisionType];

  const allowReasoning = posture.kind === "recommend_freely" && posture.implemented;

  return {
    classification,
    posture,
    allowReasoning,
    shortCircuitResponse: allowReasoning ? undefined : shortCircuitMessageFor(posture),
  };
}
