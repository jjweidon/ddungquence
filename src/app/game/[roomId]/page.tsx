"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ensureAnonAuth } from "@/features/auth/ensureAnonAuth";
import { subscribeToRoom } from "@/features/room/roomApi";
import { subscribeToHand } from "@/features/game/gameApi";
import { cardImageUrl, cardAltText } from "@/shared/lib/cardImage";
import { sortParticipantsRedBlue } from "@/shared/lib/players";
import { isDeadCard } from "@/domain/rules/deadCard";
import type { RoomDoc, RoomPlayerDoc, PublicGameState } from "@/features/room/types";
import type { PrivateHandDoc } from "@/features/game/types";
import { collection, getDocs } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/client";

// ─── 카드 타일 ──────────────────────────────────────────────────
/**
 * 손패 카드 타일 — public/cards/webp/{cardId}.webp 이미지 사용
 * 내 차례일 때만 클릭 가능, 선택 시 ring 강조
 */
function CardTile({
  cardId,
  selected,
  isMyTurn,
  isDead,
  onClick,
}: {
  cardId: string;
  selected: boolean;
  isMyTurn: boolean;
  isDead?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isMyTurn || isDead}
      className={[
        "relative shrink-0 rounded-lg overflow-hidden select-none",
        "border-2 transition-all duration-100",
        selected
          ? "border-dq-redLight ring-2 ring-dq-redLight scale-105"
          : "border-white/20 hover:border-white/50",
        isMyTurn && !isDead ? "cursor-pointer active:scale-95" : "cursor-default",
        isDead ? "opacity-35 grayscale" : "",
      ].join(" ")}
      aria-label={cardAltText(cardId)}
      aria-pressed={selected}
    >
      <Image
        src={cardImageUrl(cardId)}
        alt={cardAltText(cardId)}
        width={56}
        height={80}
        className="block"
        draggable={false}
      />
      {isDead && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="bg-dq-black/70 text-dq-white/70 text-[9px] font-bold px-1 py-0.5 rounded">
            DEAD
          </span>
        </span>
      )}
    </button>
  );
}

// ─── 팀 배지 ────────────────────────────────────────────────────
function TeamBadge({ teamId }: { teamId?: string | null }) {
  if (!teamId) return null;
  const cls =
    teamId === "A"
      ? "bg-dq-red/20 text-dq-redLight border border-dq-red/30"
      : "bg-blue-500/20 text-blue-300 border border-blue-500/30";
  return (
    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>
      {teamId === "A" ? "레드" : "블루"}
    </span>
  );
}

