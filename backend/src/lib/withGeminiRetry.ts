const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 800;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getStatusCode(err: unknown): number | undefined {
  if (err && typeof err === "object" && "status" in err) {
    const status = (err as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

/**
 * Retries a Gemini call on transient overload (503 UNAVAILABLE, "high
 * demand") with short exponential backoff — we've hit this repeatedly in
 * both dev and production, and it usually clears within a couple of
 * seconds. Deliberately does NOT retry 429 (RESOURCE_EXHAUSTED): on this
 * key that's the free tier's *daily* quota, which won't reset within a
 * request's lifetime, so retrying would just make the user wait for an
 * error that's still coming.
 */
/** Friendlier text for the two Gemini failure modes users actually hit, for API error responses. */
export function describeGeminiError(err: unknown): string {
  const status = getStatusCode(err);
  if (status === 503) {
    return "Gemini is experiencing high demand right now — please try again in a moment.";
  }
  if (status === 429) {
    return "The Gemini API quota has been used up for now — please try again later.";
  }
  return "Something went wrong processing that request.";
}

export async function withGeminiRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = getStatusCode(err);
      if (status !== 503 || attempt === MAX_ATTEMPTS) {
        throw err;
      }
      const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
      console.warn(`Gemini 503 (high demand), retrying in ${delay}ms — attempt ${attempt}/${MAX_ATTEMPTS}`);
      await sleep(delay);
    }
  }
  throw lastError;
}
