import raw from "../data/questions.json";
import { starsOf } from "./stars";
import type { Question } from "./types";

export function bundledQuestions(): Question[] {
  return (raw as Question[]).map((q) => ({
    id: q.id,
    question: q.question,
    answer: q.answer,
    stars: starsOf(q.stars),
    ...(q.category ? { category: q.category } : {}),
  }));
}
