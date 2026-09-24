import { useEffect, useState } from "react";
import type { Question, Stars } from "../../shared/types";
import { validateQuestionInput } from "../../shared/validate";
import { navigate } from "../App";

const PASSWORD_KEY = "blind-jack-admin";

export function AdminPage() {
  const [password, setPassword] = useState(() => sessionStorage.getItem(PASSWORD_KEY) ?? "");
  const [authed, setAuthed] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState({ question: "", answer: "", category: "", stars: 1 as Stars });

  useEffect(() => {
    if (sessionStorage.getItem(PASSWORD_KEY)) void load(sessionStorage.getItem(PASSWORD_KEY) ?? "");
  }, []);

  async function load(nextPassword = password) {
    setError("");
    const response = await fetch("/api/admin/questions", { headers: { "x-admin-password": nextPassword } });
    const data = (await response.json()) as Question[] | { error?: string };
    if (!response.ok || !Array.isArray(data)) {
      setAuthed(false);
      setError("error" in data ? data.error || "密碼唔啱" : "密碼唔啱");
      return;
    }
    sessionStorage.setItem(PASSWORD_KEY, nextPassword);
    setPassword(nextPassword);
    setAuthed(true);
    setQuestions(data);
  }

  async function send(path: string, method: string, body?: unknown) {
    const response = await fetch(path, {
      method,
      headers: { "content-type": "application/json", "x-admin-password": password },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await response.json()) as Question[] | { error?: string };
    if (!response.ok || !Array.isArray(data)) {
      setError("error" in data ? data.error || "儲存失敗" : "儲存失敗");
      return;
    }
    setError("");
    setQuestions(data);
  }

  async function addQuestion() {
    try {
      const fields = validateQuestionInput({
        question: draft.question,
        answer: Number(draft.answer),
        category: draft.category,
        stars: draft.stars,
      });
      await send("/api/admin/questions", "POST", fields);
      setDraft({ question: "", answer: "", category: "", stars: 1 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "請檢查題目");
    }
  }

  async function saveRow(row: Question, question: string, answer: string, category: string, stars: Stars) {
    try {
      const fields = validateQuestionInput({ question, answer: Number(answer), category, stars });
      await send(`/api/admin/questions/${encodeURIComponent(row.id)}`, "PUT", fields);
    } catch (err) {
      setError(err instanceof Error ? err.message : "請檢查題目");
    }
  }

  async function importFile(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const list = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && Array.isArray((parsed as { questions?: unknown }).questions)
          ? (parsed as { questions: unknown[] }).questions
          : null;
      if (!list) {
        setError("JSON 要係題目陣列");
        return;
      }
      if (!confirm(`用呢 ${list.length} 題取代而家題庫？`)) return;
      await send("/api/admin/questions", "PUT", list);
    } catch {
      setError("份 JSON 讀唔到");
    }
  }

  function exportFile() {
    const blob = new Blob([JSON.stringify(questions, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "blind-jack-questions.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!authed) {
    return (
      <main className="admin">
        <p className="kicker">題庫</p>
        <h1>入題庫</h1>
        <label className="field">
          密碼
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void load();
            }}
          />
        </label>
        <button type="button" className="btn gold" style={{ marginTop: 12 }} onClick={() => void load()}>
          入去
        </button>
        <button type="button" className="btn ghost" style={{ marginTop: 12 }} onClick={() => navigate("/")}>
          返去大堂
        </button>
        {error && <p className="toast">{error}</p>}
      </main>
    );
  }

  return (
    <main className="admin">
      <p className="kicker">題庫</p>
      <h1>而家有 {questions.length} 題</h1>
      <p>
        答案只可以係 0 到 10。星級：1星 {questions.filter((row) => (row.stars ?? 1) === 1).length} 題、2星{" "}
        {questions.filter((row) => row.stars === 2).length} 題、3星 {questions.filter((row) => row.stars === 3).length}{" "}
        題。開波頭四張會抽 1 星。清空晒之後，開波會用內置後備題。
      </p>
      <div className="row">
        <button type="button" className="btn gold" onClick={exportFile}>
          匯出 JSON
        </button>
        <label className="btn">
          匯入 JSON
          <input
            type="file"
            accept="application/json,.json"
            style={{ display: "none" }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importFile(file);
              event.target.value = "";
            }}
          />
        </label>
        <button type="button" className="btn ghost" onClick={() => navigate("/")}>
          返去大堂
        </button>
      </div>
      <section className="panel" style={{ marginTop: 16 }}>
        <h2>加一題</h2>
        <div className="q-item">
          <input
            placeholder="題目"
            value={draft.question}
            onChange={(event) => setDraft({ ...draft, question: event.target.value })}
          />
          <div className="row">
            <input
              placeholder="答案（0–10）"
              inputMode="numeric"
              value={draft.answer}
              onChange={(event) => setDraft({ ...draft, answer: event.target.value })}
            />
            <input
              placeholder="分類"
              value={draft.category}
              onChange={(event) => setDraft({ ...draft, category: event.target.value })}
            />
          </div>
          <StarPicker value={draft.stars} onChange={(stars) => setDraft({ ...draft, stars })} />
          <button type="button" className="btn gold" onClick={() => void addQuestion()}>
            加一題
          </button>
        </div>
      </section>
      <div className="q-list">
        {questions.map((row) => (
          <QuestionRow
            key={row.id}
            row={row}
            onSave={(question, answer, category, stars) => void saveRow(row, question, answer, category, stars)}
            onDelete={() => void send(`/api/admin/questions/${encodeURIComponent(row.id)}`, "DELETE")}
          />
        ))}
      </div>
      {error && (
        <button type="button" className="toast" onClick={() => setError("")}>
          {error}
        </button>
      )}
    </main>
  );
}

function StarPicker({ value, onChange }: { value: Stars; onChange: (stars: Stars) => void }) {
  return (
    <div className="row">
      {([1, 2, 3] as const).map((stars) => (
        <button
          key={stars}
          type="button"
          className={value === stars ? "btn gold" : "btn ghost"}
          onClick={() => onChange(stars)}
        >
          {"★".repeat(stars)} {stars}星
        </button>
      ))}
    </div>
  );
}

function QuestionRow({
  row,
  onSave,
  onDelete,
}: {
  row: Question;
  onSave: (question: string, answer: string, category: string, stars: Stars) => void;
  onDelete: () => void;
}) {
  const [question, setQuestion] = useState(row.question);
  const [answer, setAnswer] = useState(String(row.answer));
  const [category, setCategory] = useState(row.category ?? "");
  const [stars, setStars] = useState<Stars>(row.stars === 2 || row.stars === 3 ? row.stars : 1);
  return (
    <section className="panel q-item">
      <textarea rows={2} value={question} onChange={(event) => setQuestion(event.target.value)} />
      <div className="row">
        <input inputMode="numeric" value={answer} onChange={(event) => setAnswer(event.target.value)} />
        <input value={category} placeholder="分類" onChange={(event) => setCategory(event.target.value)} />
      </div>
      <StarPicker value={stars} onChange={setStars} />
      <div className="row">
        <button type="button" className="btn" onClick={() => onSave(question, answer, category, stars)}>
          儲存
        </button>
        <button type="button" className="btn ghost" onClick={onDelete}>
          刪
        </button>
      </div>
    </section>
  );
}
