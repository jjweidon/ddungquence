"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ensureAnonAuth } from "@/features/auth/ensureAnonAuth";
import {
  getRoomIdByCode,
  joinRoomByCode,
  subscribeToPlayers,
  updatePlayerReady,
  updatePlayerTeam,
  getRoom,
  leaveRoom,
} from "@/features/room/roomApi";
import type { RoomPlayerDoc, TeamId } from "@/features/room/types";
import { getDoc, doc } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/client";

export default function LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string) ?? "";

  const [uid, setUid] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [players, setPlayers] = useState<RoomPlayerDoc[]>([]);
  const [hostUid, setHostUid] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "need-join" | "ready">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  const [joinNickname, setJoinNickname] = useState("");
  const [joinPending, setJoinPending] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  const isHost = uid !== null && hostUid !== null && uid === hostUid;

  const setupRoom = useCallback(
    async (rid: string) => {
      unsubRef.current?.();
      const room = await getRoom(rid);
      if (!room) {
        setError("방을 찾을 수 없습니다.");
        return;
      }
      setHostUid(room.hostUid);
      setStatus("ready");
      unsubRef.current = subscribeToPlayers(rid, (newPlayers) => {
        setPlayers(newPlayers);
      });
    },
    []
  );

  useEffect(() => {
    if (!code || code.length < 4) {
      setError("잘못된 방 코드입니다.");
      setStatus("need-join");
      return;
    }

    const init = async () => {
      const currentUid = await ensureAnonAuth();
      setUid(currentUid);

      const rid = await getRoomIdByCode(code);
      if (!rid) {
        setError("존재하지 않는 방 코드입니다.");
        setStatus("need-join");
        return;
      }
      setRoomId(rid);

      const db = getFirestoreDb();
      const playerRef = doc(db, "rooms", rid, "players", currentUid);
      const playerSnap = await getDoc(playerRef);

      if (playerSnap.exists()) {
        await setupRoom(rid);
      } else {
        setStatus("need-join");
      }
    };

    init().catch((err) => {
      setError(err?.message ?? "오류가 발생했습니다.");
      setStatus("need-join");
    });

    return () => {
      unsubRef.current?.();
    };
  }, [code, setupRoom]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId || !joinNickname.trim() || joinPending) return;
    setError(null);
    setJoinPending(true);
    try {
      await joinRoomByCode(code, joinNickname.trim());
      await setupRoom(roomId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setJoinPending(false);
    }
  };

  const handleReadyToggle = async () => {
    if (!roomId || !uid) return;
    const me = players.find((p) => p.uid === uid);
    const nextReady = !me?.ready;
    try {
      await updatePlayerReady(roomId, nextReady);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleTeamSelect = async (teamId: TeamId) => {
    if (!roomId || !uid) return;
    try {
      await updatePlayerTeam(roomId, teamId);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const [leavePending, setLeavePending] = useState(false);
  const handleLeaveRoom = async () => {
    if (!roomId || !uid || leavePending) return;
    setError(null);
    setLeavePending(true);
    try {
      unsubRef.current?.();
      await leaveRoom(roomId);
      router.push("/");
      return;
    } catch (err) {
      setError((err as Error).message);
      setLeavePending(false);
    }
  };

  const handleStartGame = () => {
    router.push(`/game/${roomId}`);
  };

  if (status === "need-join") {
    return (
      <main className="min-h-screen p-8 flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold mb-4">로비 참가</h1>
        <p className="text-gray-600 mb-4">방 코드: {code}</p>
        <form onSubmit={handleJoin} className="w-full max-w-sm space-y-3">
          <input
            type="text"
            placeholder="닉네임"
            value={joinNickname}
            onChange={(e) => setJoinNickname(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
            maxLength={20}
            required
          />
          <button
            type="submit"
            disabled={joinPending || !joinNickname.trim()}
            className="w-full py-2 bg-green-600 text-white rounded-lg disabled:opacity-50"
          >
            {joinPending ? "참가 중..." : "참가하기"}
          </button>
        </form>
        {error && <p className="text-red-600 mt-2">{error}</p>}
      </main>
    );
  }

  if (status === "loading") {
    return (
      <main className="min-h-screen p-8 flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </main>
    );
  }

  const me = players.find((p) => p.uid === uid);

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold mb-2">로비</h1>
      <p className="text-gray-600 mb-6">방 코드: {code}</p>

      {error && (
        <p className="text-red-600 mb-4 p-3 bg-red-50 rounded">{error}</p>
      )}

      <section className="mb-8">
        <h2 className="font-semibold text-lg mb-3">참가자</h2>
        <ul className="space-y-2">
          {players
            .filter((p) => p.role === "participant")
            .map((p) => (
              <li
                key={p.uid}
                className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg"
              >
                <span className="font-medium">
                  {p.nickname}
                  {p.uid === hostUid && " (방장)"}
                  {p.uid === uid && " (나)"}
                </span>
                <span
                  className={`px-2 py-0.5 rounded text-sm ${
                    p.ready ? "bg-green-200 text-green-800" : "bg-gray-200"
                  }`}
                >
                  {p.ready ? "Ready" : "대기"}
                </span>
                <span className="text-sm text-gray-500">팀 {p.teamId ?? "-"}</span>
              </li>
            ))}
        </ul>
      </section>

      <section className="mb-6">
        <button
          onClick={handleLeaveRoom}
          disabled={leavePending}
          className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          {leavePending ? "나가는 중..." : "방 나가기"}
        </button>
      </section>

      {me && (
        <section className="mb-8 p-4 bg-blue-50 rounded-lg">
          <h2 className="font-semibold mb-3">내 설정</h2>
          <div className="flex flex-wrap gap-4 items-center">
            <button
              onClick={handleReadyToggle}
              className={`px-4 py-2 rounded-lg font-medium ${
                me.ready
                  ? "bg-green-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {me.ready ? "Ready" : "Ready 토글"}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => handleTeamSelect("A")}
                className={`px-4 py-2 rounded-lg ${
                  me.teamId === "A"
                    ? "bg-red-600 text-white"
                    : "bg-gray-200 hover:bg-red-100"
                }`}
              >
                팀 A (레드)
              </button>
              <button
                onClick={() => handleTeamSelect("B")}
                className={`px-4 py-2 rounded-lg ${
                  me.teamId === "B"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 hover:bg-blue-100"
                }`}
              >
                팀 B (블루)
              </button>
            </div>
          </div>
        </section>
      )}

      {isHost && (
        <section>
          <button
            onClick={handleStartGame}
            className="px-6 py-3 bg-amber-500 text-white font-semibold rounded-lg hover:bg-amber-600"
          >
            게임 시작
          </button>
        </section>
      )}
    </main>
  );
}
