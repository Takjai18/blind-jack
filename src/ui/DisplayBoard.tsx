import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { winnerLine } from "../../shared/rules";
import type { ClientMessage, ClientView, TeamId, TeamView } from "../../shared/types";
import { TeamPanel } from "./Reveal";
import { Stars } from "./Stars";
import { QuestionTimer } from "./Timer";

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
  const [captainsOpen, setCaptainsOpen] = useState(false);
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

  useEffect(() => {
    if (!captainsOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCaptainsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [captainsOpen]);

  const drawer = (
    <CaptainDrawer
      open={captainsOpen}
      view={view}
      send={send}
      onClose={() => setCaptainsOpen(false)}
    />
  );

  if (view.phase === "lobby") {
    return (
      <div className="stage-root">
        <main className="lobby-stage">
          <header className="stage-bar">
            <div className="stage-brand">
              <p className="kicker">盲猜21點</p>
              <p className="room-code">房號 {view.code}</p>
              <p className="status-pill">{status === "live" ? "投映已連線" : "連緊線…"}</p>
            </div>
            <div className="stage-actions">
              <button
                type="button"
                className="btn ghost"
                data-testid="open-captains"
                aria-expanded={captainsOpen}
                onClick={() => setCaptainsOpen((open) => !open)}
              >
                換隊長
              </button>
              {onLeave && (
                <button type="button" className="btn ghost" onClick={onLeave}>
                  轉角色
                </button>
              )}
            </div>
          </header>

          <section className="lobby-main">
            <ModePicker intel={view.intel} send={send} />
            <TimePicker limitMs={view.timeLimitMs} send={send} />
            <div className="score-row">
              <LobbyTeam team={view.red} tone="red" />
              <LobbyTeam team={view.blue} tone="blue" />
            </div>
            {localHost && <p className="warn">而家用緊 localhost，手機掃碼會入唔到。請用電腦嘅區網網址開投映。</p>}
            {captainGap(view) && <p className="warn">{captainGap(view)}</p>}
          </section>

          <JoinQr url={joinUrl} large />

          <footer className="stage-foot">
            <button
              type="button"
              className="btn gold wide"
              data-testid="start-game"
              disabled={captainGap(view) !== null}
              onClick={() => send({ type: "start" })}
            >
              用而家題庫開局
            </button>
          </footer>
        </main>
        {drawer}
      </div>
    );
  }

  return (
    <div className="stage-root">
      <main className={revealed ? "stage revealing" : "stage"}>
        <header className="stage-bar">
          <div className="stage-brand">
            <p className="kicker">盲猜21點 · 房號 {view.code}</p>
            <p className="turn-line">{turnLine(view)}</p>
            <p className="status-pill">
              {status === "live" ? "投映已連線" : "連緊線…"} · {modeLabel(view.intel)} · 仲有 {view.deckRemaining} 題
            </p>
          </div>
          <JoinQr url={joinUrl} />
          <div className="stage-actions">
            <button
              type="button"
              className="btn ghost"
              data-testid="open-captains"
              aria-expanded={captainsOpen}
              onClick={() => setCaptainsOpen((open) => !open)}
            >
              換隊長
            </button>
            {playing && !confirmEnd && (
              <button type="button" className="btn ghost" data-testid="reveal-now" onClick={() => setConfirmEnd(true)}>
                揭曉
              </button>
            )}
            {playing && confirmEnd && (
              <>
                <span className="confirm-label">確定揭曉？</span>
                <button type="button" className="btn gold" data-testid="reveal-confirm" onClick={() => send({ type: "reveal" })}>
                  確定
                </button>
                <button type="button" className="btn ghost" onClick={() => setConfirmEnd(false)}>
                  取消
                </button>
              </>
            )}
          </div>
        </header>

        {playing && (
          <section className="stage-question">
            <div className="stage-q-meta">
              <div>
                {view.current && <Stars value={view.current.stars} />}
                {view.current?.category && <p className="category">{view.current.category}</p>}
              </div>
              <QuestionTimer deadline={view.deadline} timedOut={view.timedOut} limitMs={view.timeLimitMs} send={send} />
            </div>
            <div className="stage-q-text">
              <div>
                <h2 className="question">{view.current?.question ?? "等緊下一題"}</h2>
                {view.notice && <p className="notice">{view.notice}</p>}
                {banner && <p className="flash">真實答案已送到對手手機</p>}
              </div>
            </div>
            <p className="status-line" data-testid="status-line">
              {view.awaiting === "decision" ? "要牌定停牌？" : `等待${view.turn === "red" ? "紅隊" : "藍隊"}輸入估計…`}
            </p>
          </section>
        )}

        {playing && (
          <section className="score-row">
            <TeamPanel team={view.red} tone="red" active={view.turn === "red"} />
            <TeamPanel team={view.blue} tone="blue" active={view.turn === "blue"} />
          </section>
        )}

        {revealed && (
          <section className="reveal-fit" data-testid="reveal-screen">
            <div className="reveal-banner">
              <h2 data-testid="winner">{winnerLine(view.winner) || "揭曉"}</h2>
              <p className="hint">最接近 21、又未爆嘅一隊贏。</p>
            </div>
            <div className="score-row">
              <TeamPanel team={view.red} tone="red" showActual />
              <TeamPanel team={view.blue} tone="blue" showActual />
            </div>
          </section>
        )}

        {revealed && (
          <footer className="stage-foot">
            <TimePicker limitMs={view.timeLimitMs} send={send} />
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
          </footer>
        )}
      </main>
      {drawer}
    </div>
  );
}

function LobbyTeam({ team, tone }: { team: TeamView; tone: "red" | "blue" }) {
  const captain = team.members.find((member) => member.id === team.captainId)?.nickname;
  return (
    <article className={`score-panel ${tone}`}>
      <header className="score-panel-head">
        <div className="score-panel-name">
          <h2>{team.name}</h2>
          <p className="captain-line">{captain ? `隊長 ${captain}` : "未定隊長"}</p>
        </div>
        <p className="member-count">{team.members.length} 人</p>
      </header>
      <ul className="history">
        {team.members.length === 0 && <li className="history-empty">未有人加入</li>}
        {team.members.map((member) => (
          <li key={member.id} className="history-row" title={member.nickname}>
            <span className="history-q">{member.nickname}</span>
            {member.id === team.captainId && <span className="history-est">隊長</span>}
          </li>
        ))}
      </ul>
    </article>
  );
}

function CaptainDrawer({
  open,
  view,
  send,
  onClose,
}: {
  open: boolean;
  view: ClientView;
  send: (message: ClientMessage) => void;
  onClose: () => void;
}) {
  return (
    <>
      {open && <button type="button" className="drawer-backdrop" aria-label="關閉換隊長" onClick={onClose} />}
      <aside className={open ? "captain-drawer open" : "captain-drawer"} inert={!open} aria-hidden={!open} role="dialog" aria-label="換隊長">
        <div className="drawer-head">
          <h2>換隊長</h2>
          <button type="button" className="btn ghost" onClick={onClose}>
            關閉
          </button>
        </div>
        <p className="hint">平時收埋。開波之後只有投映主持可以換。</p>
        <CaptainList team={view.red} send={send} />
        <CaptainList team={view.blue} send={send} />
      </aside>
    </>
  );
}

function CaptainList({ team, send }: { team: TeamView; send: (message: ClientMessage) => void }) {
  return (
    <section className={`drawer-team ${team.id}`}>
      <h3>{team.name}</h3>
      {team.members.length === 0 && <p className="history-empty">未有人加入</p>}
      {team.members.map((member) => (
        <button
          key={member.id}
          type="button"
          className={member.id === team.captainId ? "btn gold wide" : "btn ghost wide"}
          onClick={() => send({ type: "setCaptain", payload: { team: team.id as TeamId, clientId: member.id } })}
        >
          {member.id === team.captainId ? `${member.nickname} · 隊長` : `換 ${member.nickname} 做隊長`}
        </button>
      ))}
    </section>
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
