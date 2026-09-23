import type { Role } from "../shared/types";

const KEY = "blind-jack-session";

export interface Session {
  clientId: string;
  nickname: string;
  roleByRoom: Record<string, Role>;
}

export function loadSession(): Session {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Session>;
      if (parsed.clientId && /^[A-Za-z0-9_-]{8,80}$/.test(parsed.clientId)) {
        return {
          clientId: parsed.clientId,
          nickname: typeof parsed.nickname === "string" ? parsed.nickname : "",
          roleByRoom: parsed.roleByRoom ?? {},
        };
      }
    }
  } catch {
    // Start a new tab session if storage is blocked or corrupt.
  }
  const fresh: Session = {
    clientId: crypto.randomUUID(),
    nickname: "",
    roleByRoom: {},
  };
  sessionStorage.setItem(KEY, JSON.stringify(fresh));
  return fresh;
}

export function saveSession(session: Session) {
  sessionStorage.setItem(KEY, JSON.stringify(session));
}