// ─── 플레이어 스트립 ────────────────────────────────────────────
function PlayerStrip({
  players,
  game,
  myUid,
}: {
  players: RoomPlayerDoc[];
  game: PublicGameState | undefined;
  myUid: string | null;
}) {
  const participants = sortParticipantsRedBlue(players);

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {participants.map((p) => {
        const isCurrentTurn = game?.currentUid === p.uid;
        const isMe = p.uid === myUid;
        return (
          <div
            key={p.uid}
            className={[
              "flex flex-col items-center gap-1 p-2 rounded-xl border min-w-[72px] shrink-0",
              isCurrentTurn
                ? "bg-dq-black border-dq-redLight ring-1 ring-dq-redLight"
                : "bg-dq-black border-white/10",
            ].join(" ")}
          >
            <div className="flex gap-1 flex-wrap justify-center">
              {isMe && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/15 text-dq-white border border-white/20">
                  ME
                </span>
              )}
              {isCurrentTurn && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-dq-red/20 text-dq-redLight border border-dq-red/30">
                  TURN
                </span>
              )}
            </div>
            <TeamBadge teamId={p.teamId} />
            <span className="text-xs text-dq-white/80 truncate max-w-[64px] text-center">
              {p.nickname}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── 게임 페이지 ─────────────────────────────────────────────────
export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = (params?.roomId as string) ?? "";

  const [uid, setUid] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomDoc | null>(null);
  const [players, setPlayers] = useState<RoomPlayerDoc[]>([]);
  const [hand, setHand] = useState<PrivateHandDoc | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const unsubRoomRef = useRef<(() => void) | null>(null);
  const unsubHandRef = useRef<(() => void) | null>(null);

  const loadPlayers = useCallback(async (rid: string) => {
    const db = getFirestoreDb();
    const snap = await getDocs(collection(db, "rooms", rid, "players"));
    const list = snap.docs.map((d) => d.data() as RoomPlayerDoc);
    list.sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));
    setPlayers(list);
  }, []);

  useEffect(() => {
    if (!roomId) return;

    const init = async () => {
      const currentUid = await ensureAnonAuth();
      setUid(currentUid);

      // 방 종료 시 로비(랜딩)로 이동
      unsubRoomRef.current = subscribeToRoom(roomId, (roomData) => {
        if (!roomData) {
          router.push("/");
          return;
        }
        setRoom(roomData);
        if (roomData.status === "lobby") {
          router.push(`/lobby/${roomData.roomCode}`);
        }
      });

      // 본인 손패 구독
      unsubHandRef.current = subscribeToHand(roomId, currentUid, setHand);

      // 플레이어 목록 (1회 로드, M4에서 구독으로 전환 가능)
      await loadPlayers(roomId);
      setLoading(false);
    };

    init().catch((err) => {
      setError(err?.message ?? "오류가 발생했습니다.");
      setLoading(false);
    });

    return () => {
      unsubRoomRef.current?.();
      unsubHandRef.current?.();
    };
  }, [roomId, router, loadPlayers]);

  const game = room?.game;
  const isMyTurn = !!uid && game?.currentUid === uid;
  const me = players.find((p) => p.uid === uid);

  if (loading) {
    return (
      <main className="min-h-dvh bg-dq-charcoalDeep text-dq-white flex items-center justify-center">
        <p className="text-dq-white/60 text-sm">로딩 중…</p>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-dvh bg-dq-charcoalDeep text-dq-white flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-dq-redLight text-sm">{error}</p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="px-4 py-2 rounded-xl bg-dq-black border border-white/10 text-dq-white text-sm hover:bg-white/10"
        >
          홈으로
        </button>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-dq-charcoalDeep text-dq-white flex flex-col">
      {/* ── 상단 상태 표시줄 ─────────────────────────────────────── */}
      <header className="px-4 py-3 bg-dq-charcoal border-b border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-dq-white/50">턴</span>
          <span className="font-mono font-bold text-dq-white text-sm">
            {game?.turnNumber ?? "-"}
          </span>
          {isMyTurn && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-dq-red/20 text-dq-redLight border border-dq-red/30">
              내 차례
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-dq-white/50">덱</span>
            <span className="font-mono text-sm text-dq-white">
              {game?.deckMeta?.drawLeft ?? "-"}
            </span>
          </div>
          <div className="flex gap-3 text-xs">
            <span className="text-dq-redLight font-bold">
              A {game?.scoreByTeam?.A ?? 0}
            </span>
            <span className="text-blue-300 font-bold">
              B {game?.scoreByTeam?.B ?? 0}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col px-4 py-4 gap-4 overflow-hidden">
        {/* ── 플레이어 스트립 ───────────────────────────────────── */}
        <PlayerStrip players={players} game={game} myUid={uid} />

        {/* ── 보드 플레이스홀더 (M4에서 구현) ─────────────────── */}
        <section className="flex-1 bg-dq-charcoal border border-white/10 rounded-2xl flex items-center justify-center min-h-[200px]">
          <div className="text-center space-y-2 p-4">
            <p className="text-dq-white/40 text-sm">10×10 보드</p>
            <p className="text-dq-white/25 text-xs">M4에서 구현 예정</p>
            {game && (
              <p className="text-dq-white/40 text-xs font-mono mt-2">
                칩 점유: {Object.keys(game.chipsByCell).length}칸
              </p>
            )}
          </div>
        </section>

        {/* ── 내 손패 ──────────────────────────────────────────── */}
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold tracking-widest text-dq-white/60 uppercase">
              내 손패
            </h2>
            {me && (
              <div className="flex items-center gap-1.5">
                <TeamBadge teamId={me.teamId} />
                <span className="text-xs text-dq-white/50">{me.nickname}</span>
              </div>
            )}
          </div>

          {hand ? (
            <div className="flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory">
              {hand.cardIds.map((cardId, idx) => {
                const dead = isDeadCard(cardId, game?.chipsByCell ?? {});
                return (
                  <div key={`${cardId}-${idx}`} className="snap-start shrink-0">
                    <CardTile
                      cardId={cardId}
                      selected={selectedCard === cardId}
                      isMyTurn={isMyTurn}
                      isDead={dead}
                      onClick={() => {
                        if (dead) return;
                        setSelectedCard((prev) => (prev === cardId ? null : cardId));
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-20 flex items-center justify-center">
              <p className="text-dq-white/40 text-sm">손패 로딩 중…</p>
            </div>
          )}
        </section>
      </div>

      {/* ── 하단 액션 바 (M4에서 활성화) ────────────────────────── */}
      <div
        className="px-4 py-3 bg-dq-charcoal border-t border-white/10"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          disabled={!isMyTurn || !selectedCard}
          className="w-full min-h-[44px] rounded-xl font-bold text-sm bg-dq-red text-dq-white hover:bg-dq-redLight disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dq-redLight"
        >
          {isMyTurn ? (selectedCard ? "카드 놓기 (M4 구현 예정)" : "카드를 선택하세요") : "상대 턴 대기 중…"}
        </button>
      </div>
    </main>
  );
}
