import { useEffect, useRef, useState } from "react";
import type { ClientMessage, ClientView, TeamId } from "../../shared/types";
import type { SecretEvent } from "../useRoom";
import { NumPad } from "./NumPad";
import { QuestionTimer } from "./Timer";
import { RevealBoard } from "./Reveal";
import { Stars } from "./Stars";

export function PhonePlay({
  team,
  view,
  secret,
  status,
  clientId,
  send,
  onLeave,
}: {
  team: TeamId;
  view: ClientView;
  secret: SecretEvent | null;
  status: "connecting" | "live" | "closed";
  clientId: string;
  send: (message: ClientMessage) => void;
  onLeave?: () => void;
}) {
  const [splash, setSplash] = useState<{ actual: number; question: string; until: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const recentSplash = useRef<{ key: string; at: number } | null>(null);
  const mine = team === "red" ? view.red : view.blue;
  const opp = team === "red" ? view.blue : view.red;
  const myTurn = view.turn === team;
  const revealed = view.phase === "reveal" || view.phase === "finished";
  const iAmCaptain = mine.captainId === clientId;
  const captainName = mine.members.find((member) => member.id === mine.captainId)?.nickname;

  useEffect(() => {
    setBusy(false);
  }, [view.revision]);

  useEffect(() => {
    if (!secret) return;
    openSplash(secret.actual, secret.question, 3000);
  }, [secret?.id]);

  useEffect(() => {
    const last = view.lastSecret;
    if (!last) return;
    const remaining = 3000 - (Date.now() - last.at);
    if (remaining > 200) openSplash(last.actual, last.question, remaining);
  }, [view.lastSecret?.at]);

  useEffect(() => {
    if (!splash) return;
    const timer = window.setTimeout(() => setSplash(null), Math.max(0, splash.until - Date.now()));
    return () => window.clearTimeout(timer);
  }, [splash?.until]);

  function openSplash(actual: number, question: string, remaining: number) {
    const key = `${question}\n${actual}`;
    const now = Date.now();
    if (recentSplash.current?.key === key && now - recentSplash.current.at < 2500) return;
    recentSplash.current = { key, at: now };
    setSplash({ actual, question, until: now + remaining });
    navigator.vibrate?.([40, 30, 80]);
  }

  return (
    <main className={`phone ${team}`}>
      <header>
        <p className="kicker">盲猜21點 · 房號 {view.code}</p>
        <h1>{mine.name}</h1>
        <p className="status-pill">
          {status === "live" ? "已連線" : "連緊線…"}
          {iAmCaptain ? " · 你係隊長" : captainName ? ` · 隊長：${captainName}` : " · 未定隊長"}
        </p>
      </header>

      {view.phase === "lobby" && (
        <section className="panel">
          <p className="prompt">等主持開波</p>
          <p>{mine.members.map((member) => (member.id === mine.captainId ? `${member.nickname}（隊長）` : member.nickname)).join("、") || "你係第一個"}</p>
          <p>{captainName ? `隊長：${captainName}` : "未定隊長"}</p>
          {!iAmCaptain && (
            <button type="button" className="btn gold" data-testid="claim-captain" onClick={() => send({ type: "claimCaptain" })}>
              我做隊長
            </button>
          )}
          <p>{view.intel === "hidden" ? "模式二：完場先知道對手實際分數" : "模式一：估完會見到對手實際分數"}</p>
          {onLeave && (
            <button type="button" className="btn ghost" onClick={onLeave}>
              轉角色
            </button>
          )}
        </section>
      )}

      {revealed && <RevealBoard view={view} />}
      {revealed && !iAmCaptain && (
        <button type="button" className="btn gold" onClick={() => send({ type: "claimCaptain" })}>
          我做隊長
        </button>
      )}

      {view.phase === "playing" && (
        <>
          <QuestionTimer deadline={view.deadline} timedOut={view.timedOut} limitMs={view.timeLimitMs} send={send} />
          {myTurn && view.current && (
            <section>
              <Stars value={view.current.stars} />
              {view.current.category && <p className="category">{view.current.category}</p>}
              <h2 className="question" style={{ fontSize: "clamp(1.8rem, 8vw, 3rem)" }}>
                {view.current.question}
              </h2>
              {view.notice && <p className="hint">{view.notice}</p>}
            </section>
          )}
          {myTurn && iAmCaptain && view.awaiting === "estimate" && (
            <NumPad
              disabled={busy || status !== "live"}
              onSubmit={(estimate) => {
                setBusy(true);
                send({ type: "submitEstimate", payload: { estimate } });
              }}
            />
          )}
          {myTurn && !iAmCaptain && (
            <section className="panel">
              <p className="prompt">
                {view.timedOut ? "時間到，等隊長即刻入答案" : captainName ? `等隊長 ${captainName} 入答案` : "等主持指定隊長"}
              </p>
              <p className="hint">隊員可以一齊傾，只有隊長可以撳。</p>
            </section>
          )}
          {myTurn && iAmCaptain && view.awaiting === "decision" && (
            <section className="choice">
              <p className="prompt">要牌定停牌？</p>
              <div className="row" style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className="btn gold"
                  style={{ flex: 1, minHeight: 72, fontSize: "1.6rem" }}
                  data-testid="hit"
                  disabled={busy || status !== "live"}
                  onClick={() => {
                    setBusy(true);
                    send({ type: "hit" });
                  }}
                >
                  要牌
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  style={{ flex: 1, minHeight: 72, fontSize: "1.4rem" }}
                  data-testid="stand"
                  disabled={busy || status !== "live"}
                  onClick={() => {
                    setBusy(true);
                    send({ type: "stand" });
                  }}
                >
                  停牌（第3張起）
                </button>
              </div>
              <p className="hint">傾掂未？面對面討論完先入數</p>
            </section>
          )}
          {!myTurn && (
            <section className="panel">
              <p className="prompt">
                {view.awaiting === "decision"
                  ? `等${view.turn === "red" ? "紅隊" : "藍隊"}決定要牌定停牌`
                  : `等待${view.turn === "red" ? "紅隊" : "藍隊"}輸入估計…`}
              </p>
              {view.current && (
                <>
                  <Stars value={view.current.stars} />
                  <p>{view.current.question}</p>
                </>
              )}
            </section>
          )}

          <section className="intel" data-testid="intel">
            <h2>{view.intel === "hidden" ? "對手估計（實際分數要完場先揭）" : "對手真實分數（只有你哋見到）"}</h2>
            {view.intel !== "hidden" && (
              <p className="actual" data-testid="opp-sum">
                對手而家實際總分 {typeof opp.actualSum === "number" ? opp.actualSum : "—"}
              </p>
            )}
            {opp.cards.map((card) => (
              <div key={card.questionId} className="card" data-testid="opp-card">
                <Stars value={card.stars} />
                <p>{card.question}</p>
                <p className="estimate">
                  佢哋估 {card.estimate}
                  {typeof card.actual === "number" && (
                    <>
                      {" "}
                      · 實際 <span data-testid="card-actual">{card.actual}</span>
                    </>
                  )}
                </p>
              </div>
            ))}
            {opp.cards.length === 0 && <p className="hint">對手未取過牌</p>}
            <p className="hint">你哋自己真實分數要完場先揭</p>
          </section>

          <section>
            <h2 style={{ fontSize: "1.1rem" }}>你哋估計總分 {mine.estimateSum}</h2>
            {mine.stood && <p className="stood">你哋停咗牌</p>}
            {mine.cards.map((card) => (
              <div key={card.questionId} className="card" data-testid="own-card">
                <Stars value={card.stars} />
                <p>{card.question}</p>
                <p className="estimate">你哋估：{card.estimate}</p>
              </div>
            ))}
          </section>
        </>
      )}

      {splash && (
        <button type="button" className="secret" data-testid="secret-overlay" onClick={() => setSplash(null)}>
          <p>只有你哋見到</p>
          <p>呢張真實答案</p>
          <p className="secret-number" data-testid="secret-number">
            {splash.actual}
          </p>
          <p className="secret-q">{splash.question}</p>
          <p className="hint">輕觸可以收起</p>
        </button>
      )}
    </main>
  );
}
