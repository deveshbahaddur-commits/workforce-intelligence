// The HTTP-only entry point, deliberately — the default "@libsql/client"
// entry unconditionally requires the native `libsql` binary even when
// only ever talking to a remote libsql:// URL, and that binary failed to
// load on this Windows setup (missing VC++ runtime DLLs). This entry has
// no native dependency at all: pure HTTP to Turso, same Client API.
import { createClient, type Client } from "@libsql/client/http";

// .trim() deliberately — a stray trailing newline from a copy-paste into a
// dashboard env var field (e.g. Render's) turns an otherwise-valid URL into
// an invalid one (encoded as a literal %0A), which is exactly what happened
// on first deploy here. Cheap enough to always do.
const url = process.env.TURSO_DATABASE_URL?.trim();
const authToken = process.env.TURSO_AUTH_TOKEN?.trim() || undefined;

if (!url) {
  throw new Error(
    "TURSO_DATABASE_URL is not set. Create a free database at turso.tech and set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN in .env.",
  );
}

export const db: Client = createClient({ url, authToken });
