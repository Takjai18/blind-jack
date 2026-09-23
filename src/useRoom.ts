import { useEffect, useRef, useState } from "react";
import type { ClientMessage, ClientView, Role, ServerMessage } from "../shared/types";

export interface SecretEvent {
  id: number;
  actual: number;
  question: string;
}

export function useRoom(opts: { code: string; role: Role; nickname: string; clientId: string }) {
  const [view, setView] = useState<ClientView | null>(null);
  const [secret, setSecret] = useState<SecretEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "closed">("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    let stopped = false;
    let timer = 0;
    let attempt = 0;

    const connect = () => {
      if (stopped) return;
      const current = optsRef.current;
      const proto = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket(`${proto}://${location.host}/ws?room=${encodeURIComponent(current.code)}`);
      wsRef.current = ws;
      setStatus("connecting");
      ws.onopen = () => {
        if (stopped || wsRef.current !== ws) return;
        attempt = 0;
        setStatus("live");
        const joined = optsRef.current;
        const message: ClientMessage = {
          type: "join",
          payload: { clientId: joined.clientId, nickname: joined.nickname, role: joined.role },
        };
        ws.send(JSON.stringify(message));
      };
      ws.onmessage = (event) => {
        let message: ServerMessage;
        try {
          message = JSON.parse(String(event.data)) as ServerMessage;
        } catch {
          return;
        }
        if (message.type === "state") setView(message.payload);
        if (message.type === "SECRET_REVEAL") {
          setSecret({ id: Date.now(), actual: message.payload.actual, question: message.payload.question });
        }
        if (message.type === "error") setError(message.payload.message);
      };
      ws.onclose = () => {
        if (stopped || wsRef.current !== ws) return;
        setStatus("closed");
        const wait = Math.min(5000, 400 * 2 ** attempt);
        attempt += 1;
        timer = window.setTimeout(connect, wait);
      };
    };

    connect();
    const ping = window.setInterval(() => {
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" } satisfies ClientMessage));
    }, 20000);
    const onVisible = () => {
      if (document.visibilityState !== "visible" || stopped) return;
      const ws = wsRef.current;
      if (!ws || ws.readyState === WebSocket.CLOSED) {
        window.clearTimeout(timer);
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.clearInterval(ping);
      document.removeEventListener("visibilitychange", onVisible);
      wsRef.current?.close();
    };
  }, [opts.code, opts.role, opts.clientId, opts.nickname]);

  const send = (message: ClientMessage) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
    else setError("未連上房間，等一陣再試");
  };

  return { view, secret, error, setError, status, send };
}
