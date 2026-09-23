import { useState } from "react";
import { cleanNickname } from "../../shared/code";
import type { Role } from "../../shared/types";
import { navigate } from "../App";
import type { Session } from "../session";
import { useRoom } from "../useRoom";
import { DisplayBoard } from "../ui/DisplayBoard";
import { PhonePlay } from "../ui/PhonePlay";

export function RoomPage({
  code,
  session,
  setSession,
}: {
  code: string;
  session: Session;
  setSession: (session: Session) => void;
}) {
  const [nickname, setNickname] = useState(session.nickname);
  const role = session.roleByRoom[code];

  if (!session.nickname) {
    return (
      <main className="picker">
        <p className="kicker">房號 {code}</p>
        <h1>你嘅暱稱</h1>
        <label className="field">
          點稱呼你
          <input
            value={nickname}
            maxLength={16}
            autoFocus
            onChange={(event) => setNickname(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || !nickname.trim()) return;
              setSession({ ...session, nickname: cleanNickname(nickname) });
            }}
          />
        </label>
        <button
          type="button"
          className="btn gold"
          style={{ marginTop: 12 }}
          disabled={!nickname.trim()}
          onClick={() => setSession({ ...session, nickname: cleanNickname(nickname) })}
        >
          入場
        </button>
      </main>
    );
  }

  if (!role) {
    const choose = (next: Role) => {
      setSession({ ...session, roleByRoom: { ...session.roleByRoom, [code]: next } });
    };
    return (
      <main className="picker">
        <p className="kicker">房號 {code}</p>
        <h1>你係邊度？</h1>
        <p>{session.nickname}，揀一個位置。開咗波就唔可以轉隊。</p>
        <div className="picker-grid">
          <button type="button" className="btn gold role-btn" data-testid="role-display" onClick={() => choose("display")}>
            我開投映（大螢幕）
          </button>
          <button type="button" className="btn red role-btn" data-testid="role-red" onClick={() => choose("red")}>
            加入紅隊
          </button>
          <button type="button" className="btn blue role-btn" data-testid="role-blue" onClick={() => choose("blue")}>
            加入藍隊
          </button>
        </div>
        <button
          type="button"
          className="btn ghost"
          style={{ marginTop: 16 }}
          onClick={() => navigate("/")}
        >
          返去大堂
        </button>
      </main>
    );
  }

  return <LiveRoom code={code} role={role} session={session} setSession={setSession} />;
}

function LiveRoom({
  code,
  role,
  session,
  setSession,
}: {
  code: string;
  role: Role;
  session: Session;
  setSession: (session: Session) => void;
}) {
  const room = useRoom({ code, role, nickname: session.nickname, clientId: session.clientId });
  const leave = () => {
    const roleByRoom = { ...session.roleByRoom };
    delete roleByRoom[code];
    setSession({ ...session, roleByRoom });
  };

  return (
    <div className="shell">
      {!room.view && (
        <main className="picker">
          <h1>入緊房 {code}</h1>
          <p>{room.status === "closed" ? "斷咗線，重連緊…" : "連緊線…"}</p>
        </main>
      )}
      {room.view && role === "display" && (
        <DisplayBoard view={room.view} status={room.status} send={room.send} onLeave={room.view.phase === "lobby" ? leave : undefined} />
      )}
      {room.view && role !== "display" && (
        <PhonePlay
          team={role}
          view={room.view}
          secret={room.secret}
          status={room.status}
          send={room.send}
          onLeave={room.view.phase === "lobby" ? leave : undefined}
        />
      )}
      {room.error && (
        <button type="button" className="toast" onClick={() => room.setError(null)}>
          {room.error}
        </button>
      )}
    </div>
  );
}
