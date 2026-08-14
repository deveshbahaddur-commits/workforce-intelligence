import { OAuth2Client } from "google-auth-library";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? "";
// Comma-separated — the HRIS sheet's "Official Mail ID" column spans more
// than one domain (recykal.com plus at least one group entity, e.g.
// anubhutiwelfare.org), so a single hardcoded domain would lock those
// employees out even though they're legitimate.
const ALLOWED_DOMAINS = (process.env.ALLOWED_EMAIL_DOMAINS ?? "recykal.com")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

export function getGoogleAuthUrl(): string {
  return client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
  });
}

export interface GoogleProfile {
  email: string;
  name: string;
}

/**
 * Exchanges an OAuth `code` for a verified Google identity. Throws on any
 * failure — invalid code, unverified email, or an email outside
 * ALLOWED_DOMAIN — the caller (the /auth/google/callback route) turns that
 * into a redirect back to the login page with an error, never a session.
 */
export async function exchangeCodeForProfile(code: string): Promise<GoogleProfile> {
  if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
    throw new Error("Google OAuth is not configured — set GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI.");
  }

  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) {
    throw new Error("Google did not return an ID token.");
  }

  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: CLIENT_ID });
  const payload = ticket.getPayload();
  if (!payload?.email) {
    throw new Error("Google account has no email on the ID token.");
  }
  if (!payload.email_verified) {
    throw new Error("Google email is not verified.");
  }

  const email = payload.email.toLowerCase();
  if (!ALLOWED_DOMAINS.some((domain) => email.endsWith(`@${domain}`))) {
    throw new Error(`Only accounts on ${ALLOWED_DOMAINS.join(", ")} can sign in.`);
  }

  return { email, name: payload.name ?? email };
}
