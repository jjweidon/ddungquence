"use client";

import { useEffect, useState, useRef, useCallback, memo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ensureAnonAuth } from "@/features/auth/ensureAnonAuth";
import { subscribeToRoom } from "@/features/room/roomApi";
import { subscribeToHand, submitTurnAction } from "@/features/game/gameApi";
import { cardImageUrl, cardAltText } from "@/shared/lib/cardImage";
import { sortParticipantsRedBlue } from "@/shared/lib/players";
import { isDeadCard } from "@/domain/rules/deadCard";
import { isTwoEyedJack, isOneEyedJack } from "@/domain/rules/jacks";
import { getHighlightForCard } from "@/domain/rules/highlight";
import boardLayout from "@/domain/board/board-layout.v1.json";
import type { RoomDoc, RoomPlayerDoc, PublicGameState, TeamId } from "@/features/room/types";
import type { PrivateHandDoc, GameAction } from "@/features/game/types";
import { collection, getDocs } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/client";

const BOARD_LAYOUT = boardLayout as string[];

/** 보드 셀용 SVG 이미지 경로 — 벡터라 어떤 셀 크기에도 잘림 없음 */
function boardCardImageUrl(cardId: string): string {
  return `/cards/svg/${cardId}.svg`;
}

// ─── 팀 배지 ─────────────────────────────────────────────────────
function TeamBadge({ teamId }: { teamId?: string | null }) {
  if (!teamId) return null;
  const cls =
    teamId === "A"
      ? "bg-dq-red/20 text-dq-redLight border border-dq-red/30"
      : "bg-dq-blue/20 text-dq-blueLight border border-dq-blue/30";
  return (
    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>
      {teamId === "A" ? "레드" : "블루"}
    </span>
  );
}

// ─── 칩 오버레이 ─────────────────────────────────────────────────
const ChipOverlay = memo(function ChipOverlay({
  teamId,
  isInSequence,
}: {
  teamId: TeamId;
  isInSequence: boolean;
}) {
  const base =
    teamId === "A"
      ? "bg-dq-redDark/90 border-dq-red"
      : "bg-dq-blueDark border-dq-blueLight";
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        className={[
          "rounded-full border-2 aspect-square w-[52%]",
          base,
          isInSequence ? "shadow-lg ring-2 ring-white/40" : "",
        ].join(" ")}
      >
        {isInSequence && (
          <span className="flex h-full items-center justify-center text-white/90 text-[8px] font-bold leading-none">
            ★
          </span>
        )}
      </div>
    </div>
  );
});

