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

export async function login(email: string, password: string): Promise<SessionUser> {
  const res = await fetch("/auth/login", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Sign-in failed.");
  }
  return data.user as SessionUser;
}

export async function logout(): Promise<void> {
  await fetch("/auth/logout", { method: "POST", credentials: "include" });
}
