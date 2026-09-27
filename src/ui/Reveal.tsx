import { useEffect, useRef } from "react";
import { winnerLine } from "../../shared/rules";
import type { ClientView, TeamView } from "../../shared/types";
import { Stars } from "./Stars";

export function RevealBoard({
  view,
  onRestart,
}: {
  view: ClientView;
  onRestart?: () => void;
}) {
  return (
    <section className="reveal" data-testid="reveal-screen">
      <p className="kicker">揭曉實際分數</p>
      <h2 data-testid="winner">{winnerLine(view.winner) || "揭曉"}</h2>
      <p className="hint">最接近 21、又未爆嘅一隊贏。</p>
      <div className="score-grid">
        <PhoneScore team={view.red} tone="red" />
        <PhoneScore team={view.blue} tone="blue" />
      </div>
      {onRestart && (
        <button type="button" className="btn gold" data-testid="restart" onClick={onRestart}>
          再開一局
        </button>
      )}
    </section>
  );
}

function PhoneScore({ team, tone }: { team: TeamView; tone: "red" | "blue" }) {
  const actual = team.actualSum ?? 0;
  const bust = actual > 21;
  return (
    <article className={`score ${tone}`}>
      <div className="spread">
        <h3 style={{ margin: 0 }}>{team.name}</h3>
        {bust && <span className="bust">爆咗</span>}
        {actual === 21 && <span className="stood">剛好 21</span>}
      </div>
      <p className="sum" data-testid="card-actual">
        {actual}
      </p>
      <p style={{ margin: "0 0 8px" }}>
        估計 {team.estimateSum} · 實際 {actual}
      </p>
      {team.cards.map((card) => (
        <div key={card.questionId} className="card" style={{ background: "rgba(23,32,51,0.06)" }}>
          <Stars value={card.stars} />
          <p>{card.question}</p>
          <p className="estimate">
            估 {card.estimate}
            {typeof card.actual === "number" ? ` · 實際 ${card.actual}` : ""}
          </p>
        </div>
      ))}
    </article>
  );
}

export function TeamPanel({
  team,
  tone,
  active,
  showActual,
}: {
  team: TeamView;
  tone: "red" | "blue";
  active?: boolean;
  showActual?: boolean;
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const actual = team.actualSum ?? 0;
  const bust = showActual && actual > 21;
  const captain = team.members.find((member) => member.id === team.captainId)?.nickname;

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [team.cards.length]);

  return (
    <article className={`score-panel ${tone}${active ? " active" : ""}`}>
      <header className="score-panel-head">
        <div className="score-panel-name">
          <h2>{team.name}</h2>
          <p className="captain-line">{captain ? `隊長 ${captain}` : "未定隊長"}</p>
        </div>
        <div className="score-now">
          {active && <span className="turn-badge">輪到</span>}
          {team.stood && <span className="stood">停牌</span>}
          {bust && <span className="bust">爆咗</span>}
          {showActual && actual === 21 && <span className="stood">剛好 21</span>}
          <p className="estimate-total" data-testid={showActual ? "card-actual" : undefined}>
            {showActual ? actual : team.estimateSum}
          </p>
          <p className="estimate-caption">{showActual ? `實際 · 估計 ${team.estimateSum}` : "估計"}</p>
        </div>
      </header>
      <ul className="history" ref={listRef}>
        {team.cards.length === 0 && <li className="history-empty">未答過題</li>}
        {team.cards.map((card) => (
          <li key={card.questionId} className="history-row" data-testid="public-card" title={card.question}>
            <Stars value={card.stars} />
            <span className="history-q">{card.question}</span>
            <span className="history-est">
              估 {card.estimate}
              {showActual && typeof card.actual === "number" ? ` · 實際 ${card.actual}` : ""}
            </span>
          </li>
        ))}
      </ul>
    </article>
  );
}
