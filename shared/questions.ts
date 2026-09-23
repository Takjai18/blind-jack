import raw from "../data/questions.json";
import type { Question } from "./types";

export function bundledQuestions(): Question[] {
  return (raw as Question[]).map((q) => ({
    id: q.id,
    question: q.question,
    answer: q.answer,
    ...(q.category ? { category: q.category } : {}),
  }));
}
