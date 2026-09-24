import { STAR_WEIGHTS, WARMUP_DRAWS, starsOf, type Stars } from "./stars";
import type { Awaiting, Question, RoomState, TeamId, TeamState, Winner } from "./types";

export interface StepResult {
  state: RoomState;
  secret: { to: TeamId; actual: number; question: string } | null;
  error?: string;
}

const pickFirst = () => 0;

export function otherTeam(team: TeamId): TeamId {
  return team === "red" ? "blue" : "red";
}

export function createRoom(code: string): RoomState {
  return {
    code,
    phase: "lobby",
    deck: [],
    current: null,
    drawnCount: 0,
    lastStar: null,
    notice: null,
    turn: "red",
    red: emptyTeam("red", "紅隊"),
    blue: emptyTeam("blue", "藍隊"),
    lastSecret: null,
    announcement: null,
    winner: null,
    log: [],
    awaiting: null,
    revision: 0,
  };
}

export function judge(redSum: number, blueSum: number): Exclude<Winner, null> {
  const redBust = redSum > 21;
  const blueBust = blueSum > 21;
  if (redBust && blueBust) return "both_bust";
  if (redBust) return "blue";
  if (blueBust) return "red";
  if (redSum === blueSum) return "tie";
  return redSum > blueSum ? "red" : "blue";
}

export function winnerLine(winner: Winner): string {
  switch (winner) {
    case "both_bust":
      return "兩隊都爆咗，今局當平手，一齊食糖";
    case "red":
      return "紅隊贏";
    case "blue":
      return "藍隊贏";
    case "tie":
      return "平手";
    default:
      return "";
  }
}

export function beginHand(
  state: RoomState,
  questions: Question[],
  rng: () => number = Math.random,
): RoomState {
  const usable = questions.filter(isPlayable).map(copyQuestion);
  if (usable.length === 0) throw new Error("題庫係空嘅");
  const deck = usable.length > 20 ? shuffle(usable, rng).slice(0, 20) : usable;
  const next = structuredClone(state);
  next.phase = "playing";
  next.deck = deck;
  next.drawnCount = 0;
  next.lastStar = null;
  next.notice = null;
  next.current = null;
  next.turn = "red";
  next.winner = null;
  next.lastSecret = null;
  next.announcement = null;
  next.awaiting = "estimate";
  next.log = ["開波喇，紅隊先估"];
  const current = drawNext(next, rng);
  if (!current) throw new Error("題庫係空嘅");
  next.current = current;
  next.revision += 1;
  for (const id of ["red", "blue"] as const) {
    next[id].cards = [];
    next[id].estimateSum = 0;
    next[id].actualSum = 0;
    next[id].stood = false;
  }
  return next;
}

export function submitEstimate(
  state: RoomState,
  team: TeamId,
  estimate: number,
  now = Date.now(),
  rng: () => number = Math.random,
): StepResult {
  if (state.phase !== "playing") return fail(state, "而家未開波");
  if (state.turn !== team) return fail(state, "未輪到你哋");
  if (state.awaiting !== "estimate") return fail(state, "而家未到輸入估計");
  if (!state.current) return fail(state, "未有題目");
  if (!Number.isInteger(estimate) || estimate < 0 || estimate > 10) {
    return fail(state, "估計要係 0 到 10 嘅整數");
  }

  const next = structuredClone(state);
  const card = next.current;
  if (!card) return fail(state, "未有題目");
  const actor = next[team];
  actor.cards.push({
    questionId: card.id,
    question: card.question,
    stars: card.stars,
    estimate,
    actual: card.answer,
  });
  recount(actor);

  const opponent = otherTeam(team);
  next.lastSecret = { to: opponent, actual: card.answer, question: card.question, at: now };
  next.announcement = { text: "真實答案已送到對手手機", at: now };
  pushLog(next, `${actor.name}估咗 ${estimate} 分`);
  pushLog(next, "真實答案已送到對手手機");

  if (!next[opponent].stood) next.turn = opponent;
  const drawn = drawNext(next, rng);
  if (!drawn) {
    return {
      state: finish(next),
      secret: { to: opponent, actual: card.answer, question: card.question },
    };
  }
  next.current = drawn;
  next.awaiting = awaitingFor(next);
  next.revision += 1;
  return {
    state: next,
    secret: { to: opponent, actual: card.answer, question: card.question },
  };
}

export function hit(state: RoomState, team: TeamId): StepResult {
  if (state.phase !== "playing") return fail(state, "而家未開波");
  if (state.turn !== team) return fail(state, "未輪到你哋");
  if (state[team].cards.length < 2) return fail(state, "前兩張一定要估");
  if (state.awaiting !== "decision") return fail(state, "而家唔使再撳要牌");
  const next = structuredClone(state);
  next.awaiting = "estimate";
  pushLog(next, `${next[team].name}要牌`);
  next.revision += 1;
  return { state: next, secret: null };
}