// ─── 보드 셀 ─────────────────────────────────────────────────────
const BoardCell = memo(function BoardCell({
  cellId,
  cardId,
  chip,
  isInSequence,
  isPlayable,
  isRemovable,
  isDimmed,
  onClick,
}: {
  cellId: number;
  cardId: string;
  chip?: TeamId;
  isInSequence: boolean;
  isPlayable: boolean;
  isRemovable: boolean;
  isDimmed: boolean;
  onClick: () => void;
}) {
  const interactive = isPlayable || isRemovable;

  // drop-shadow는 img 실제 픽셀(카드 영역)을 따라가므로
  // 셀 크기와 카드 이미지 크기 차이에 무관하게 카드 윤곽에 딱 맞게 발광함
  const shadowFilter = isPlayable
    ? "[filter:drop-shadow(0_0_4px_#FBBF24)_drop-shadow(0_0_2px_#F59E0B)]"
    : isRemovable
      ? "[filter:drop-shadow(0_0_4px_#fb923c)_drop-shadow(0_0_2px_#ea580c)]"
      : "";

  return (
    <button
      type="button"
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      aria-label={cardAltText(cardId)}
      className={[
        "relative overflow-hidden rounded-[2px] select-none transition-opacity duration-150",
        interactive ? "cursor-pointer" : "cursor-default",
        isDimmed ? "opacity-30" : "opacity-100",
        isPlayable ? "hover:brightness-110" : "",
        isRemovable ? "hover:brightness-125" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* SVG 이미지 — drop-shadow가 카드 실제 픽셀 윤곽을 따라 발광 */}
      <img
        src={boardCardImageUrl(cardId)}
        alt={cardAltText(cardId)}
        loading={cellId < 30 ? "eager" : "lazy"}
        decoding="async"
        className={["w-full h-full", shadowFilter].filter(Boolean).join(" ")}
        draggable={false}
      />
      {/* 칩 오버레이 */}
      {chip && <ChipOverlay teamId={chip} isInSequence={isInSequence} />}
    </button>
  );
});

// ─── 게임 보드 ───────────────────────────────────────────────────
function GameBoard({
  game,
  myTeamId,
  selectedCard,
  onCellClick,
}: {
  game: PublicGameState | undefined;
  myTeamId: TeamId | undefined;
  selectedCard: string | null;
  onCellClick: (cellId: number) => void;
}) {
  const chipsByCell = game?.chipsByCell ?? {};
  const completedSequences = game?.completedSequences ?? [];
  const sequenceCells = new Set(completedSequences.flatMap((s) => s.cells));

  const highlight =
    selectedCard && myTeamId
      ? getHighlightForCard(
          selectedCard,
          myTeamId,
          chipsByCell,
          completedSequences,
          game?.oneEyeLockedCell,
        )
      : null;

  return (
    <div className="w-full h-full grid grid-cols-10 grid-rows-10 gap-[3px] p-[3px] bg-dq-charcoal rounded-xl">
      {BOARD_LAYOUT.map((cardId, idx) => {
        const isPlayable = highlight?.playable.has(idx) ?? false;
        const isRemovable = highlight?.removable.has(idx) ?? false;
        // 카드가 선택됐고 이 셀이 활성 대상이 아니면 어둡게
        const isDimmed = !!highlight && !isPlayable && !isRemovable;
        return (
          <BoardCell
            key={idx}
            cellId={idx}
            cardId={cardId}
            chip={chipsByCell[String(idx)] as TeamId | undefined}
            isInSequence={sequenceCells.has(idx)}
            isPlayable={isPlayable}
            isRemovable={isRemovable}
            isDimmed={isDimmed}
            onClick={() => onCellClick(idx)}
          />
        );
      })}
    </div>
  );
}

// ─── 카드 타일 (손패) ─────────────────────────────────────────────
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
          ? "border-amber-400 ring-2 ring-amber-400 scale-105"
          : "border-white/20 hover:border-white/50",
        isMyTurn && !isDead ? "cursor-pointer active:scale-95" : "cursor-default",
        isDead ? "opacity-35 grayscale" : "",
      ].join(" ")}
      aria-label={cardAltText(cardId)}
      aria-pressed={selected}
    >
      <img
        src={cardImageUrl(cardId)}
        alt={cardAltText(cardId)}
        width={56}
        height={80}
        loading="eager"
        decoding="async"
        className="block w-[56px] h-[80px] object-cover"
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

// ─── 덱 비주얼 ────────────────────────────────────────────────────
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

