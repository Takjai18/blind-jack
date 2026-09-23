import { DurableObject } from "cloudflare:workers";
import { bundledQuestions } from "../shared/questions";
import type { Question } from "../shared/types";
import { validateQuestionInput } from "../shared/validate";
import type { Env } from "./env";

export type BankResult = { ok: true; questions: Question[] } | { ok: false; error: string };

export class QuestionBank extends DurableObject<Env> {
  private questions: Question[] | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.questions = (await ctx.storage.get<Question[]>("questions")) ?? null;
    });
  }

  async list(): Promise<Question[]> {
    await this.ensure();
    return structuredClone(this.questions ?? []);
  }

  async add(input: unknown): Promise<BankResult> {
    try {
      const fields = validateQuestionInput(input);
      const current = await this.ensure();
      this.questions = [...current, { id: newId(), ...fields }];
      await this.save();
      return { ok: true, questions: structuredClone(this.questions) };
    } catch (err) {
      return { ok: false, error: messageOf(err) };
    }
  }

  async update(id: string, input: unknown): Promise<BankResult> {
    try {
      const fields = validateQuestionInput(input);
      const current = await this.ensure();
      const index = current.findIndex((row) => row.id === id);
      if (index < 0) return { ok: false, error: "搵唔到呢題" };
      const next = current.slice();
      next[index] = { id, ...fields };
      this.questions = next;
      await this.save();
      return { ok: true, questions: structuredClone(this.questions) };
    } catch (err) {
      return { ok: false, error: messageOf(err) };
    }
  }

  async remove(id: string): Promise<BankResult> {
    const current = await this.ensure();
    const next = current.filter((row) => row.id !== id);
    if (next.length === current.length) return { ok: false, error: "搵唔到呢題" };
    this.questions = next;
    await this.save();
    return { ok: true, questions: structuredClone(this.questions) };
  }

  async replace(raw: unknown): Promise<BankResult> {
    if (!Array.isArray(raw)) return { ok: false, error: "JSON 要係一個陣列" };
    if (raw.length > 200) return { ok: false, error: "一次最多 200 題" };
    try {
      const seen = new Set<string>();
      const questions: Question[] = raw.map((row, index) => {
        const fields = validateQuestionInput(row, index);
        let id = "";
        if (row && typeof row === "object" && typeof (row as { id?: unknown }).id === "string") {
          id = (row as { id: string }).id.trim().slice(0, 40);
        }
        if (!id || seen.has(id)) id = newId();
        seen.add(id);
        return { id, ...fields };
      });
      this.questions = questions;
      await this.save();
      return { ok: true, questions: structuredClone(this.questions) };
    } catch (err) {
      return { ok: false, error: messageOf(err) };
    }
  }

  private async ensure(): Promise<Question[]> {
    if (!this.questions) {
      this.questions = bundledQuestions();
      await this.save();
    }
    return this.questions;
  }

  private async save() {
    await this.ctx.storage.put("questions", this.questions ?? []);
  }
}

function newId(): string {
  return `q_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : "儲存失敗";
}