export function stand(state: RoomState, team: TeamId): StepResult {
  if (state.phase !== "playing") return fail(state, "而家未開波");
  if (state.turn !== team) return fail(state, "未輪到你哋");
  if (state[team].cards.length < 2) return fail(state, "前兩張一定要估，未可以停牌");
  if (state.awaiting !== "decision") return fail(state, "而家未可以停牌");

  const next = structuredClone(state);
  next[team].stood = true;
  pushLog(next, `${next[team].name}停牌`);
  const opponent = otherTeam(team);
  // Refusing the card that is already showing. The same card goes to the other team.
  if (next[opponent].stood || !next.current) {
    return { state: finish(next), secret: null };
  }
  next.turn = opponent;
  next.awaiting = awaitingFor(next);
  next.revision += 1;
  return { state: next, secret: null };
}

export function forceReveal(state: RoomState): StepResult {
  if (state.phase === "reveal" || state.phase === "finished") {
    return { state, secret: null };
  }
  if (state.phase === "lobby") return fail(state, "未開波");
  return { state: finish(structuredClone(state)), secret: null };
}

function finish(state: RoomState): RoomState {
  state.phase = "reveal";
  state.current = null;
  state.awaiting = null;
  state.winner = judge(state.red.actualSum, state.blue.actualSum);
  pushLog(state, winnerLine(state.winner));
  state.revision += 1;
  return state;
}

function awaitingFor(state: RoomState): Awaiting {
  return state[state.turn].cards.length < 2 ? "estimate" : "decision";
}

function recount(team: TeamState) {
  team.estimateSum = team.cards.reduce((sum, card) => sum + card.estimate, 0);
  team.actualSum = team.cards.reduce((sum, card) => sum + card.actual, 0);
}

function pushLog(state: RoomState, line: string) {
  state.log = [...state.log, line].slice(-40);
}

function fail(state: RoomState, error: string): StepResult {
  return { state, secret: null, error };
}

function emptyTeam(id: TeamId, name: string): TeamState {
  return { id, name, members: [], estimateSum: 0, actualSum: 0, stood: false, cards: [] };
}

function drawNext(state: RoomState, rng: () => number): Question | null {
  if (state.deck.length === 0) return null;
  if (typeof state.drawnCount !== "number") return state.deck.shift() ?? null;
  const opening = state.drawnCount < WARMUP_DRAWS;
  const available = new Set(state.deck.map((card) => card.stars));
  const star = chooseStar(opening, state.lastStar, available, rng);
  const chosen = takeStar(state.deck, star, rng) ?? takeAny(state.deck, rng);
  if (!chosen) return null;
  if (opening && chosen.stars !== 1 && !state.notice) {
    state.notice = chosen.stars === 2 ? "1星題唔夠，熱身改用2星" : "1星題唔夠，熱身改用3星";
  }
  state.lastStar = chosen.stars;
  state.drawnCount += 1;
  return chosen;
}

function chooseStar(opening: boolean, last: Stars | null, available: Set<Stars>, rng: () => number): Stars {
  if (opening) {
    if (available.has(1)) return 1;
    if (available.has(2)) return 2;
    return 3;
  }
  const weights: Record<Stars, number> = { ...STAR_WEIGHTS };
  if (last === 1) weights[1] = 0;
  if (last === 3) weights[3] = 0;
  const options = ([1, 2, 3] as const).filter((star) => available.has(star) && weights[star] > 0);
  if (options.length === 0) return [...available][0] ?? 1;
  const total = options.reduce((sum, star) => sum + weights[star], 0);
  let roll = rng() * total;
  for (const star of options) {
    roll -= weights[star];
    if (roll <= 0) return star;
  }
  return options[options.length - 1] ?? 1;
}

function takeStar(pool: Question[], star: Stars, rng: () => number): Question | null {
  const matches = pool.filter((card) => card.stars === star);
  if (matches.length === 0) return null;
  const index = Math.min(matches.length - 1, Math.floor(rng() * matches.length));
  const chosen = matches[index];
  if (!chosen) return null;
  const at = pool.findIndex((card) => card.id === chosen.id);
  if (at >= 0) pool.splice(at, 1);
  return chosen;
}

function takeAny(pool: Question[], rng: () => number): Question | null {
  if (pool.length === 0) return null;
  const index = Math.min(pool.length - 1, Math.floor(rng() * pool.length));
  return pool.splice(index, 1)[0] ?? null;
}

function isPlayable(q: Question): boolean {
  return (
    typeof q.id === "string" &&
    q.id.length > 0 &&
    typeof q.question === "string" &&
    q.question.trim().length > 0 &&
    Number.isInteger(q.answer) &&
    q.answer >= 0 &&
    q.answer <= 10
  );
}

function copyQuestion(q: Question): Question {
  return {
    id: q.id,
    question: q.question.trim(),
    answer: q.answer,
    stars: starsOf(q.stars),
    ...(q.category ? { category: q.category } : {}),
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const swap = arr[i];
    arr[i] = arr[j] as T;
    arr[j] = swap as T;
  }
  return arr;
}

export const keepDealOrder = pickFirst;
