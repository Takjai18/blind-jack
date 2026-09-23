import { ROOM_CODE, normalizeCode } from "../shared/code";
import type { Env } from "./env";

export { QuestionBank } from "./bank";
export { Room } from "./room";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/ws") return handleSocket(request, env);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env, url);
    return env.ASSETS.fetch(request);
  },
};

async function handleSocket(request: Request, env: Env): Promise<Response> {
  if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
    return json({ error: "要用 WebSocket" }, 426);
  }
  const code = normalizeCode(new URL(request.url).searchParams.get("room") ?? "");
  if (!ROOM_CODE.test(code)) return json({ error: "房號唔啱" }, 400);
  const room = env.ROOM.get(env.ROOM.idFromName(code));
  const found = await room.lookup();
  if (!found.exists) return json({ error: "搵唔到呢間房" }, 404);
  return room.fetch(request);
}

async function handleApi(request: Request, env: Env, url: URL): Promise<Response> {
  if (url.pathname === "/api/health") return json({ ok: true });
  if (url.pathname === "/api/rooms" && request.method === "POST") {
    try {
      return json({ code: await createRoom(env) });
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : "開房失敗" }, 500);
    }
  }
  const roomMatch = url.pathname.match(/^\/api\/rooms\/([A-Za-z0-9]{4,6})$/);
  if (roomMatch && request.method === "GET") {
    const code = normalizeCode(roomMatch[1] ?? "");
    if (!ROOM_CODE.test(code)) return json({ error: "房號唔啱" }, 400);
    const found = await env.ROOM.get(env.ROOM.idFromName(code)).lookup();
    if (!found.exists) return json({ error: "搵唔到呢間房" }, 404);
    return json({ code, phase: found.phase });
  }
  if (url.pathname.startsWith("/api/admin/questions")) {
    if (!passwordOk(request, env)) return json({ error: "密碼唔啱" }, 401);
    return handleBank(request, env, url);
  }
  return json({ error: "找不到" }, 404);
}

async function createRoom(env: Env): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = makeCode();
    const reserved = await env.ROOM.get(env.ROOM.idFromName(code)).reserve(code);
    if (reserved.ok) return code;
  }
  throw new Error("開房失敗，再試一次");
}

function makeCode(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

async function handleBank(request: Request, env: Env, url: URL): Promise<Response> {
  const bank = env.BANK.get(env.BANK.idFromName("QUESTION_BANK"));
  const item = url.pathname.match(/^\/api\/admin\/questions\/([^/]+)$/);
  if (request.method === "GET" && !item) return json(await bank.list());
  if (request.method === "POST" && !item) {
    const result = await bank.add(await readJson(request));
    return json(result.ok ? result.questions : { error: result.error }, result.ok ? 200 : 400);
  }
  if (request.method === "PUT" && !item) {
    const body = await readJson(request);
    const list = Array.isArray(body)
      ? body
      : body && typeof body === "object" && Array.isArray((body as { questions?: unknown }).questions)
        ? (body as { questions: unknown[] }).questions
        : null;
    if (!list) return json({ error: "JSON 要係題目陣列" }, 400);
    const result = await bank.replace(list);
    return json(result.ok ? result.questions : { error: result.error }, result.ok ? 200 : 400);
  }
  if (item && request.method === "PUT") {
    const result = await bank.update(decodeURIComponent(item[1] ?? ""), await readJson(request));
    return json(result.ok ? result.questions : { error: result.error }, result.ok ? 200 : 400);
  }
  if (item && request.method === "DELETE") {
    const result = await bank.remove(decodeURIComponent(item[1] ?? ""));
    return json(result.ok ? result.questions : { error: result.error }, result.ok ? 200 : 400);
  }
  return json({ error: "找不到" }, 404);
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function passwordOk(request: Request, env: Env): boolean {
  const given = request.headers.get("x-admin-password") ?? "";
  const expected = env.ADMIN_PASSWORD || "icebreak";
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
