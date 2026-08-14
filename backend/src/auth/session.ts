import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const SESSION_SECRET = process.env.SESSION_JWT_SECRET ?? "";
const COOKIE_NAME = "workforce_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h — re-login is cheap (one click), so a short-lived
// session cookie matters more than convenience here.

export interface SessionUser {
  email: string;
  name: string;
  employeeId: string;
  role: string;
}

export function issueSessionCookie(res: Response, user: SessionUser): void {
  if (!SESSION_SECRET) {
    throw new Error("SESSION_JWT_SECRET is not set — cannot issue a session.");
  }
  const token = jwt.sign(user, SESSION_SECRET, { expiresIn: SESSION_TTL_MS / 1000 });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_MS,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME);
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

/** Reads and verifies the session cookie if present; never rejects the request itself. */
export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token || !SESSION_SECRET) {
    next();
    return;
  }
  try {
    req.user = jwt.verify(token, SESSION_SECRET) as SessionUser;
  } catch {
    // Expired or tampered token — treat the same as logged out.
  }
  next();
}

/** Route guard: every /api/* route other than the auth routes themselves should use this. */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Not signed in." });
    return;
  }
  next();
}
