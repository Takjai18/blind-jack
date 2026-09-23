export const ROOM_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const ROOM_CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4,6}$/;

export function normalizeCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function cleanNickname(input: unknown): string {
  const raw = typeof input === "string" ? input : "";
  const cleaned = raw.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 16);
  return cleaned || "隊友";
}

export function cleanClientId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(input)) return null;
  return input;
}
