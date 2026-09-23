import { describe, expect, it } from "vitest";
import type { Question, RoomState } from "./types";
import {
  beginHand,
  createRoom,
  forceReveal,
  hit,
  judge,
  keepDealOrder,
  stand,
  submitEstimate,
  winnerLine,
} from "./rules";

function q(id: string, answer: number): Question {
  return { id, question: id, answer };
}

function deal(answers: number[]): RoomState {
  return beginHand(
    createRoom("ABCD"),
    answers.map((answer, index) => q(String.fromCharCode(97 + index), answer)),
    keepDealOrder,
  );
}

describe("judge", () => {
  it("scores busts, ties, and the closer sum", () => {
    expect(judge(30, 30)).toBe("both_bust");
    expect(judge(22, 10)).toBe("blue");
    expect(judge(10, 22)).toBe("red");
    expect(judge(15, 15)).toBe("tie");
    expect(judge(0, 0)).toBe("tie");
    expect(judge(20, 19)).toBe("red");
    expect(judge(21, 20)).toBe("red");
    expect(judge(21, 22)).toBe("red");
  });

  it("uses the sugar line when both bust", () => {
    expect(winnerLine("both_bust")).toBe("兩隊都爆咗，今局當平手，一齊食糖");
  });
});

describe("hand sequence", () => {
  it("deals to red, alternates, and blocks standing before two cards", () => {
    let state = deal([4, 5, 6, 7, 8]);
    expect(state.phase).toBe("playing");
    expect(state.turn).toBe("red");
    expect(state.awaiting).toBe("estimate");
    expect(state.current?.question).toBe("a");
    expect(state.deck.map((card) => card.question)).toEqual(["b", "c", "d", "e"]);

    const tooEarly = stand(state, "red");
    expect(tooEarly.error).toMatch(/未可以停牌/);
    expect(tooEarly.state).toBe(state);

    const badNumber = submitEstimate(state, "red", 11, 1000);
    expect(badNumber.error).toMatch(/0 到 10/);
    expect(submitEstimate(state, "blue", 1, 1000).error).toMatch(/未輪到/);

    let step = submitEstimate(state, "red", 1, 1000);
    state = step.state;
    expect(step.secret).toEqual({ to: "blue", actual: 4, question: "a" });
    expect(state.red.estimateSum).toBe(1);
    expect(state.red.actualSum).toBe(4);
    expect(state.turn).toBe("blue");
    expect(state.current?.question).toBe("b");
    expect(state.awaiting).toBe("estimate");
    expect(state.log.join(" ")).not.toContain("4");

    expect(stand(state, "blue").error).toBeTruthy();
    step = submitEstimate(state, "blue", 2, 2000);
    state = step.state;
    expect(step.secret?.to).toBe("red");
    expect(state.current?.question).toBe("c");

    step = submitEstimate(state, "red", 3, 3000);
    state = step.state;
    expect(state.red.cards).toHaveLength(2);
    expect(state.turn).toBe("blue");
    expect(state.awaiting).toBe("estimate");

    step = submitEstimate(state, "blue", 4, 4000);
    state = step.state;
    expect(state.turn).toBe("red");
    expect(state.awaiting).toBe("decision");
    expect(state.current?.question).toBe("e");
    expect(state.deck).toHaveLength(0);
  });

  it("passes the refused card to the other team", () => {
    let state = deal([4, 5, 6, 7, 8]);
    state = submitEstimate(state, "red", 1, 1).state;
    state = submitEstimate(state, "blue", 1, 2).state;
    state = submitEstimate(state, "red", 1, 3).state;
    state = submitEstimate(state, "blue", 1, 4).state;
    expect(state.current?.id).toBe("e");

    const refused = stand(state, "red");
    state = refused.state;
    expect(state.red.stood).toBe(true);
    expect(state.turn).toBe("blue");
    expect(state.current?.id).toBe("e");
    expect(state.awaiting).toBe("decision");
    expect(state.red.cards.some((card) => card.questionId === "e")).toBe(false);

    state = stand(state, "blue").state;
    expect(state.phase).toBe("reveal");
    expect(state.current).toBeNull();
    expect(state.red.actualSum).toBe(10);
    expect(state.blue.actualSum).toBe(12);
    expect(state.winner).toBe("blue");
    expect(state.red.cards).toHaveLength(2);
    expect(state.blue.cards).toHaveLength(2);
  });

  it("lets the same team draw again after the other team has stood", () => {
    let state = deal([1, 1, 1, 1, 1, 1]);
    state = submitEstimate(state, "red", 0, 1).state;
    state = submitEstimate(state, "blue", 0, 2).state;
    state = submitEstimate(state, "red", 0, 3).state;
    state = submitEstimate(state, "blue", 0, 4).state;
    state = hit(state, "red").state;
    expect(state.awaiting).toBe("estimate");
    expect(state.current?.id).toBe("e");
    state = submitEstimate(state, "red", 0, 5).state;
    expect(state.turn).toBe("blue");
    expect(state.current?.id).toBe("f");
    state = stand(state, "blue").state;
    expect(state.turn).toBe("red");
    expect(state.current?.id).toBe("f");
    state = hit(state, "red").state;
    state = submitEstimate(state, "red", 0, 6).state;
    expect(state.phase).toBe("reveal");
    expect(state.red.actualSum).toBe(4);
    expect(state.blue.actualSum).toBe(2);
    expect(state.winner).toBe("red");
  });

  it("ends when the deck runs out", () => {
    let state = deal([9]);
    const step = submitEstimate(state, "red", 2, 1000);
    expect(step.state.phase).toBe("reveal");
    expect(step.state.red.actualSum).toBe(9);
    expect(step.state.winner).toBe("red");
    expect(step.secret?.actual).toBe(9);
  });

  it("calls both bust when each team goes over 21", () => {
    let state = deal([10, 10, 10, 10, 10, 10]);
    state = submitEstimate(state, "red", 10, 1).state;
    state = submitEstimate(state, "blue", 10, 2).state;
    state = submitEstimate(state, "red", 10, 3).state;
    state = submitEstimate(state, "blue", 10, 4).state;
    state = hit(state, "red").state;
    state = submitEstimate(state, "red", 10, 5).state;
    state = hit(state, "blue").state;
    state = submitEstimate(state, "blue", 10, 6).state;
    expect(state.phase).toBe("reveal");
    expect(state.red.actualSum).toBe(30);
    expect(state.blue.actualSum).toBe(30);
    expect(state.winner).toBe("both_bust");
    expect(state.log.at(-1)).toContain("一齊食糖");
  });

  it("keeps members when a new hand starts", () => {
    const room = createRoom("WXYZ");
    room.red.members.push({ id: "player-red", nickname: "阿明" });
    const started = beginHand(room, [q("a", 1), q("b", 2)], keepDealOrder);
    expect(started.red.members).toEqual([{ id: "player-red", nickname: "阿明" }]);
    const ended = forceReveal(started).state;
    expect(ended.phase).toBe("reveal");
    const again = beginHand(ended, [q("c", 3)], keepDealOrder);
    expect(again.phase).toBe("playing");
    expect(again.red.members[0]?.nickname).toBe("阿明");
    expect(again.red.cards).toHaveLength(0);
  });
});
