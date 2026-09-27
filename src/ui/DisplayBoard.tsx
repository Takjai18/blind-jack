import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { ClientView, TeamView } from "../../shared/types";
import type { ClientMessage } from "../../shared/types";
import { RevealBoard } from "./Reveal";
import { Stars } from "./Stars";
import { QuestionTimer } from "./Timer";
import { Track } from "./Track";

export function DisplayBoard({
  view,
  status,
  send,
  onLeave,
}: {
  view: ClientView;
  status: "connecting" | "live" | "closed";
  send: (message: ClientMessage) => void;
  onLeave?: () => void;
}) {
  const [banner, setBanner] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const joinUrl = `${location.origin}/r/${view.code}`;
  const playing = view.phase === "playing";
  const revealed = view.phase === "reveal" || view.phase === "finished";
  const localHost = location.hostname === "localhost" || location.hostname === "127.0.0.1";

  useEffect(() => {
    if (!view.announcement || view.phase !== "playing") return;
    setBanner(true);
    const timer = window.setTimeout(() => setBanner(false), 4000);
    return () => window.clearTimeout(timer);
  }, [view.announcement?.at, view.phase]);

  if (view.phase === "lobby") {
    return (
      <main className="lobby-board">
        <section className="lobby-side">
          <p className="kicker">盲猜21點</p>
          <h1 className="room-code">房號 {view.code}</h1>
          <p className="turn-line">{turnLine(view)}</p>
          <p className="status-pill">{status === "live" ? "投映已連線" : "連緊線…"}</p>
          <ModePicker intel={view.intel} send={send} />
          <TimePicker limitMs={view.timeLimitMs} send={send} />
          <div className="lobby-teams">
            <TeamColumn team={view.red} tone="red" send={send} />
            <TeamColumn team={view.blue} tone="blue" send={send} />
          </div>
        </section>
        <JoinQr url={joinUrl} large />
        <footer className="board-foot">
          {localHost && <p className="warn">而家用緊 localhost，手機掃碼會入唔到。請用電腦嘅區網網址開投映。</p>}
          {captainGap(view) && <p className="warn">{captainGap(view)}</p>}
          <button
            type="button"
            className="btn gold"
            data-testid="start-game"
            disabled={captainGap(view) !== null}
            onClick={() => send({ type: "start" })}
          >
            用而家題庫開局
          </button>
          {onLeave && (
            <button type="button" className="btn ghost" onClick={onLeave}>
              轉角色
            </button>
          )}
        </footer>
      </main>
    );
  }

  return (
    <main className="board">
      <header className="board-head">
        <div>
          <p className="kicker" style={{ margin: 0 }}>
            盲猜21點
          </p>
          <h1 className="room-code">房號 {view.code}</h1>
          <p className="turn-line">{turnLine(view)}</p>
          <p className="status-pill">
            {status === "live" ? "投映已連線" : "連緊線…"} · {modeLabel(view.intel)}
          </p>
        </div>
        <JoinQr url={joinUrl} />
      </header>

      <div className="board-main">
        {playing && (
          <section className="question-block">
            {view.current && <Stars value={view.current.stars} />}
            {view.current?.category && <p className="category">{view.current.category}</p>}
            <QuestionTimer deadline={view.deadline} timedOut={view.timedOut} limitMs={view.timeLimitMs} send={send} />
            <h2 className="question">{view.current?.question ?? "等緊下一題"}</h2>
            {view.notice && <p className="notice">{view.notice}</p>}
            <p className="status-line" data-testid="status-line">
              {view.timedOut
                ? "時間到，請隊長即刻入答案"
                : view.awaiting === "decision"
                  ? "要牌定停牌？"
                  : `等待${view.turn === "red" ? "紅隊" : "藍隊"}輸入估計…`}
            </p>
            {banner && <p className="flash">真實答案已送到對手手機</p>}
          </section>
        )}

        {playing && (
          <section className="columns">
            <TeamColumn team={view.red} tone="red" send={send} />
            <TeamColumn team={view.blue} tone="blue" send={send} />
          </section>
        )}

        {revealed && <RevealBoard view={view} />}
      </div>

      {playing && (
        <section>
          <p className="kicker" style={{ margin: "0 0 6px" }}>
            估分軌道（0 到 21+）
          </p>
          <div className="tracks">
            <Track name="紅隊" value={view.red.estimateSum} tone="red" />
            <Track name="藍隊" value={view.blue.estimateSum} tone="blue" />
          </div>
        </section>
      )}

      <footer className="board-foot">
        <span>仲有 {view.deckRemaining} 題</span>
        {playing && !confirmEnd && (
          <button type="button" className="btn ghost" data-testid="reveal-now" onClick={() => setConfirmEnd(true)}>
            揭曉
          </button>
        )}
        {playing && confirmEnd && (
          <span className="row">
            <span>確定揭曉？</span>
            <button type="button" className="btn gold" data-testid="reveal-confirm" onClick={() => send({ type: "reveal" })}>
              確定
            </button>
            <button type="button" className="btn ghost" onClick={() => setConfirmEnd(false)}>
              取消
            </button>
          </span>
        )}
        {revealed && <TimePicker limitMs={view.timeLimitMs} send={send} />}
        {revealed && (
          <div className="replay-choice">
            <button type="button" className="btn gold" data-testid="replay-keep" onClick={() => send({ type: "restart" })}>
              {view.intel === "hidden" ? "保持模式二：唔知對手分數" : "保持模式一：知道對手分數"}
            </button>
            <button
              type="button"
              className="btn"
              data-testid="replay-switch"
              onClick={() =>
                send({
                  type: "restart",
                  payload: { intel: view.intel === "hidden" ? "open" : "hidden" },
                })
              }
            >
              {view.intel === "hidden" ? "改為模式一：知道對手分數" : "改為模式二：唔知對手分數"}
            </button>
          </div>
        )}

      </footer>
    </main>
  );
}

