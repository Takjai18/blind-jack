import { useEffect, useState } from "react";
import QRCode from "qrcode";
import type { ClientView, TeamView } from "../../shared/types";
import type { ClientMessage } from "../../shared/types";
import { RevealBoard } from "./Reveal";
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
          <div className="lobby-teams">
            <TeamColumn team={view.red} tone="red" />
            <TeamColumn team={view.blue} tone="blue" />
          </div>
        </section>
        <JoinQr url={joinUrl} large />
        <footer className="board-foot">
          {localHost && <p className="warn">而家用緊 localhost，手機掃碼會入唔到。請用電腦嘅區網網址開投映。</p>}
          <button type="button" className="btn gold" data-testid="start-game" onClick={() => send({ type: "start" })}>
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
          <p className="status-pill">{status === "live" ? "投映已連線" : "連緊線…"}</p>
        </div>
        <JoinQr url={joinUrl} />
      </header>

      <div className="board-main">
        {playing && (
          <section className="question-block">
            {view.current?.category && <p className="category">{view.current.category}</p>}
            <h2 className="question">{view.current?.question ?? "等緊下一題"}</h2>
            <p className="status-line" data-testid="status-line">
              {view.awaiting === "decision" ? "要牌定停牌？" : `等待${view.turn === "red" ? "紅隊" : "藍隊"}輸入估計…`}
            </p>
            {banner && <p className="flash">真實答案已送到對手手機</p>}
          </section>
        )}

        {playing && (
          <section className="columns">
            <TeamColumn team={view.red} tone="red" />
            <TeamColumn team={view.blue} tone="blue" />
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
        {revealed && (
          <button type="button" className="btn gold" data-testid="restart" onClick={() => send({ type: "restart" })}>
            再開一局
          </button>
        )}

      </footer>
    </main>
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

function TeamColumn({ team, tone }: { team: TeamView; tone: "red" | "blue" }) {
  const cards = team.cards.map((card) => ({
    questionId: card.questionId,
    question: card.question,
    estimate: card.estimate,
  }));
  return (
    <article className={`column ${tone}`}>
      <div className="team-head">
        <h2>{team.name}</h2>
        {team.stood && <span className="stood">{team.name}停牌</span>}
      </div>
      <p className="members">{team.members.length ? team.members.map((member) => member.nickname).join("、") : "未有人加入"}</p>
      {cards.map((card) => (
        <div key={card.questionId} className="card" data-testid="public-card">
          <p>{card.question}</p>
          <p className="estimate">估 {card.estimate}</p>
        </div>
      ))}
    </article>
  );
}
