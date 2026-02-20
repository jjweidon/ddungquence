"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ensureAnonAuth } from "@/features/auth/ensureAnonAuth";
import {
  getRoomIdByCode,
  joinRoomByCode,
  subscribeToPlayers,
  subscribeToRoom,
  updatePlayerReady,
  updatePlayerTeam,
  getRoom,
  leaveRoom,
  switchToSpectator,
} from "@/features/room/roomApi";
import { sortParticipantsRedBlue } from "@/shared/lib/players";
import { startGame } from "@/features/game/gameApi";
import type { RoomPlayerDoc, TeamId } from "@/features/room/types";
import { getDoc, getDocs, collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/client";

const MAX_PARTICIPANTS = 4;

// ─── 팀 칩 (09 문서: 팀 색상은 칩/배지에만) ─────────────────────
function TeamChip({ teamId }: { teamId?: TeamId | null }) {
  const style =
    teamId === "A"
      ? "bg-dq-redDark border-dq-redDark"
      : teamId === "B"
        ? "bg-dq-blueDark border-dq-blueDark"
        : "bg-white/10 border-white/20";
  return (
    <span
      className={`inline-flex size-8 shrink-0 rounded-full border-2 ${style}`}
      aria-hidden
    />
  );
}

// ─── 클립보드 / 체크 아이콘 (복사 버튼용) ─────────────────────
function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <rect width={8} height={4} x={8} y={2} rx={1} ry={1} />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// ─── RoomHeader: 방 코드 + 복사 + 연결 상태 ─────────────────────
function RoomHeader({
  code,
  onCopy,
}: {
  code: string;
  onCopy: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopy = useCallback(() => {
    onCopy();
    if (timerRef.current) clearTimeout(timerRef.current);
    setCopied(true);
    timerRef.current = setTimeout(() => {
      setCopied(false);
      timerRef.current = null;
    }, 2000);
  }, [onCopy]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (
    <section className="bg-dq-charcoal border border-white/10 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-3">
        <span
          className="font-mono text-xl tracking-[0.2em] text-dq-white"
          aria-label="방 코드"
        >
          {code.toUpperCase()}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? "복사됨" : "방 코드 복사"}
            className="p-2 rounded-xl bg-dq-black border border-white/10 text-dq-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dq-redLight transition-colors"
          >
            <span className="size-5 block">
              {copied ? (
                <CheckIcon className="size-5 text-dq-green" />
              ) : (
                <ClipboardIcon className="size-5" />
              )}
            </span>
          </button>
          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-dq-green/20 text-dq-green border border-dq-green/30">
            연결됨
          </span>
        </div>
      </div>
    </section>
  );
}

// ─── PlayerSection: 참여자 리스트 (칩 + 닉네임 + HOST/ME + READY) ─
function PlayerSection({
  players,
  hostUid,
  myUid,
}: {
  players: RoomPlayerDoc[];
  hostUid: string | null;
  myUid: string | null;
}) {
  const participants = sortParticipantsRedBlue(players);
  return (
    <section className="bg-dq-charcoal border border-white/10 rounded-2xl p-4">
      <h2 className="text-xs font-bold tracking-widest text-dq-white/70 uppercase mb-3">
        참여자
      </h2>
      <ul className="space-y-2">
        {participants.map((p) => (
          <li
            key={p.uid}
            className="flex items-center gap-3 py-2 px-3 rounded-xl bg-dq-black/50 border border-white/5"
          >
            <TeamChip teamId={p.teamId} />
            <span className="flex-1 font-medium text-dq-white truncate">
              {p.nickname}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {p.uid === hostUid && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-dq-red/20 text-dq-redLight border border-dq-red/30">
                  HOST
                </span>
              )}
              {p.uid === myUid && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/15 text-dq-white border border-white/20">
                  ME
                </span>
              )}
              {p.ready ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-dq-green/20 text-dq-green border border-dq-green/30 flex items-center gap-0.5">
                  <span aria-hidden>✓</span> READY
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] text-dq-white/50">
                  대기
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── SpectatorSection: 관전자 리스트 (별도 카드, 09 문서) ─────────
function SpectatorSection({
  players,
  myUid,
}: {
  players: RoomPlayerDoc[];
  myUid: string | null;
}) {
  const spectators = players.filter((p) => p.role === "spectator");
  if (spectators.length === 0) return null;

  return (
    <section className="bg-dq-charcoal border border-white/10 rounded-2xl p-4">
      <h2 className="text-xs font-bold tracking-widest text-dq-white/70 uppercase mb-3">
        관전자
      </h2>
      <ul className="space-y-2">
        {spectators.map((p) => (
          <li
            key={p.uid}
            className="flex items-center gap-3 py-2 px-3 rounded-xl bg-dq-black/50 border border-white/5"
          >
            <span className="inline-flex size-8 shrink-0 rounded-full bg-white/10 border border-white/20" />
            <span className="flex-1 font-medium text-dq-white/80 truncate">
              {p.nickname}
            </span>
            {p.uid === myUid && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/15 text-dq-white border border-white/20 shrink-0">
                ME
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── ActionBar: 하단 고정 (팀 선택 + 준비 / 게임 시작 / 참여하기 / 관전하기) ──
function ActionBar({
  me,
  isHost,
  participants,
  canJoinAsParticipant,
  onReadyToggle,
  onTeamSelect,
  onStartGame,
  onSpectatorJoin,
  onSwitchToSpectator,
  readyPending,
  joinPending,
  spectatorPending,
  startPending,
}: {
  me: RoomPlayerDoc | undefined;
  isHost: boolean;
  participants: RoomPlayerDoc[];
  canJoinAsParticipant: boolean;
  onReadyToggle: () => void;
  onTeamSelect: (t: TeamId) => void;
  onStartGame: () => void;
  onSpectatorJoin: () => void;
  onSwitchToSpectator: () => void;
  readyPending: boolean;
  joinPending: boolean;
  spectatorPending: boolean;
  startPending: boolean;
}) {
  const redCount = participants.filter((p) => p.teamId === "A").length;
  const blueCount = participants.filter((p) => p.teamId === "B").length;
  const teamsBalanced = redCount > 0 && blueCount > 0 && redCount === blueCount;
  const allReady =
    participants.length >= 2 && teamsBalanced && participants.every((p) => p.ready);
  const isParticipant = me?.role === "participant";
  const isSpectator = me?.role === "spectator";
  const participantFull = participants.length >= MAX_PARTICIPANTS;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-20 p-4 bg-dq-charcoalDeep border-t border-white/10"
      style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom))" }}
    >
      <div className="max-w-lg mx-auto flex flex-col gap-4">
        {isParticipant && (
          <>
            <div className="flex gap-2 justify-center">
              {(["A", "B"] as const).map((teamId) => (
                <button
                  key={teamId}
                  type="button"
                  onClick={() => onTeamSelect(teamId)}
                  disabled={me?.ready}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border min-h-[44px] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dq-redLight disabled:opacity-40 disabled:cursor-not-allowed ${
                    me?.teamId === teamId
                      ? "bg-dq-black border-white/10 ring-2 ring-dq-redLight"
                      : "bg-dq-black border-white/10 hover:bg-white/5"
                  }`}
                >
                  <TeamChip teamId={teamId} />
                  <span className="text-sm font-medium text-dq-white">
                    {teamId === "A" ? "레드" : "블루"}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onReadyToggle}
                disabled={readyPending}
                className={`min-w-0 flex-[3] min-h-[48px] py-2.5 rounded-xl text-sm font-bold focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 transition-colors ${
                  me?.ready
                    ? "bg-white/10 text-dq-white border border-white/20 hover:bg-white/15 focus-visible:ring-white/40"
                    : "bg-[#39FF14] text-[#0B0B0F] hover:bg-[#57FF33] focus-visible:ring-[#39FF14]"
                }`}
              >
                {me?.ready ? "준비 취소" : "준비"}
              </button>
              <button
                type="button"
                onClick={onSwitchToSpectator}
                disabled={spectatorPending || me?.ready}
                className="min-w-0 flex-[1] min-h-[48px] py-2.5 rounded-xl text-sm font-medium bg-dq-black border border-white/10 text-dq-white/80 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dq-redLight disabled:opacity-50"
              >
                {spectatorPending ? "전환 중…" : "관전하기"}
              </button>
            </div>
            {isHost && (
              <button
                type="button"
                onClick={onStartGame}
                disabled={!allReady || startPending}
                className="w-full min-h-[48px] py-2.5 rounded-xl text-sm font-bold bg-dq-red text-dq-white hover:bg-dq-redLight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dq-redLight disabled:opacity-50"
              >
                {startPending ? "시작 중…" : "게임 시작"}
              </button>
            )}
          </>
        )}
        {isSpectator && (
          <>
            {participantFull && (
              <p className="text-dq-white/50 text-xs text-center">
                참여 인원(4명)이 가득 찼습니다. 자리가 날 때까지 관전만 가능합니다.
              </p>
            )}
            {canJoinAsParticipant && (
              <button
                type="button"
                onClick={onSpectatorJoin}
                disabled={joinPending}
                className="w-full min-h-[48px] py-2.5 rounded-xl text-sm font-bold bg-dq-black border border-white/10 text-dq-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dq-redLight disabled:opacity-50"
              >
                {joinPending ? "참여 중…" : "참여하기"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function LobbyPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params?.code as string) ?? "";

  const [uid, setUid] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [players, setPlayers] = useState<RoomPlayerDoc[]>([]);
  const [hostUid, setHostUid] = useState<string | null>(null);
  const [roomStatus, setRoomStatus] = useState<"lobby" | "playing" | "ended">("lobby");
  const [status, setStatus] = useState<"loading" | "need-join" | "ready">(
    "loading"
  );
  const [error, setError] = useState<string | null>(null);

  const [joinNickname, setJoinNickname] = useState("");
  const [joinPending, setJoinPending] = useState(false);
  const [readyPending, setReadyPending] = useState(false);
  const [spectatorPending, setSpectatorPending] = useState(false);
  const [startPending, setStartPending] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);
  const unsubRoomRef = useRef<(() => void) | null>(null);

  const isHost = uid !== null && hostUid !== null && uid === hostUid;
  const me = players.find((p) => p.uid === uid);
  const participants = players.filter((p) => p.role === "participant");
  const canJoinAsParticipant =
    me?.role === "spectator" && participants.length < MAX_PARTICIPANTS;

  const setupRoom = useCallback(
    async (rid: string) => {
      unsubRef.current?.();
      unsubRoomRef.current?.();

      const room = await getRoom(rid);
      if (!room) {
        setError("방을 찾을 수 없습니다.");
        return;
      }
      setHostUid(room.hostUid);
      setRoomStatus(room.status as "lobby" | "playing" | "ended");
      setStatus("ready");

      // 플레이어 목록 구독
      unsubRef.current = subscribeToPlayers(rid, setPlayers);

      // 방 상태 구독: status가 "playing"이 되면 game으로 이동, "ended"면 로비에 재게임 유도
      unsubRoomRef.current = subscribeToRoom(rid, (roomData) => {
        if (!roomData) return;
        setHostUid(roomData.hostUid);
        setRoomStatus(roomData.status);
        if (roomData.status === "playing") {
          router.push(`/game/${rid}`);
        }
      });
    },
    [router],
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
      unsubRoomRef.current?.();
    };
  }, [code, setupRoom]);

  const handleCopyCode = useCallback(() => {
    const normalized = code.trim().toUpperCase();
    navigator.clipboard.writeText(normalized).catch(() => {});
  }, [code]);

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

  const handleSpectatorJoin = async () => {
    if (!roomId || !uid || !canJoinAsParticipant || joinPending) return;
    setError(null);
    setJoinPending(true);
    try {
      const db = getFirestoreDb();
      const playersRef = collection(db, "rooms", roomId, "players");
      const snap = await getDocs(playersRef);
      const parts = snap.docs
        .map((d) => d.data() as RoomPlayerDoc)
        .filter((p) => p.role === "participant");
      if (parts.length >= MAX_PARTICIPANTS) {
        setError("자리가 가득 찼습니다.");
        setJoinPending(false);
        return;
      }

      // 현재 팀 카운트 기준으로 더 적은 팀에 배정 (동수면 레드 우선)
      const redCount = parts.filter((p) => p.teamId === "A").length;
      const blueCount = parts.filter((p) => p.teamId === "B").length;
      const teamId: TeamId = redCount <= blueCount ? "A" : "B";

      // 인터리빙 seat: 레드 = 짝수(0,2,...), 블루 = 홀수(1,3,...)
      const occupiedSeats = new Set(
        parts.map((p) => p.seat).filter((s) => s !== undefined)
      );
      let seat = 0;
      if (teamId === "A") {
        for (let s = 0; ; s += 2) {
          if (!occupiedSeats.has(s)) { seat = s; break; }
        }
      } else {
        for (let s = 1; ; s += 2) {
          if (!occupiedSeats.has(s)) { seat = s; break; }
        }
      }

      const playerRef = doc(db, "rooms", roomId, "players", uid);
      await setDoc(
        playerRef,
        {
          role: "participant",
          seat,
          teamId,
          ready: false,
          lastSeenAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setJoinPending(false);
    }
  };

  const handleReadyToggle = async () => {
    if (!roomId || !uid) return;
    const current = players.find((p) => p.uid === uid);
    const nextReady = !current?.ready;
    setReadyPending(true);
    try {
      await updatePlayerReady(roomId, nextReady);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReadyPending(false);
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

  const handleSwitchToSpectator = async () => {
    if (!roomId || !uid || spectatorPending) return;
    setError(null);
    setSpectatorPending(true);
    try {
      await switchToSpectator(roomId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSpectatorPending(false);
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

  const handleStartGame = async () => {
    if (!roomId || !isHost || startPending) return;
    setError(null);
    setStartPending(true);
    try {
      await startGame(roomId);
      // 모든 클라이언트는 subscribeToRoom의 "playing" 상태 감지로 자동 이동
    } catch (err) {
      setError((err as Error).message);
      setStartPending(false);
    }
  };

  // ─── need-join: 방 참가 폼 ───────────────────────────────────
  if (status === "need-join") {
    return (
      <main className="min-h-dvh bg-dq-charcoalDeep text-dq-white px-4 py-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-sm space-y-4">
          <h1 className="text-xl font-bold text-center">로비 참가</h1>
          <p className="text-dq-white/70 text-sm text-center font-mono tracking-widest">
            {code.toUpperCase()}
          </p>
          <form onSubmit={handleJoin} className="space-y-3">
            <input
              type="text"
              placeholder="닉네임"
              value={joinNickname}
              onChange={(e) => setJoinNickname(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-dq-black border border-white/10 text-dq-white placeholder:text-dq-white/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-dq-redLight"
              maxLength={20}
              required
            />
            <button
              type="submit"
              disabled={joinPending || !joinNickname.trim()}
              className="w-full min-h-[44px] py-2.5 rounded-xl font-bold bg-dq-red text-dq-white hover:bg-dq-redLight disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dq-redLight"
            >
              {joinPending ? "참가 중…" : "참가하기"}
            </button>
          </form>
          {error && (
            <p className="text-dq-redLight text-sm text-center">{error}</p>
          )}
        </div>
      </main>
    );
  }

  if (status === "loading") {
    return (
      <main className="min-h-dvh bg-dq-charcoalDeep text-dq-white flex items-center justify-center">
        <p className="text-dq-white/60">로딩 중…</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-dq-charcoalDeep text-dq-white pb-[calc(80px+env(safe-area-inset-bottom))]">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-dq-redDark/20 border border-dq-red/30 text-dq-redLight text-sm">
            {error}
          </div>
        )}

        <RoomHeader code={code} onCopy={handleCopyCode} />
        <PlayerSection
          players={players}
          hostUid={hostUid}
          myUid={uid}
        />
        <SpectatorSection players={players} myUid={uid} />

        <button
          type="button"
          onClick={handleLeaveRoom}
          disabled={leavePending}
          className="w-full min-h-[44px] py-2 rounded-xl border border-white/10 bg-dq-black text-dq-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-dq-redLight disabled:opacity-50"
        >
          {leavePending ? "나가는 중…" : "나가기"}
        </button>
      </div>

      {me && (
        <ActionBar
          me={me}
          isHost={isHost}
          participants={participants}
          canJoinAsParticipant={canJoinAsParticipant}
          onReadyToggle={handleReadyToggle}
          onTeamSelect={handleTeamSelect}
          onStartGame={handleStartGame}
          onSpectatorJoin={handleSpectatorJoin}
          onSwitchToSpectator={handleSwitchToSpectator}
          readyPending={readyPending}
          joinPending={joinPending}
          spectatorPending={spectatorPending}
          startPending={startPending}
        />
      )}
    </main>
  );
}
