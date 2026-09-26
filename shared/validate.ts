import { starsOf, type Stars } from "./stars";

export interface QuestionFields {
  question: string;
  answer: number;
  stars: Stars;
  category?: string;
}

export function validateQuestionInput(input: unknown, index?: number): QuestionFields {
  const where = index === undefined ? "" : `第 ${index + 1} 題：`;
  if (!input || typeof input !== "object") {
    throw new Error(`${where}格式唔啱`);
  }
  const row = input as { question?: unknown; answer?: unknown; category?: unknown; stars?: unknown };
  const question = typeof row.question === "string" ? row.question.trim() : "";
  if (!question) throw new Error(`${where}請寫題目`);
  if (question.length > 300) throw new Error(`${where}題目太長`);
  const answer = row.answer;
  if (typeof answer !== "number" || !Number.isInteger(answer) || answer < 1 || answer > 10) {
    throw new Error(`${where}答案要係 1 到 10 嘅整數`);
  }
  if (row.stars !== undefined && row.stars !== 1 && row.stars !== 2 && row.stars !== 3) {
    throw new Error(`${where}星級要係 1、2 或 3`);
  }
  const stars = starsOf(row.stars);
  if (typeof row.category === "string" && row.category.trim()) {
    return { question, answer, stars, category: row.category.trim().slice(0, 40) };
  }
  return { question, answer, stars };
}
