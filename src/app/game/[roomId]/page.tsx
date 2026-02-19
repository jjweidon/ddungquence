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

// ─── 보드 그리드 플레이스홀더 ────────────────────────────────────
function BoardGrid({ chipsByCell }: { chipsByCell?: Record<string, unknown> }) {
  return (
    <div className="w-full aspect-square grid grid-cols-10 gap-[2px] p-2 bg-dq-charcoal border border-white/10 rounded-2xl">
      {Array.from({ length: 100 }, (_, i) => (
        <div
          key={i}
          className="aspect-square rounded-[2px] border border-white/10 bg-dq-black/50"
        />
      ))}
      {chipsByCell && Object.keys(chipsByCell).length > 0 && (
        <span className="sr-only">칩 점유: {Object.keys(chipsByCell).length}칸</span>
      )}
    </div>
  );
}

// ─── 덱 비주얼 ───────────────────────────────────────────────────
function DeckVisual({ drawLeft }: { drawLeft?: number }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs font-bold tracking-widest text-dq-white/50 uppercase">Deck</p>
      <div className="relative w-16 h-24">
        {[2, 1, 0].map((offset) => (
          <div
            key={offset}
            className="absolute bg-dq-charcoal border border-white/20 rounded-md"
            style={{ width: 56, height: 80, top: offset * 4, left: offset * 4 }}
          />
        ))}
      </div>
      <p className="text-sm font-mono text-dq-white/60">
        {drawLeft !== undefined ? `${drawLeft}장` : "-"}
      </p>
    </div>
  );
}

