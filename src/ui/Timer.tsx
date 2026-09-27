import { useEffect, useRef, useState } from "react";
import type { ClientMessage } from "../../shared/types";

export function QuestionTimer({
  deadline,
  timedOut,
  limitMs,
  send,
}: {
  deadline: number | null;
  timedOut: boolean;
  limitMs: number | null;
  send?: (message: ClientMessage) => void;
}) {
  const remaining = useRemaining(deadline);
  const sendRef = useRef(send);
  sendRef.current = send;

  useEffect(() => {
    if (!deadline || timedOut || !sendRef.current) return;
    const wait = Math.max(0, deadline - Date.now()) + 80;
    const timer = window.setTimeout(() => sendRef.current?.({ type: "expire" }), wait);
    return () => window.clearTimeout(timer);
  }, [deadline, timedOut]);

  if (limitMs === null) return <p className="timer">無時限</p>;
  if (timedOut || (deadline !== null && remaining <= 0)) {
    return (
      <p className="timer danger" data-testid="timer">
        時間到
      </p>
    );
  }
  const total = Math.ceil(Math.max(0, remaining) / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return (
    <p className={total <= 10 ? "timer danger" : "timer"} data-testid="timer">
      {minutes}:{String(seconds).padStart(2, "0")}
    </p>
  );
}

function useRemaining(deadline: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!deadline) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [deadline]);
  if (!deadline) return 0;
  return deadline - now;
}
