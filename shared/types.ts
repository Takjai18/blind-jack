import type { Stars } from "./stars";

export type { Stars } from "./stars";
export type TeamId = "red" | "blue";
export type Role = "display" | TeamId;
export type Phase = "lobby" | "playing" | "reveal" | "finished";
export type Winner = "red" | "blue" | "tie" | "both_bust" | null;
export type Awaiting = "estimate" | "decision" | null;
export type IntelMode = "open" | "hidden";

export interface Question {
  id: string;
  question: string;
  answer: number;
  stars: Stars;
  category?: string;
}

export interface ClaimedCard {
  questionId: string;
  question: string;
  stars: Stars;
  estimate: number;
  actual: number;
}

export interface Member {
  id: string;
  nickname: string;
}

export interface TeamState {
  id: TeamId;
  name: string;
  members: Member[];
  estimateSum: number;
  actualSum: number;
  stood: boolean;
  cards: ClaimedCard[];
}

export interface Announcement {
  text: string;
  at: number;
}

export interface Secret {
  to: TeamId;
  actual: number;
  question: string;
  at: number;
}

export interface RoomState {
  code: string;
  phase: Phase;
  hostId?: string;
  deck: Question[];
  current: Question | null;
  drawnCount: number;
  lastStar: Stars | null;
  notice: string | null;
  turn: TeamId;
  red: TeamState;
  blue: TeamState;
  lastSecret: Secret | null;
  announcement: Announcement | null;
  winner: Winner;
  log: string[];
  awaiting: Awaiting;
  intel: IntelMode;
  revision: number;
}

export interface PublicCard {
  questionId: string;
  question: string;
  stars: Stars;
  estimate: number;
  actual?: number;
}

export interface TeamView {
  id: TeamId;
  name: string;
  members: Member[];
  estimateSum: number;
  stood: boolean;
  cards: PublicCard[];
  actualSum?: number;
}

export interface CurrentView {
  id: string;
  question: string;
  stars: Stars;
  category?: string;
}

export interface ClientView {
  code: string;
  phase: Phase;
  role: Role;
  turn: TeamId;
  awaiting: Awaiting;
  current: CurrentView | null;
  deckRemaining: number;
  red: TeamView;
  blue: TeamView;
  announcement: Announcement | null;
  notice: string | null;
  intel: IntelMode;
  lastSecret: { actual: number; question: string; at: number } | null;
  winner: Winner;
  log: string[];
  revision: number;
}

export type ClientMessage =
  | { type: "join"; payload: { clientId: string; nickname: string; role: Role } }
  | { type: "setRole"; payload: { role: Role } }
  | { type: "setIntel"; payload: { intel: IntelMode } }
  | { type: "start" }
  | { type: "restart" }
  | { type: "reveal" }
  | { type: "submitEstimate"; payload: { estimate: number } }
  | { type: "hit" }
  | { type: "stand" }
  | { type: "ping" };

export type ServerMessage =
  | { type: "state"; payload: ClientView }
  | { type: "SECRET_REVEAL"; payload: { actual: number; question: string } }
  | { type: "error"; payload: { message: string } }
  | { type: "pong" };
