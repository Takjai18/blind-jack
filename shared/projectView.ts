import { starsOf } from "./stars";
import type { ClientView, PublicCard, Role, RoomState, TeamState, TeamView } from "./types";

const revealedPhase = (phase: RoomState["phase"]) => phase === "reveal" || phase === "finished";

/**
 * Build the only payload a socket may receive.
 * In 模式一 a team learns the other team's actuals immediately, and learns its own only at 揭曉.
 * In 模式二 nobody learns an actual until 揭曉. The projector never receives one before that.
 */
export function projectView(state: RoomState, role: Role): ClientView {
  const revealed = revealedPhase(state.phase);
  const intel = state.intel === "hidden" ? "hidden" : "open";
  const share = intel === "open";
  const redActual = revealed || (share && role === "blue");
  const blueActual = revealed || (share && role === "red");
  const secret =
    share && state.lastSecret && role === state.lastSecret.to
      ? {
          actual: state.lastSecret.actual,
          question: state.lastSecret.question,
          at: state.lastSecret.at,
        }
      : null;

  return {
    code: state.code,
    phase: state.phase,
    role,
    turn: state.turn,
    awaiting: state.awaiting,
    current: state.current
      ? {
          id: state.current.id,
          question: state.current.question,
          stars: starsOf(state.current.stars),
          ...(state.current.category ? { category: state.current.category } : {}),
        }
      : null,
    deckRemaining: state.deck.length,
    red: teamView(state.red, redActual),
    blue: teamView(state.blue, blueActual),
    announcement: state.announcement ? { text: state.announcement.text, at: state.announcement.at } : null,
    notice: state.notice ?? null,
    intel,
    lastSecret: secret,
    winner: state.winner,
    log: state.log.slice(),
    revision: state.revision,
  };
}

function teamView(team: TeamState, showActual: boolean): TeamView {
  const cards: PublicCard[] = team.cards.map((card) => {
    const pub: PublicCard = {
      questionId: card.questionId,
      question: card.question,
      stars: starsOf(card.stars),
      estimate: card.estimate,
    };
    if (showActual) pub.actual = card.actual;
    return pub;
  });
  const view: TeamView = {
    id: team.id,
    name: team.name,
    members: team.members.map((member) => ({ id: member.id, nickname: member.nickname })),
    estimateSum: team.estimateSum,
    stood: team.stood,
    cards,
  };
  if (showActual) view.actualSum = team.actualSum;
  return view;
}
