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
      <h2 data-testid="winner">{headline(view)}</h2>
      <p className="hint">最接近 21、又未爆嘅一隊贏。</p>
      <div className="score-grid">
        <Score team={view.red} tone="red" />
        <Score team={view.blue} tone="blue" />
      </div>
      {onRestart && (
        <button type="button" className="btn gold" data-testid="restart" onClick={onRestart}>
          再開一局
        </button>
      )}
    </section>
  );
}

function headline(view: ClientView): string {
  return winnerLine(view.winner) || "揭曉";
}

function Score({ team, tone }: { team: TeamView; tone: "red" | "blue" }) {
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
