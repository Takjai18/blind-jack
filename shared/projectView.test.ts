import { describe, expect, it } from "vitest";
import { projectView } from "./projectView";
import { beginHand, createRoom, keepDealOrder, submitEstimate } from "./rules";
import type { Question } from "./types";

function hasKey(value: unknown, key: string): boolean {
  if (Array.isArray(value)) return value.some((item) => hasKey(item, key));
  if (value && typeof value === "object") {
    return Object.entries(value).some(([name, inner]) => name === key || hasKey(inner, key));
  }
  return false;
}

function sample() {
  const questions: Question[] = [
    { id: "a", question: "甲", answer: 4, stars: 1 },
    { id: "b", question: "乙", answer: 9, stars: 1 },
    { id: "c", question: "丙", answer: 2, stars: 1 },
  ];
  let state = beginHand(createRoom("HKID"), questions, keepDealOrder);
  state = submitEstimate(state, "red", 1, 1000, () => 0).state;
  const afterBlue = submitEstimate(state, "blue", 3, 2000, () => 0);
  return { afterRed: state, afterBlue: afterBlue.state };
}

describe("projectView", () => {
  it("hides every actual from the projector during play", () => {
    const { afterBlue } = sample();
    const view = projectView(afterBlue, "display");
    expect(hasKey(view, "actual")).toBe(false);
    expect(hasKey(view, "actualSum")).toBe(false);
    expect(view.lastSecret).toBeNull();
    expect(view.current && "answer" in view.current).toBe(false);
    expect(view).not.toHaveProperty("deck");
    expect(view.announcement?.text).toBe("真實答案已送到對手手機");
    expect(view.red.cards[0]).toEqual({ questionId: "a", question: "甲", stars: 1, estimate: 1 });
    expect(view.blue.cards[0]).toEqual({ questionId: "b", question: "乙", stars: 1, estimate: 3 });
    expect(view.current?.stars).toBe(1);
    expect(JSON.stringify(view)).not.toContain('"answer"');
  });

  it("gives red the blue actuals and withholds red actuals", () => {
    const { afterBlue } = sample();
    const view = projectView(afterBlue, "red");
    expect(view.red.cards[0]).not.toHaveProperty("actual");
    expect(view.red).not.toHaveProperty("actualSum");
    expect(view.blue.cards[0]?.actual).toBe(9);
    expect(view.blue.actualSum).toBe(9);
    expect(view.lastSecret).toEqual({ actual: 9, question: "乙", at: 2000 });
    expect(JSON.stringify(view.red)).not.toContain("4");
  });

  it("gives blue the red actuals and withholds blue actuals", () => {
    const { afterRed } = sample();
    const view = projectView(afterRed, "blue");
    expect(view.red.cards[0]?.actual).toBe(4);
    expect(view.red.actualSum).toBe(4);
    expect(view.blue.cards).toHaveLength(0);
    expect(view.blue).not.toHaveProperty("actualSum");
    expect(view.lastSecret).toEqual({ actual: 4, question: "甲", at: 1000 });
  });

  it("hides opponent actuals in blind mode until the reveal", () => {
    const { afterBlue } = sample();
    const hidden = { ...afterBlue, intel: "hidden" as const };
    const red = projectView(hidden, "red");
    const blue = projectView(hidden, "blue");
    expect(red.blue.cards[0]).not.toHaveProperty("actual");
    expect(red.blue).not.toHaveProperty("actualSum");
    expect(red.lastSecret).toBeNull();
    expect(blue.red.cards[0]).not.toHaveProperty("actual");
    expect(blue.lastSecret).toBeNull();
    const revealed = projectView({ ...hidden, phase: "reveal" }, "red");
    expect(revealed.red.cards[0]?.actual).toBe(4);
    expect(revealed.blue.cards[0]?.actual).toBe(9);
  });

  it("opens both teams' actuals at reveal, including on the projector", () => {
    const { afterBlue } = sample();
    const revealed = { ...afterBlue, phase: "reveal" as const, winner: "blue" as const };
    for (const role of ["display", "red", "blue"] as const) {
      const view = projectView(revealed, role);
      expect(view.red.cards[0]?.actual).toBe(4);
      expect(view.blue.cards[0]?.actual).toBe(9);
      expect(view.red.actualSum).toBe(4);
      expect(view.blue.actualSum).toBe(9);
    }
  });
});