// ─── 플레이어 목록 패널 (데스크톱 좌측) ──────────────────────────
function PlayerListPanel({
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
    <div className="bg-dq-charcoal border border-white/10 rounded-2xl p-4 flex flex-col gap-3 h-full">
      <h2 className="text-xs font-bold tracking-widest text-dq-white/50 uppercase">
        Player List
      </h2>
      <div className="flex flex-col gap-2">
        {participants.map((p) => {
          const isCurrentTurn = game?.currentUid === p.uid;
          const isMe = p.uid === myUid;
          const teamBorder =
            p.teamId === "A"
              ? "border-dq-red"
              : p.teamId === "B"
                ? "border-blue-500"
                : "border-white/20";
          return (
            <div
              key={p.uid}
              className={[
                "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all",
                isCurrentTurn
                  ? "bg-dq-redLight/10 border-dq-redLight/40 ring-1 ring-dq-redLight/40"
                  : "bg-dq-black border-white/10",
              ].join(" ")}
            >
              <div
                className={[
                  "size-8 shrink-0 rounded-md border-2 bg-dq-charcoalDeep",
                  teamBorder,
                ].join(" ")}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap">
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
                  <TeamBadge teamId={p.teamId} />
                </div>
                <p className="text-sm text-dq-white/90 truncate mt-0.5">{p.nickname}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 플레이어 스트립 (모바일 가로 스크롤) ────────────────────────
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

// ─── 손패 섹션 ───────────────────────────────────────────────────
function HandSection({
  hand,
  game,
  isMyTurn,
  me,
  selectedCard,
  onSelectCard,
  layout,
}: {
  hand: PrivateHandDoc | null;
  game: PublicGameState | undefined;
  isMyTurn: boolean;
  me: RoomPlayerDoc | undefined;
  selectedCard: string | null;
  onSelectCard: (cardId: string) => void;
  layout: "mobile" | "desktop";
}) {
  const gridClass =
    layout === "desktop"
      ? "grid grid-cols-3 gap-2"
      : "flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold tracking-widest text-dq-white/50 uppercase">
          My Card
        </h2>
        {me && (
          <div className="flex items-center gap-1.5">
            <TeamBadge teamId={me.teamId} />
            <span className="text-xs text-dq-white/50">{me.nickname}</span>
          </div>
        )}
      </div>

      {hand ? (
        <div className={gridClass}>
          {hand.cardIds.map((cardId, idx) => {
            const dead = isDeadCard(cardId, game?.chipsByCell ?? {});
            return (
              <div key={`${cardId}-${idx}`} className={layout === "mobile" ? "snap-start shrink-0" : ""}>
                <CardTile
                  cardId={cardId}
                  selected={selectedCard === cardId}
                  isMyTurn={isMyTurn}
                  isDead={dead}
                  onClick={() => {
                    if (dead) return;
                    onSelectCard(cardId);
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
    </div>
  );
}

// ─── 카드 놓기 버튼 ──────────────────────────────────────────────
function PlaceCardButton({
  isMyTurn,
  selectedCard,
}: {
  isMyTurn: boolean;
  selectedCard: string | null;
}) {
  return (
    <button
      type="button"
      disabled={!isMyTurn || !selectedCard}
      className="w-full min-h-[48px] rounded-xl font-bold text-sm bg-dq-red text-dq-white hover:bg-dq-redLight disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dq-redLight transition-colors"
    >
      {isMyTurn
        ? selectedCard
          ? "카드 놓기"
          : "카드를 선택하세요"
        : "상대 턴 대기 중…"}
    </button>
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

      unsubHandRef.current = subscribeToHand(roomId, currentUid, setHand);

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

  const handleSelectCard = (cardId: string) => {
    setSelectedCard((prev) => (prev === cardId ? null : cardId));
  };

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
      <header className="shrink-0 px-4 py-3 bg-dq-charcoal border-b border-white/10 flex items-center justify-between gap-3">
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
          <div className="flex items-center gap-1.5 lg:hidden">
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

      {/* ══════════════════════════════════════════════════════════ */}
      {/* 데스크톱 레이아웃 (lg+): 3열 그리드                       */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="hidden lg:grid flex-1 grid-cols-[300px_minmax(0,1fr)_360px] gap-6 p-6 overflow-hidden">
        {/* 좌측: 플레이어 목록 */}
        <aside className="overflow-y-auto">
          <PlayerListPanel players={players} game={game} myUid={uid} />
        </aside>

        {/* 중앙: 게임 보드 */}
        <section className="flex flex-col gap-3 overflow-hidden">
          <p className="text-xs font-bold tracking-widest text-dq-white/50 uppercase text-center">
            Game Board
          </p>
          <div className="flex-1 flex items-center justify-center overflow-hidden">
            <div className="w-full max-h-full aspect-square">
              <BoardGrid chipsByCell={game?.chipsByCell} />
            </div>
          </div>
        </section>

        {/* 우측: 덱 + 손패 + 버튼 */}
        <aside className="flex flex-col gap-6 overflow-y-auto">
          <DeckVisual drawLeft={game?.deckMeta?.drawLeft} />
          <HandSection
            hand={hand}
            game={game}
            isMyTurn={isMyTurn}
            me={me}
            selectedCard={selectedCard}
            onSelectCard={handleSelectCard}
            layout="desktop"
          />
          <PlaceCardButton isMyTurn={isMyTurn} selectedCard={selectedCard} />
        </aside>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* 모바일 레이아웃 (기본): 수직 스택                         */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col gap-3 px-4 pt-3 overflow-hidden lg:hidden">
        <PlayerStrip players={players} game={game} myUid={uid} />

        <section className="flex-1 flex items-center justify-center overflow-hidden min-h-0">
          <div className="w-full aspect-square max-h-full">
            <BoardGrid chipsByCell={game?.chipsByCell} />
          </div>
        </section>

        <HandSection
          hand={hand}
          game={game}
          isMyTurn={isMyTurn}
          me={me}
          selectedCard={selectedCard}
          onSelectCard={handleSelectCard}
          layout="mobile"
        />
      </div>

      {/* 모바일 하단 고정 버튼 */}
      <div
        className="shrink-0 px-4 py-3 bg-dq-charcoal border-t border-white/10 lg:hidden"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
      >
        <PlaceCardButton isMyTurn={isMyTurn} selectedCard={selectedCard} />
      </div>
    </main>
  );
}
