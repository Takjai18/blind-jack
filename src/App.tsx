import { useEffect, useState } from "react";
import { normalizeCode, ROOM_CODE } from "../shared/code";
import { AdminPage } from "./pages/Admin";
import { LobbyPage } from "./pages/Lobby";
import { RoomPage } from "./pages/Room";
import { loadSession, saveSession, type Session } from "./session";

export function navigate(to: string) {
  history.pushState({}, "", to);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function usePath() {
  const [path, setPath] = useState(() => location.pathname);
  useEffect(() => {
    const sync = () => setPath(location.pathname);
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  return path;
}

export function App() {
  const path = usePath();
  const [session, setSession] = useState<Session>(() => loadSession());

  const update = (next: Session) => {
    saveSession(next);
    setSession(next);
  };

  if (path === "/admin") return <AdminPage />;

  const room = path.match(/^\/r\/([^/]+)\/?$/);
  if (room) {
    const code = normalizeCode(decodeURIComponent(room[1] ?? ""));
    if (!ROOM_CODE.test(code)) {
      return (
        <main className="picker">
          <p className="kicker">盲猜21點</p>
          <h1>房號唔啱</h1>
          <p>房號係 4 至 6 個字，冇 0、1、I、O。</p>
          <button className="btn gold" onClick={() => navigate("/")}>
            返去大堂
          </button>
        </main>
      );
    }
    return <RoomPage code={code} session={session} setSession={update} />;
  }

  return <LobbyPage session={session} setSession={update} />;
}