function TimePicker({ limitMs, send }: { limitMs: number | null; send: (message: ClientMessage) => void }) {
  const [custom, setCustom] = useState("");
  const seconds = limitMs === null ? null : Math.round(limitMs / 1000);
  const pick = (value: number | null) => send({ type: "setTimeLimit", payload: { seconds: value } });
  const chosen = (value: number | null) => (seconds === value ? "btn gold" : "btn ghost");
  return (
    <div className="time-picker">
      <p className="kicker">每題時限</p>
      <div className="row">
        <button type="button" className={chosen(null)} onClick={() => pick(null)}>
          無時限
        </button>
        <button type="button" className={chosen(30)} data-testid="time-30" onClick={() => pick(30)}>
          30秒
        </button>
        <button type="button" className={chosen(60)} data-testid="time-60" onClick={() => pick(60)}>
          1分鐘
        </button>
      </div>
      <div className="row">
        <input
          inputMode="numeric"
          placeholder="自訂秒數"
          aria-label="自訂秒數"
          value={custom}
          onChange={(event) => setCustom(event.target.value.replace(/[^\d]/g, "").slice(0, 3))}
        />
        <button type="button" className="btn" data-testid="time-custom" onClick={() => pick(Number(custom))}>
          自訂
        </button>
      </div>
    </div>
  );
}

function modeLabel(intel: "open" | "hidden") {
  return intel === "hidden" ? "模式二：唔知對手分數" : "模式一：知道對手分數";
}

function ModePicker({
  intel,
  send,
}: {
  intel: "open" | "hidden";
  send: (message: ClientMessage) => void;
}) {
  return (
    <div className="row">
      <button
        type="button"
        data-testid="mode-open"
        className={intel === "open" ? "btn gold" : "btn ghost"}
        onClick={() => send({ type: "setIntel", payload: { intel: "open" } })}
      >
        模式一：知道對手分數
      </button>
      <button
        type="button"
        data-testid="mode-hidden"
        className={intel === "hidden" ? "btn gold" : "btn ghost"}
        onClick={() => send({ type: "setIntel", payload: { intel: "hidden" } })}
      >
        模式二：唔知對手分數
      </button>
    </div>
  );
}

function JoinQr({ url, large }: { url: string; large?: boolean }) {
  const [svg, setSvg] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(url, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((markup) => {
        if (!cancelled) setSvg(markup);
      })
      .catch(() => {
        if (!cancelled) setSvg("");
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <aside className={large ? "qr big" : "qr"}>
      <div className="qr-svg" dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label={`掃碼加入 ${url}`} />
      {large && <p className="qr-url">{url.replace(/^https?:\/\//, "")}</p>}
      {large && (
        <button
          type="button"
          className="btn"
          onClick={() => {
            void navigator.clipboard.writeText(url).then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          {copied ? "複製咗" : "複製連結"}
        </button>
      )}
    </aside>
  );
}

function turnLine(view: ClientView): string {
  if (view.phase === "lobby") return "等大家入房";
  if (view.phase === "reveal" || view.phase === "finished") return "揭曉";
  return `而家輪到${view.turn === "red" ? "紅隊" : "藍隊"}`;
}

function captainGap(view: ClientView): string | null {
  if (view.red.members.length > 0 && !view.red.captainId) return "紅隊未定隊長";
  if (view.blue.members.length > 0 && !view.blue.captainId) return "藍隊未定隊長";
  return null;
}

function TeamColumn({
  team,
  tone,
  send,
}: {
  team: TeamView;
  tone: "red" | "blue";
  send: (message: ClientMessage) => void;
}) {
  const cards = team.cards.map((card) => ({
    questionId: card.questionId,
    question: card.question,
    stars: card.stars,
    estimate: card.estimate,
  }));
  return (
    <article className={`column ${tone}`}>
      <div className="team-head">
        <h2>{team.name}</h2>
        {team.stood && <span className="stood">{team.name}停牌</span>}
      </div>
      <p className="members">
        {team.members.length === 0
          ? "未有人加入"
          : team.members.map((member) => (member.id === team.captainId ? `${member.nickname}（隊長）` : member.nickname)).join("、")}
      </p>
      {team.members.length > 0 && (
        <div className="row">
          {team.members.map((member) => (
            <button
              key={member.id}
              type="button"
              className={member.id === team.captainId ? "btn gold" : "btn ghost"}
              onClick={() => send({ type: "setCaptain", payload: { team: team.id, clientId: member.id } })}
            >
              {member.id === team.captainId ? `${member.nickname}係隊長` : `換 ${member.nickname} 做隊長`}
            </button>
          ))}
        </div>
      )}
      {cards.map((card) => (
        <div key={card.questionId} className="card" data-testid="public-card">
          <Stars value={card.stars} />
          <p>{card.question}</p>
          <p className="estimate">估 {card.estimate}</p>
        </div>
      ))}
    </article>
  );
}
