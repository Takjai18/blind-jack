import { DurableObject } from "cloudflare:workers";
import { cleanClientId, cleanNickname } from "../shared/code";
import { bundledQuestions } from "../shared/questions";
import { projectView } from "../shared/projectView";
import { beginHand, createRoom, forceReveal, hit, stand, submitEstimate } from "../shared/rules";
import type { ClientMessage, IntelMode, Role, RoomState, ServerMessage, TeamId } from "../shared/types";
import type { Env } from "./env";

interface Attachment {
  clientId: string;
  nickname: string;
  role: Role;
}

export class Room extends DurableObject<Env> {
  private state: RoomState | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.state = (await ctx.storage.get<RoomState>("state")) ?? null;
    });
  }

  async reserve(code: string): Promise<{ ok: boolean }> {
    if (this.state) return { ok: false };
    this.state = createRoom(code);
    await this.ctx.storage.put("state", this.state);
    return { ok: true };
  }

  async lookup(): Promise<{ exists: boolean; phase: RoomState["phase"] | null }> {
    if (!this.state) return { exists: false, phase: null };
    return { exists: true, phase: this.state.phase };
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("要用 WebSocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    try {
      await this.onMessage(ws, message);
    } catch (err) {
      console.log("room message failed", err instanceof Error ? err.message : "error");
      this.send(ws, { type: "error", payload: { message: "伺服器出錯，再試一次" } });
    }
  }

  async webSocketClose(ws: WebSocket) {
    const meta = this.meta(ws);
    if (!meta || !this.state) return;
    const others = this.ctx.getWebSockets().filter((sock) => {
      if (sock === ws) return false;
      return this.meta(sock)?.clientId === meta.clientId;
    });
    if (others.length > 0) return;
    const before = this.state.red.members.length + this.state.blue.members.length;
    this.removeMember(meta.clientId);
    const after = this.state.red.members.length + this.state.blue.members.length;
    if (before !== after) {
      this.state.revision += 1;
      await this.commit(null);
    }
  }

  async webSocketError() {
    // The close handler removes the player if this socket was their last one.
  }

  private async onMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (!this.state) {
      this.send(ws, { type: "error", payload: { message: "搵唔到呢間房" } });
      ws.close(1008, "no room");
      return;
    }
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    if (text.length > 4000) {
      this.send(ws, { type: "error", payload: { message: "訊息唔啱" } });
      return;
    }
    let msg: ClientMessage;
    try {
      msg = JSON.parse(text) as ClientMessage;
    } catch {
      this.send(ws, { type: "error", payload: { message: "訊息唔啱" } });
      return;
    }
    if (!msg || typeof msg !== "object" || typeof msg.type !== "string") {
      this.send(ws, { type: "error", payload: { message: "訊息唔啱" } });
      return;
    }
    if (msg.type === "ping") {
      this.send(ws, { type: "pong" });
      return;
    }
    if (msg.type === "join") {
      await this.onJoin(ws, msg.payload);
      return;
    }
    const meta = this.meta(ws);
    if (!meta) {
      this.send(ws, { type: "error", payload: { message: "請先加入房間" } });
      return;
    }
    if (msg.type === "setRole") {
      await this.onSetRole(ws, meta, msg.payload?.role);
      return;
    }
    if (msg.type === "setIntel") {
      await this.onSetIntel(ws, meta, msg.payload?.intel);
      return;
    }
    if (msg.type === "start" || msg.type === "restart") {
      await this.onStart(ws, meta, msg.type);
      return;
    }
    if (msg.type === "reveal") {
      await this.onReveal(ws, meta);
      return;
    }
    if (msg.type === "submitEstimate" || msg.type === "hit" || msg.type === "stand") {
      await this.onPlay(ws, meta, msg);
      return;
    }
    this.send(ws, { type: "error", payload: { message: "訊息唔啱" } });
  }

  private async onJoin(ws: WebSocket, payload: { clientId?: string; nickname?: string; role?: Role } | undefined) {
    if (!this.state || !payload) {
      this.send(ws, { type: "error", payload: { message: "訊息唔啱" } });
      return;
    }
    const clientId = cleanClientId(payload.clientId);
    const role = payload.role;
    if (!clientId || (role !== "display" && role !== "red" && role !== "blue")) {
      this.send(ws, { type: "error", payload: { message: "訊息唔啱" } });
      return;
    }
    const locked = this.currentRole(clientId);
    if (this.state.phase !== "lobby" && locked && locked !== role) {
      this.send(ws, { type: "error", payload: { message: "開咗波就唔可以轉隊" } });
      return;
    }
    if ((role === "red" || role === "blue") && this.teamFull(role, clientId)) {
      this.send(ws, { type: "error", payload: { message: "呢隊滿咗" } });
      return;
    }
    const nickname = cleanNickname(payload.nickname);
    ws.serializeAttachment({ clientId, nickname, role } satisfies Attachment);
    this.applyRole(clientId, nickname, role);
    this.state.revision += 1;
    await this.commit(null);
  }

  private async onSetRole(ws: WebSocket, meta: Attachment, role: Role | undefined) {
    if (!this.state) return;
    if (role !== "display" && role !== "red" && role !== "blue") {
      this.send(ws, { type: "error", payload: { message: "訊息唔啱" } });
      return;
    }
    if (this.state.phase !== "lobby") {
      this.send(ws, { type: "error", payload: { message: "開咗波就唔可以轉隊" } });
      return;
    }
    if ((role === "red" || role === "blue") && this.teamFull(role, meta.clientId)) {
      this.send(ws, { type: "error", payload: { message: "呢隊滿咗" } });
      return;
    }
    const next = { ...meta, role };
    ws.serializeAttachment(next);
    this.applyRole(next.clientId, next.nickname, role);
    this.state.revision += 1;
    await this.commit(null);
  }

  private async onSetIntel(ws: WebSocket, meta: Attachment, intel: IntelMode | undefined) {
    if (!this.state) return;
    if (meta.role !== "display") {
      this.send(ws, { type: "error", payload: { message: "只有投映主持可以轉模式" } });
      return;
    }
    if (this.state.phase === "playing") {
      this.send(ws, { type: "error", payload: { message: "開緊波唔可以轉模式" } });
      return;
    }
    if (intel !== "open" && intel !== "hidden") {
      this.send(ws, { type: "error", payload: { message: "訊息唔啱" } });
      return;
    }
    this.state.intel = intel;
    this.state.revision += 1;
    await this.commit(null);
  }

  private async onStart(ws: WebSocket, meta: Attachment, kind: "start" | "restart") {
    if (!this.state) return;
    if (meta.role !== "display") {
      this.send(ws, { type: "error", payload: { message: "只有投映主持可以開局" } });
      return;
    }
    if (kind === "start" && this.state.phase !== "lobby") {
      this.send(ws, { type: "error", payload: { message: "而家開緊波，要用再開一局" } });
      return;
    }
    let questions = bundledQuestions();
    try {
      const bank = this.env.BANK.get(this.env.BANK.idFromName("QUESTION_BANK"));
      const list = await bank.list();
      if (list.length > 0) questions = list;
    } catch (err) {
      console.log("question bank fallback", err instanceof Error ? err.message : "error");
    }
    try {
      this.state = beginHand(this.state, questions);
    } catch (err) {
      this.send(ws, { type: "error", payload: { message: err instanceof Error ? err.message : "開波失敗" } });
      return;
    }
    await this.commit(null);
  }

  private async onReveal(ws: WebSocket, meta: Attachment) {
    if (!this.state) return;
    if (meta.role !== "display") {
      this.send(ws, { type: "error", payload: { message: "只有投映主持可以揭曉" } });
      return;
    }
    const result = forceReveal(this.state);
    if (result.error) {
      this.send(ws, { type: "error", payload: { message: result.error } });
      return;
    }
    this.state = result.state;
    await this.commit(null);
  }

  private async onPlay(ws: WebSocket, meta: Attachment, msg: ClientMessage) {
    if (!this.state) return;
    if (meta.role !== "red" && meta.role !== "blue") {
      this.send(ws, { type: "error", payload: { message: "呢部機係投映，唔使入估計" } });
      return;
    }
    const result =
      msg.type === "hit"
        ? hit(this.state, meta.role)
        : msg.type === "stand"
          ? stand(this.state, meta.role)
          : msg.type === "submitEstimate"
            ? submitEstimate(
                this.state,
                meta.role,
                typeof msg.payload?.estimate === "number" ? msg.payload.estimate : Number.NaN,
              )
            : null;
    if (!result) {
      this.send(ws, { type: "error", payload: { message: "訊息唔啱" } });
      return;
    }
    if (result.error) {
      this.send(ws, { type: "error", payload: { message: result.error } });
      return;
    }
    this.state = result.state;
    await this.commit(result.secret);
  }

  private applyRole(clientId: string, nickname: string, role: Role) {
    if (!this.state) return;
    this.removeMember(clientId);
    if (role === "red" || role === "blue") {
      this.state[role].members.push({ id: clientId, nickname });
    }
    if (role === "display" && !this.state.hostId) this.state.hostId = clientId;
  }

  private removeMember(clientId: string) {
    if (!this.state) return;
    for (const team of ["red", "blue"] as const) {
      this.state[team].members = this.state[team].members.filter((member) => member.id !== clientId);
    }
  }

  private currentRole(clientId: string): Role | null {
    if (!this.state) return null;
    if (this.state.red.members.some((member) => member.id === clientId)) return "red";
    if (this.state.blue.members.some((member) => member.id === clientId)) return "blue";
    if (this.state.hostId === clientId) return "display";
    return null;
  }

  private teamFull(team: TeamId, clientId: string): boolean {
    if (!this.state) return false;
    const members = this.state[team].members;
    return members.length >= 20 && !members.some((member) => member.id === clientId);
  }

  private async commit(secret: { to: TeamId; actual: number; question: string } | null) {
    if (!this.state) return;
    await this.ctx.storage.put("state", this.state);
    this.broadcast(secret);
  }

  private broadcast(secret: { to: TeamId; actual: number; question: string } | null) {
    if (!this.state) return;
    for (const ws of this.ctx.getWebSockets()) {
      const meta = this.meta(ws);
      if (!meta) continue;
      if (secret && meta.role === secret.to) {
        this.send(ws, {
          type: "SECRET_REVEAL",
          payload: { actual: secret.actual, question: secret.question },
        });
      }
      this.send(ws, { type: "state", payload: projectView(this.state, meta.role) });
    }
  }

  private meta(ws: WebSocket): Attachment | null {
    const value = ws.deserializeAttachment() as Partial<Attachment> | null;
    if (!value || typeof value.clientId !== "string" || (value.role !== "display" && value.role !== "red" && value.role !== "blue")) {
      return null;
    }
    return { clientId: value.clientId, nickname: value.nickname ?? "隊友", role: value.role };
  }

  private send(ws: WebSocket, message: ServerMessage) {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // The socket is already closing.
    }
  }
}