// ─── 플레이어 목록 패널 (데스크톱) ───────────────────────────────
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
                ? "border-dq-blue"
                : "border-white/20";
          return (
            <div
              key={p.uid}
              className={[
                "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all",
                isCurrentTurn
                  ? "bg-amber-400/10 border-amber-400/40 ring-1 ring-amber-400/40"
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
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-400 border border-amber-400/30">
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

// ─── 플레이어 스트립 (모바일) ─────────────────────────────────────
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
                ? "bg-dq-black border-amber-400 ring-1 ring-amber-400"
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
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-400 border border-amber-400/30">
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

// ─── 손패 섹션 ────────────────────────────────────────────────────
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
              <div
                key={`${cardId}-${idx}`}
                className={layout === "mobile" ? "snap-start shrink-0" : ""}
              >
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

// ─── 액션 상태 표시줄 ─────────────────────────────────────────────
function ActionBar({
  isMyTurn,
  selectedCard,
  txPending,
  txError,
  onClearError,
}: {
  isMyTurn: boolean;
  selectedCard: string | null;
  txPending: boolean;
  txError: string | null;
  onClearError: () => void;
}) {
  if (txError) {
    return (
      <button
        type="button"
        onClick={onClearError}
        className="w-full min-h-[48px] rounded-xl font-bold text-sm bg-dq-redDark text-dq-white/90 px-4"
      >
        {txError} (탭하여 닫기)
      </button>
    );
  }
  if (txPending) {
    return (
      <div className="w-full min-h-[48px] rounded-xl bg-dq-black border border-white/10 flex items-center justify-center">
        <span className="text-dq-white/60 text-sm">처리 중…</span>
      </div>
    );
  }
  if (!isMyTurn) {
    return (
      <div className="w-full min-h-[48px] rounded-xl bg-dq-black border border-white/10 flex items-center justify-center">
        <span className="text-dq-white/40 text-sm">상대 턴 대기 중…</span>
      </div>
    );
  }
  if (!selectedCard) {
    return (
      <div className="w-full min-h-[48px] rounded-xl bg-dq-black border border-white/10 flex items-center justify-center">
        <span className="text-dq-white/60 text-sm">손패에서 카드를 선택하세요</span>
      </div>
    );
  }

  const hint = isTwoEyedJack(selectedCard)
    ? "보드의 빈 칸을 탭하세요 (Wild)"
    : isOneEyedJack(selectedCard)
      ? "제거할 상대 칩을 탭하세요"
      : "보드에서 놓을 위치를 탭하세요";

  return (
    <div className="w-full min-h-[48px] rounded-xl bg-dq-red/10 border border-dq-red/30 flex items-center justify-center px-4">
      <span className="text-dq-redLight text-sm font-medium">{hint}</span>
    </div>
  );
}

// ─── 승리/종료 오버레이 ───────────────────────────────────────────
function EndedOverlay({
  game,
  myTeamId,
  onGoHome,
}: {
  game: PublicGameState;
  myTeamId: TeamId | undefined;
  onGoHome: () => void;
}) {
  const winner = game.winner;
  if (!winner) return null;

  const isWinner = winner.teamId === myTeamId;
  const teamLabel = winner.teamId === "A" ? "레드 팀" : "블루 팀";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-dq-charcoal border border-white/20 rounded-2xl p-8 flex flex-col items-center gap-6 mx-4 max-w-sm w-full">
        <p className="text-5xl">{isWinner ? "🎉" : "😔"}</p>
        <div className="text-center">
          <p className="text-dq-white/60 text-sm mb-1">게임 종료</p>
          <p className="text-2xl font-bold text-dq-white">{teamLabel} 승리!</p>
          {isWinner && (
            <p className="text-dq-redLight font-bold mt-1">축하합니다!</p>
          )}
        </div>
        <div className="flex gap-3 text-sm font-bold">
          <span className="text-dq-redLight">레드 {game.scoreByTeam.A}시퀀스</span>
          <span className="text-dq-white/40">vs</span>
          <span className="text-dq-blueLight">블루 {game.scoreByTeam.B}시퀀스</span>
        </div>
        <button
          type="button"
          onClick={onGoHome}
          className="w-full h-12 rounded-xl bg-dq-red text-dq-white font-bold hover:bg-dq-redLight transition-colors"
        >
          홈으로
        </button>
      </div>
    </div>
  );
}

// ─── 게임 페이지 ──────────────────────────────────────────────────
export default function GamePage() {
  const params = useParams();
  const router = useRouter();
  const roomId = (params?.roomId as string) ?? "";

  const [uid, setUid] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomDoc | null>(null);
  const [players, setPlayers] = useState<RoomPlayerDoc[]>([]);
  const [hand, setHand] = useState<PrivateHandDoc | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [txPending, setTxPending] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
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

  const participants = players
    .filter((p) => p.role === "participant")
    .map((p) => ({ uid: p.uid, seat: p.seat ?? 0, teamId: (p.teamId ?? "A") as TeamId }));

  const handleSelectCard = useCallback(
    (cardId: string) => {
      if (!isMyTurn) return;
      setSelectedCard((prev) => (prev === cardId ? null : cardId));
      setTxError(null);
    },
    [isMyTurn],
  );

  const handleCellClick = useCallback(
    async (cellId: number) => {
      if (!selectedCard || !isMyTurn || !game || txPending) return;

      const expectedVersion = game.version;
      let action: GameAction;

      if (isTwoEyedJack(selectedCard)) {
        action = { type: "TURN_PLAY_JACK_WILD", expectedVersion, cardId: selectedCard, targetCellId: cellId };
      } else if (isOneEyedJack(selectedCard)) {
        action = { type: "TURN_PLAY_JACK_REMOVE", expectedVersion, cardId: selectedCard, removeCellId: cellId };
      } else {
        action = { type: "TURN_PLAY_NORMAL", expectedVersion, cardId: selectedCard, targetCellId: cellId };
      }

      setTxPending(true);
      setTxError(null);
      setSelectedCard(null);

      try {
        await submitTurnAction(roomId, action, participants);
      } catch (err) {
        const msg = (err as Error).message ?? "알 수 없는 오류";
        if (msg === "VERSION_MISMATCH") {
          setTxError("다른 플레이어가 먼저 진행했습니다. 다시 선택해 주세요.");
        } else {
          setTxError(msg);
        }
      } finally {
        setTxPending(false);
      }
    },
    [selectedCard, isMyTurn, game, txPending, roomId, participants],
  );

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
    <main className="h-dvh overflow-hidden bg-dq-charcoalDeep text-dq-white flex flex-col">
      {/* 승리 오버레이 */}
      {game?.phase === "ended" && game.winner && (
        <EndedOverlay
          game={game}
          myTeamId={me?.teamId}
          onGoHome={() => router.push("/")}
        />
      )}

      {/* ── 상단 상태 표시줄 ──────────────────────────────────────── */}
      <header className="shrink-0 px-4 py-3 bg-dq-charcoal border-b border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-dq-white/50">턴</span>
          <span className="font-mono font-bold text-dq-white text-sm">
            {game?.turnNumber ?? "-"}
          </span>
          {isMyTurn && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-400 border border-amber-400/30">
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
            <span className="text-dq-redLight font-bold">A {game?.scoreByTeam?.A ?? 0}</span>
            <span className="text-dq-blueLight font-bold">B {game?.scoreByTeam?.B ?? 0}</span>
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
        <section className="flex flex-col gap-3 overflow-hidden min-h-0">
          <p className="shrink-0 text-xs font-bold tracking-widest text-dq-white/50 uppercase text-center">
            Game Board
          </p>
          <div className="flex-1 min-h-0 overflow-hidden flex items-center justify-center">
            <div className="aspect-square h-full max-w-full">
              <GameBoard
                game={game}
                myTeamId={me?.teamId}
                selectedCard={selectedCard}
                onCellClick={handleCellClick}
              />
            </div>
          </div>
        </section>

        {/* 우측: 덱 + 손패 + 액션바 */}
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
          <ActionBar
            isMyTurn={isMyTurn}
            selectedCard={selectedCard}
            txPending={txPending}
            txError={txError}
            onClearError={() => setTxError(null)}
          />
        </aside>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* 모바일 레이아웃 (기본): 수직 스택                         */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col gap-2 px-4 pt-2 overflow-hidden lg:hidden">
        {/* shrink-0: 플레이어 스트립은 고정 높이 */}
        <div className="shrink-0">
          <PlayerStrip players={players} game={game} myUid={uid} />
        </div>

        {/* 보드: 남은 공간 전체를 채움 */}
        <section className="flex-1 min-h-0 overflow-hidden flex items-center justify-center">
          <div className="aspect-square h-full max-w-full">
            <GameBoard
              game={game}
              myTeamId={me?.teamId}
              selectedCard={selectedCard}
              onCellClick={handleCellClick}
            />
          </div>
        </section>

        {/* shrink-0: 손패는 고정 높이 */}
        <div className="shrink-0">
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
      </div>

      {/* 모바일 하단 고정 액션바 */}
      <div
        className="shrink-0 px-4 py-3 bg-dq-charcoal border-t border-white/10 lg:hidden"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
      >
        <ActionBar
          isMyTurn={isMyTurn}
          selectedCard={selectedCard}
          txPending={txPending}
          txError={txError}
          onClearError={() => setTxError(null)}
        />
      </div>
    </main>
  );
}
