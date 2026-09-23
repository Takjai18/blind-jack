import { useState } from "react";
import { ROOM_CODE, cleanNickname, normalizeCode } from "../../shared/code";
import { navigate } from "../App";
import type { Session } from "../session";

export function LobbyPage({
  session,
  setSession,
}: {
  session: Session;
  setSession: (session: Session) => void;
}) {
  const [nickname, setNickname] = useState(session.nickname);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function openRoom() {
    const name = cleanNickname(nickname);
    if (!nickname.trim()) {
      setError("請先寫你嘅暱稱");
      return;
    }
    setBusy(true);
    setError("");
    setSession({ ...session, nickname: name });
    try {
      const response = await fetch("/api/rooms", { method: "POST" });
      const data = (await response.json()) as { code?: string; error?: string };
      if (!response.ok || !data.code) {
        setError(data.error || "開房失敗");
        return;
      }
      navigate(`/r/${data.code}`);
    } catch {
      setError("開房失敗，睇下係咪開咗伺服器");
    } finally {
      setBusy(false);
    }
  }

  async function joinRoom() {
    const name = cleanNickname(nickname);
    const next = normalizeCode(code);
    if (!nickname.trim()) {
      setError("請先寫你嘅暱稱");
      return;
    }
    if (!ROOM_CODE.test(next)) {
      setError("房號唔啱。用 4 至 6 個字，冇 0、1、I、O。");
      return;
    }
    setBusy(true);
    setError("");
    setSession({ ...session, nickname: name });
    try {
      const response = await fetch(`/api/rooms/${next}`);
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error || "搵唔到呢間房");
        return;
      }
      navigate(`/r/${next}`);
    } catch {
      setError("入唔到房");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="lobby">
      <p className="kicker">教會 Ice Breaking</p>
      <h1>盲猜21點</h1>
      <p className="lede">兩隊面對面估分。真實答案只會出現喺對手手機。</p>
      <ol className="steps">
        <li>
          <strong>1</strong>
          電腦開投映，放出房號同二維碼
        </li>
        <li>
          <strong>2</strong>
          紅隊、藍隊用手機掃碼入房
        </li>
        <li>
          <strong>3</strong>
          估完，對手先睇到真實答案
        </li>
      </ol>
      <div className="lobby-grid">
        <section className="panel">
          <label className="field">
            你嘅暱稱
            <input
              value={nickname}
              maxLength={16}
              autoComplete="nickname"
              onChange={(event) => setNickname(event.target.value)}
            />
          </label>
        </section>
        <section className="panel">
          <p style={{ marginTop: 0, fontWeight: 800 }}>開新房</p>
          <button type="button" className="btn gold wide" disabled={busy} onClick={openRoom}>
            開新房
          </button>
        </section>
        <section className="panel">
          <label className="field">
            房號
            <input
              value={code}
              autoCapitalize="characters"
              autoCorrect="off"
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === "Enter") void joinRoom();
              }}
            />
          </label>
          <button type="button" className="btn wide" style={{ marginTop: 10 }} disabled={busy} onClick={joinRoom}>
            加入房間
          </button>
        </section>
        <section className="panel">
          <p style={{ marginTop: 0 }}>主持可以先改題目，再返嚟開房。</p>
          <button type="button" className="btn ghost" onClick={() => navigate("/admin")}>
            改題目
          </button>
        </section>
      </div>
      {error && <p className="toast">{error}</p>}
    </main>
  );
}
