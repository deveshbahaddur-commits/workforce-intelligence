export interface SessionUser {
  email: string;
  name: string;
  employeeId: string;
  role: string;
}

export async function getMe(): Promise<SessionUser | null> {
  const res = await fetch("/auth/me", { credentials: "include" });
  if (!res.ok) return null;
  const data = await res.json();
  return data.user ?? null;
}

export async function logout(): Promise<void> {
  await fetch("/auth/logout", { method: "POST", credentials: "include" });
}

export function signInUrl(): string {
  return "/auth/google/start";
}
