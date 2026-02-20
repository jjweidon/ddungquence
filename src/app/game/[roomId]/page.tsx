"use client";

import { useEffect, useLayoutEffect, useState, useRef, useCallback, memo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ensureAnonAuth } from "@/features/auth/ensureAnonAuth";
import { subscribeToRoom, returnToLobby } from "@/features/room/roomApi";
import { subscribeToHand, submitTurnAction } from "@/features/game/gameApi";
import { cardImageUrl, cardAltText } from "@/shared/lib/cardImage";
import { sortParticipantsRedBlue } from "@/shared/lib/players";
import { isDeadCard, getPlayableCells } from "@/domain/rules/deadCard";
import { isTwoEyedJack, isOneEyedJack, isJack } from "@/domain/rules/jacks";
import { getHighlightForCard } from "@/domain/rules/highlight";
import boardLayout from "@/domain/board/board-layout.v1.json";
import type { RoomDoc, RoomPlayerDoc, PublicGameState, TeamId } from "@/features/room/types";
import type { PrivateHandDoc, GameAction } from "@/features/game/types";
import { collection, getDocs } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/client";

const BOARD_LAYOUT = boardLayout as string[];

/** 턴 제한 시간(초) */
const TURN_SECONDS = 30;
/** 임박 경고 시작 초(이하일 때 빨간색 + 애니메이션) */
const TURN_WARNING_AT = 5;

/** 손패 카드 픽셀 크기 — 모바일(작게) / 데스크톱(원래 크기). 셀·버튼·이미지 동일 적용 */
const HAND_CARD_MOBILE = { width: 48, height: 69 };
const HAND_CARD_DESKTOP = { width: 72, height: 104 };

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
  isRemovable,
  chipAnimClass,
}: {
  teamId: TeamId;
  isInSequence: boolean;
  isRemovable?: boolean;
  /** chip circle에 직접 적용되는 애니메이션 클래스 */
  chipAnimClass?: string;
}) {
  const base =
    teamId === "A"
      ? "bg-dq-redDark/90 border-dq-red"
      : "bg-dq-blueDark border-dq-blueLight";

  const ringClass = isRemovable
    ? "ring-2 ring-orange-400 ring-offset-[1px] ring-offset-black/80 shadow-[0_0_12px_4px_rgba(251,146,60,0.75)]"
    : isInSequence
      ? "shadow-lg ring-2 ring-white/40"
      : "";

  const hasOverlay = isRemovable || isInSequence;
  return (
    <div
      className={[
        "absolute inset-0 flex items-center justify-center",
        isRemovable ? "animate-pulse" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* 칩: 항상 원형 유지, 내부 콘텐츠 없음 */}
      <div
        className={[
          "relative w-[52%] aspect-square",
          "rounded-full border-2 shrink-0",
          base,
          ringClass,
          chipAnimClass,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {/* 별/✕는 별도 레이어로 칩 위에 오버레이 (칩 형태에 영향 없음) */}
        {hasOverlay && (
          <div
            className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
            aria-hidden
          >
            {isRemovable ? (
              <span className="text-orange-200 text-[11px] font-black leading-none select-none">
                ✕
              </span>
            ) : (
              <span className="text-white/90 text-[8px] font-bold leading-none select-none">
                ★
              </span>
            )}
          </div>
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
  jackType,
  placedAnim,
  removingTeamId,
  cellClickable,
  onClick,
}: {
  cellId: number;
  cardId: string;
  chip?: TeamId;
  isInSequence: boolean;
  isPlayable: boolean;
  isRemovable: boolean;
  isDimmed: boolean;
  jackType: "wild" | "remove" | null;
  /** 방금 배치된 칩의 종류 → 배치 애니메이션 선택 */
  placedAnim?: "normal" | "wild";
  /** 방금 제거된 칩 팀 → 유령 칩 제거 애니메이션 렌더링 */
  removingTeamId?: TeamId;
  /** false면 하이라이트만 표시, 클릭 불가(상대 턴 위치 확인용) */
  cellClickable: boolean;
  onClick: () => void;
}) {
  const interactive = isPlayable || isRemovable;
  const canClick = interactive && cellClickable;

  // drop-shadow는 img 실제 픽셀(카드 영역)을 따라가므로
  // 셀 크기와 카드 이미지 크기 차이에 무관하게 카드 윤곽에 딱 맞게 발광함
  const shadowFilter = isPlayable
    ? jackType === "wild"
      ? // 2-eye wild: 보라빛 마법 글로우로 일반 배치와 구분
        "[filter:drop-shadow(0_0_5px_#A78BFA)_drop-shadow(0_0_3px_#7C3AED)]"
      : "[filter:drop-shadow(0_0_4px_#FBBF24)_drop-shadow(0_0_2px_#F59E0B)]"
    : isRemovable
      ? "[filter:drop-shadow(0_0_6px_#fb923c)_drop-shadow(0_0_3px_#ea580c)]"
      : "";

  const chipAnimClass =
    placedAnim === "wild"
      ? "animate-chip-place-wild"
      : placedAnim === "normal"
        ? "animate-chip-place"
        : undefined;

  return (
    <button
      type="button"
      onClick={canClick ? onClick : undefined}
      disabled={!canClick}
      aria-label={cardAltText(cardId)}
      className={[
        "relative overflow-hidden rounded-[2px] select-none transition-opacity duration-150",
        canClick ? "cursor-pointer" : "cursor-default",
        isDimmed ? "opacity-30" : "opacity-100",
        canClick && isPlayable ? "hover:brightness-110" : "",
        canClick && isRemovable ? "hover:brightness-125" : "",
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
      {/* 제거 중인 유령 칩 (1-eye jack 제거 애니메이션) */}
      {removingTeamId && (
        <ChipOverlay
          teamId={removingTeamId}
          isInSequence={false}
          chipAnimClass="animate-chip-remove will-change-[transform,opacity] pointer-events-none"
        />
      )}
      {/* 일반 칩 오버레이 */}
      {chip && (
        <ChipOverlay
          teamId={chip}
          isInSequence={isInSequence}
          isRemovable={isRemovable}
          chipAnimClass={chipAnimClass}
        />
      )}
      {/* 2-eye wild 배치 가능 빈 칸 표시 */}
      {jackType === "wild" && isPlayable && !chip && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-violet-300/70 text-[10px] font-black leading-none select-none animate-pulse">
            ✦
          </span>
        </div>
      )}
    </button>
  );
});

/** 칩 애니메이션 상태 */
type CellAnim =
  | { type: "placed"; isJackWild: boolean }
  | { type: "removing"; teamId: TeamId };

// ─── 게임 보드 ───────────────────────────────────────────────────
function GameBoard({
  game,
  myTeamId,
  selectedCard,
  cellClickable,
  onCellClick,
}: {
  game: PublicGameState | undefined;
  myTeamId: TeamId | undefined;
  selectedCard: string | null;
  /** false면 하이라이트만 표시하고 셀 클릭 불가(상대 턴 위치 확인용) */
  cellClickable: boolean;
  onCellClick: (cellId: number) => void;
}) {
  const chipsByCell = game?.chipsByCell ?? {};
  const completedSequences = game?.completedSequences ?? [];
  const sequenceCells = new Set(completedSequences.flatMap((s) => s.cells));

  // ── 칩 변화 감지 → 배치/제거 애니메이션 ──────────────────────────
  const prevChipsRef = useRef<Record<string, TeamId> | null>(null);
  const [cellAnims, setCellAnims] = useState<Map<number, CellAnim>>(new Map());
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // useLayoutEffect: paint 전에 cellAnims 설정 → 칩 제거 시 유령 칩이 한 프레임 누락되지 않음
  useLayoutEffect(() => {
    // 첫 렌더(초기 로드): 기존 칩은 애니메이션 없이 그냥 표시
    if (prevChipsRef.current === null) {
      prevChipsRef.current = chipsByCell;
      return;
    }

    const prev = prevChipsRef.current;
    const curr = chipsByCell;
    const newAnims = new Map<number, CellAnim>();

    // 제거된 칩 감지
    for (const [key, teamId] of Object.entries(prev)) {
      if (!(key in curr)) {
        newAnims.set(Number(key), { type: "removing", teamId: teamId as TeamId });
      }
    }

    // 새로 배치된 칩 감지
    const isJackWild = game?.lastAction?.type === "TURN_PLAY_JACK_WILD";
    for (const key of Object.keys(curr)) {
      if (!(key in prev)) {
        newAnims.set(Number(key), { type: "placed", isJackWild });
      }
    }

    prevChipsRef.current = curr;

    if (newAnims.size > 0) {
      setCellAnims((prev) => {
        const merged = new Map(prev);
        for (const [k, v] of newAnims) merged.set(k, v);
        return merged;
      });
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      // chip-remove 1초 + 여유 100ms 후 정리 (턴 전환 후에도 애니메이션 완료 보장)
      animTimerRef.current = setTimeout(() => setCellAnims(new Map()), 1100);
    }
  }, [chipsByCell]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
    };
  }, []);

  const highlight =
    selectedCard && myTeamId
      ? getHighlightForCard(
          selectedCard,
          myTeamId,
          chipsByCell,
          completedSequences,
          game?.oneEyeLockedCell,
          game?.twoEyeLockedCell,
        )
      : null;

  const jackType = selectedCard
    ? isTwoEyedJack(selectedCard)
      ? "wild"
      : isOneEyedJack(selectedCard)
        ? "remove"
        : null
    : null;

  return (
    <div className="w-full h-full grid grid-cols-10 grid-rows-10 gap-[3px] p-[3px] bg-dq-charcoal rounded-xl">
      {BOARD_LAYOUT.map((cardId, idx) => {
        const isPlayable = highlight?.playable.has(idx) ?? false;
        const isRemovable = highlight?.removable.has(idx) ?? false;
        // 카드가 선택됐고 이 셀이 활성 대상이 아니면 어둡게
        const isDimmed = !!highlight && !isPlayable && !isRemovable;

        const anim = cellAnims.get(idx);
        const placedAnim =
          anim?.type === "placed"
            ? anim.isJackWild
              ? "wild"
              : "normal"
            : undefined;
        const removingTeamId =
          anim?.type === "removing" ? anim.teamId : undefined;

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
            jackType={jackType}
            placedAnim={placedAnim}
            removingTeamId={removingTeamId}
            cellClickable={cellClickable}
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
  isDead,
  onClick,
  width,
  height,
}: {
  cardId: string;
  selected: boolean;
  isDead?: boolean;
  onClick?: () => void;
  width: number;
  height: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDead}
      style={{ width, height }}
      className={[
        "relative shrink-0 rounded-lg overflow-hidden select-none transition-all duration-100",
        selected
          ? "border border-amber-400 ring-1 ring-amber-400 scale-105 z-10"
          : "border border-white/20 hover:border-white/50",
        !isDead ? "cursor-pointer active:scale-95" : "cursor-default",
        isDead ? "opacity-35 grayscale" : "",
      ].join(" ")}
      aria-label={cardAltText(cardId)}
      aria-pressed={selected}
    >
      <img
        src={cardImageUrl(cardId)}
        alt={cardAltText(cardId)}
        width={width}
        height={height}
        loading="eager"
        decoding="async"
        className="block w-full h-full object-cover"
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

// ─── 마지막 사용 카드 썸네일 (플레이어 목록용) ─────────────────────
function LastCardThumb({
  cardId,
  size = "md",
}: {
  cardId: string;
  size?: "xs" | "sm" | "md";
}) {
  const sizeClass =
    size === "xs"
      ? "w-4 h-[22px]"
      : size === "sm"
        ? "w-6 h-[34px]"
        : "w-9 h-12";
  return (
    <img
      src={cardImageUrl(cardId)}
      alt={cardAltText(cardId)}
      className={`${sizeClass} shrink-0 rounded object-cover border border-white/20`}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
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
          const lastCardId =
            p.seat !== undefined && game?.discardTopBySeat
              ? game.discardTopBySeat[String(p.seat)] ?? null
              : null;
          const teamBg =
            p.teamId === "A"
              ? "bg-dq-redLight/20"
              : p.teamId === "B"
                ? "bg-dq-blueLight/20"
                : "bg-dq-black";
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
                teamBg,
                isCurrentTurn
                  ? "border-amber-400/60 ring-1 ring-amber-400/60"
                  : "border-white/10",
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
                </div>
                <p className="text-sm text-dq-white/90 truncate mt-0.5">{p.nickname}</p>
              </div>
              {lastCardId && (
                <LastCardThumb cardId={lastCardId} size="md" />
              )}
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
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${participants.length}, 1fr)` }}>
      {participants.map((p) => {
        const isCurrentTurn = game?.currentUid === p.uid;
        const isMe = p.uid === myUid;
        const lastCardId =
          p.seat !== undefined && game?.discardTopBySeat
            ? game.discardTopBySeat[String(p.seat)] ?? null
            : null;
        const teamBg =
          p.teamId === "A"
            ? "bg-dq-redLight/20"
            : p.teamId === "B"
              ? "bg-dq-blueLight/20"
              : "bg-dq-black";
        return (
          <div
            key={p.uid}
            className={[
              "flex flex-col items-center px-2 py-0.5 rounded-xl border min-w-0",
              teamBg,
              isCurrentTurn
                ? "border-amber-400 ring-1 ring-amber-400"
                : "border-white/10",
            ].join(" ")}
          >
            <span
              className={[
                "text-xs truncate w-full text-center px-1.5 rounded",
                isMe ? "bg-white/15 font-bold text-dq-white" : "text-dq-white/80",
              ].join(" ")}
            >
              {p.nickname}
            </span>
            {lastCardId && (
              <LastCardThumb cardId={lastCardId} size="xs" />
            )}
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
  me,
  selectedCard,
  onSelectCard,
  layout,
}: {
  hand: PrivateHandDoc | null;
  game: PublicGameState | undefined;
  me: RoomPlayerDoc | undefined;
  selectedCard: string | null;
  onSelectCard: (cardId: string) => void;
  layout: "mobile" | "desktop";
}) {
  const cardSize = layout === "desktop" ? HAND_CARD_DESKTOP : HAND_CARD_MOBILE;
  const gridStyle =
    layout === "desktop"
      ? { gridTemplateColumns: `repeat(3, ${cardSize.width}px)`, gridAutoRows: `${cardSize.height}px`, gap: 8 }
      : { gridTemplateColumns: `repeat(6, ${cardSize.width}px)`, gridAutoRows: `${cardSize.height}px`, gap: 4 };

  return (
    <div className={`flex flex-col ${layout === "desktop" ? "gap-2 px-2" : "gap-1"}`}>
      {layout === "desktop" && (
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
      )}
      {hand ? (
        <div className="grid overflow-visible justify-center lg:justify-start" style={gridStyle}>
          {hand.cardIds.map((cardId, idx) => (
            <CardTile
              key={`${cardId}-${idx}`}
              cardId={cardId}
              selected={selectedCard === cardId}
              isDead={isDeadCard(cardId, game?.chipsByCell ?? {})}
              onClick={() => {
                if (isDeadCard(cardId, game?.chipsByCell ?? {})) return;
                onSelectCard(cardId);
              }}
              width={cardSize.width}
              height={cardSize.height}
            />
          ))}
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
  gameEnded,
}: {
  isMyTurn: boolean;
  selectedCard: string | null;
  txPending: boolean;
  txError: string | null;
  onClearError: () => void;
  gameEnded?: boolean;
}) {
  const barHeight = "min-h-[24px] lg:min-h-[40px]";
  const textSize = "text-xs lg:text-sm";

  if (gameEnded) {
    return (
      <div className={`w-full ${barHeight} rounded-lg lg:rounded-xl bg-dq-red/15 border-2 border-dq-red/50 flex items-center justify-center ring-1 ring-dq-red/30`}>
        <span className={`text-dq-redLight font-bold ${textSize}`}>게임이 종료되었습니다</span>
      </div>
    );
  }
  if (txError) {
    return (
      <button
        type="button"
        onClick={onClearError}
        className={`w-full ${barHeight} rounded-lg lg:rounded-xl font-bold ${textSize} bg-dq-redDark text-dq-white/90 px-3 lg:px-4`}
      >
        {txError} (탭하여 닫기)
      </button>
    );
  }
  if (txPending) {
    return (
      <div className={`w-full ${barHeight} rounded-lg lg:rounded-xl bg-dq-black border border-white/10 flex items-center justify-center`}>
        <span className={`text-dq-white/60 ${textSize}`}>처리 중…</span>
      </div>
    );
  }
  if (!isMyTurn) {
    return (
      <div className={`w-full ${barHeight} rounded-lg lg:rounded-xl bg-dq-black border border-white/10 flex items-center justify-center`}>
        <span className={`text-dq-white/40 ${textSize}`}>상대 턴 대기 중…</span>
      </div>
    );
  }
  if (!selectedCard) {
    return (
      <div className={`w-full ${barHeight} rounded-lg lg:rounded-xl bg-amber-400/15 border-2 border-amber-400/50 flex items-center justify-center ring-1 ring-amber-400/30`}>
        <span className={`text-amber-400 font-bold ${textSize}`}>카드를 선택하세요</span>
      </div>
    );
  }

  const hint = isTwoEyedJack(selectedCard)
    ? "보드의 빈 칸을 탭하세요 (Wild)"
    : isOneEyedJack(selectedCard)
      ? "제거할 상대 칩을 탭하세요"
      : "보드에서 놓을 위치를 탭하세요";

  return (
    <div className={`w-full ${barHeight} rounded-lg lg:rounded-xl bg-dq-red/10 border border-dq-red/30 flex items-center justify-center px-3 lg:px-4`}>
      <span className={`text-dq-redLight ${textSize} font-medium`}>{hint}</span>
    </div>
  );
}

// ─── 시퀀스 완성 팝업 (잠시 표시 후 사라짐) ─────────────────────────
function SequenceCompletePopup({ teamId }: { teamId: TeamId }) {
  const teamLabel = teamId === "A" ? "레드 팀" : "블루 팀";
  const borderClass =
    teamId === "A" ? "border-dq-redLight" : "border-dq-blueLight";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
      <div
        className={`animate-dq-sequence-pop mx-4 max-w-sm w-full rounded-2xl p-8 flex flex-col items-center gap-4 shadow-2xl border-2 bg-dq-charcoal ${borderClass}`}
      >
        <p className="text-6xl animate-pulse">★</p>
        <p className="text-2xl font-bold text-dq-white drop-shadow-lg">
          {teamLabel} 시퀀스 완성!
        </p>
      </div>
    </div>
  );
}

// ─── 승리/종료 오버레이 (승리/패배 명확 표시) ───────────────────────
function EndedOverlay({
  game,
  myTeamId,
  onGoHome,
  onClose,
}: {
  game: PublicGameState;
  myTeamId: TeamId | undefined;
  onGoHome: () => void;
  onClose: () => void;
}) {
  const winner = game.winner;
  if (!winner) return null;

  const isWinner = winner.teamId === myTeamId;
  const teamLabel = winner.teamId === "A" ? "레드 팀" : "블루 팀";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div
        className={[
          "rounded-2xl p-8 flex flex-col items-center gap-6 mx-4 max-w-sm w-full border-2",
          isWinner
            ? "bg-dq-charcoal border-dq-green shadow-[0_0_40px_rgba(22,163,74,0.25)]"
            : "bg-dq-charcoal border-white/20",
        ].join(" ")}
      >
        <p className="text-6xl">{isWinner ? "🎉" : "😭"}</p>
        <div className="text-center">
          <p
            className={[
              "text-3xl font-black tracking-tight mb-2",
              isWinner ? "text-dq-green" : "text-dq-white/70",
            ].join(" ")}
          >
            {isWinner ? "승리!" : "패배ㅠ"}
          </p>
          <p className="text-dq-white/60 text-sm mb-1">게임 종료</p>
          <p className="text-xl font-bold text-dq-white">{teamLabel} 승리!</p>
          {isWinner && (
            <p className="text-dq-redLight font-bold mt-1">축하합니다!</p>
          )}
        </div>
        <div className="flex gap-3 text-sm font-bold">
          <span className="text-dq-redLight">레드 {game.scoreByTeam.A}시퀀스</span>
          <span className="text-dq-white/40">vs</span>
          <span className="text-dq-blueLight">블루 {game.scoreByTeam.B}시퀀스</span>
        </div>
        <div className="w-full flex flex-col gap-2">
          <button
            type="button"
            onClick={onGoHome}
            className="w-full h-12 rounded-xl bg-dq-red text-dq-white font-bold hover:bg-dq-redLight transition-colors"
          >
            로비로
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full h-12 rounded-xl bg-white/10 text-dq-white border border-white/20 font-bold hover:bg-white/20 transition-colors"
          >
            닫기
          </button>
        </div>
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
  const prevSeqCountRef = useRef<number>(0);
  const prevPhaseRef = useRef<string>("setup");
  const hasInitializedSeqRef = useRef(false);
  /** 턴 키: 턴이 바뀌었는지 판별용 */
  const lastTurnKeyRef = useRef<string>("");
  /** 시간 초과 자동 플레이 1회만 실행 방지 */
  const timeoutAutoPlayDoneRef = useRef(false);
  /** 시간 초과 시 호출할 자동 플레이 함수(ref로 interval에서 안전하게 호출) */
  const runTimeoutAutoPlayRef = useRef<(() => void) | null>(null);

  const [sequencePopup, setSequencePopup] = useState<TeamId | null>(null);
  const [showResultOverlay, setShowResultOverlay] = useState(false);
  /** 남은 턴 시간(초). 내 턴일 때만 갱신, 0이 되면 자동 플레이 */
  const [turnSecondsLeft, setTurnSecondsLeft] = useState<number | null>(null);

  // roomId 변경 시 시퀀스 팝업 초기화 플래그 리셋 (다른 방 진입 시 새 게임으로 처리)
  useEffect(() => {
    hasInitializedSeqRef.current = false;
  }, [roomId]);

  const loadPlayers = useCallback(async (rid: string) => {
    const db = getFirestoreDb();
    const snap = await getDocs(collection(db, "rooms", rid, "players"));
    const list = snap.docs.map((d) => d.data() as RoomPlayerDoc);
    list.sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));
    setPlayers(list);
  }, []);

  /** 게임 종료 후 로비 재입장: 참여자 준비 상태·입장 순서 초기화 후 이동 */
  const handleGoToLobby = useCallback(async () => {
    const code = room?.roomCode;
    if (!code) { router.push("/"); return; }
    try {
      await returnToLobby(roomId);
    } catch {
      // 실패해도 이동 (로비에서 상태 불일치는 허용)
    }
    router.push(`/lobby/${code}`);
  }, [room, roomId, router]);

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

  // ── 턴 키 동기화 (타이머는 모든 플레이어에게 표시, 자동 플레이만 내 턴일 때) ─────────────────────
  useEffect(() => {
    if (!game || game.phase !== "playing") {
      setTurnSecondsLeft(null);
      return;
    }
    const turnKey = `${game.turnNumber}-${game.currentUid}`;
    if (isMyTurn && lastTurnKeyRef.current !== turnKey) {
      lastTurnKeyRef.current = turnKey;
      timeoutAutoPlayDoneRef.current = false;
    } else if (!isMyTurn) {
      lastTurnKeyRef.current = turnKey;
    }
  }, [game?.turnNumber, game?.currentUid, game?.phase, isMyTurn]);

  // ── 1초마다 남은 시간 갱신 (전원 표시) + 내 턴일 때만 0이면 자동 플레이 ───────────────────
  useEffect(() => {
    if (game?.phase !== "playing") return;

    const tick = () => {
      const startMs =
        game?.turnStartedAt?.toMillis?.() ??
        game?.lastAction?.at?.toMillis?.() ??
        Date.now();
      const elapsed = (Date.now() - startMs) / 1000;
      const left = Math.max(0, Math.ceil(TURN_SECONDS - elapsed));
      setTurnSecondsLeft(left);

      if (isMyTurn && left <= 0 && !timeoutAutoPlayDoneRef.current) {
        timeoutAutoPlayDoneRef.current = true;
        runTimeoutAutoPlayRef.current?.();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [
    isMyTurn,
    game?.phase,
    game?.turnNumber,
    game?.currentUid,
    game?.turnStartedAt,
    game?.lastAction?.at,
  ]);

  // 시퀀스 완성 팝업 + 결과창 타이밍 (칩 놓음 → 1초 뒤 시퀀스 팝업 → 2초 후 팝업 사라짐 / 게임 종료 시 2초 후 결과창)
  useEffect(() => {
    if (!game) return;

    const seqCount = game.completedSequences?.length ?? 0;
    const phase = game.phase;

    // 초기 로드(새로고침 등): ref만 동기화하고 팝업은 표시하지 않음
    if (!hasInitializedSeqRef.current) {
      hasInitializedSeqRef.current = true;
      prevSeqCountRef.current = seqCount;
      prevPhaseRef.current = phase;
      if (phase === "ended") setShowResultOverlay(true);
      return;
    }

    const wasPlaying = prevPhaseRef.current === "playing";
    const seqJustIncreased = seqCount > prevSeqCountRef.current;

    prevSeqCountRef.current = seqCount;
    prevPhaseRef.current = phase;

    if (phase === "ended") {
      if (seqJustIncreased) {
        // 방금 시퀀스 완성으로 게임 종료 → 보드 2초 노출(시퀀스 팝업 없음) 후 결과창
        const t = setTimeout(() => {
          setShowResultOverlay(true);
        }, 2000);
        return () => clearTimeout(t);
      }
      if (!wasPlaying) {
        // 페이지 로드 시 이미 종료된 게임 → 결과창 즉시 표시
        setShowResultOverlay(true);
      }
    } else if (phase === "playing" && seqJustIncreased) {
      // 1번째 시퀀스 완성 (게임 계속) → 1초 뒤 팝업 표시, 2초 후 사라짐
      const lastSeq = game.completedSequences[seqCount - 1];
      const tShow = setTimeout(() => {
        if (lastSeq) setSequencePopup(lastSeq.teamId);
      }, 1000);
      const tHide = setTimeout(() => setSequencePopup(null), 1000 + 2000);
      return () => {
        clearTimeout(tShow);
        clearTimeout(tHide);
      };
    } else if (phase === "playing" || phase === "setup") {
      setShowResultOverlay(false);
    }
  }, [game]);

  const participants = players
    .filter((p) => p.role === "participant")
    .map((p) => ({ uid: p.uid, seat: p.seat ?? 0, teamId: (p.teamId ?? "A") as TeamId }));

  const gameEnded = game?.phase === "ended";

  /** 시간 초과 시 자동 플레이: 잭 제외 → 가능한 일반 카드 중 하나로 빈 칸 배치, 불가 시 패스 */
  const handleTurnTimeout = useCallback(async () => {
    if (!game || !hand || !me || gameEnded || txPending) return;
    const chipsByCell = game.chipsByCell ?? {};
    const cardIds = hand.cardIds ?? [];

    const nonJackCards = cardIds.filter((id) => !isJack(id));
    const playableCards = nonJackCards.filter((id) => !isDeadCard(id, chipsByCell));

    let action: GameAction;
    if (playableCards.length === 0) {
      action = { type: "TURN_PASS", expectedVersion: game.version };
    } else {
      const cardId = playableCards[0];
      const cells = getPlayableCells(cardId, chipsByCell);
      const targetCellId = cells.length > 0 ? cells[0] : 0; // 방어 코드: 셀 없으면 사용하지 않음(아래에서 패스로 떨어지지 않음)
      if (cells.length === 0) {
        action = { type: "TURN_PASS", expectedVersion: game.version };
      } else {
        action = {
          type: "TURN_PLAY_NORMAL",
          expectedVersion: game.version,
          cardId,
          targetCellId,
        };
      }
    }

    setSelectedCard(null);
    setTxError(null);
    setTxPending(true);
    try {
      await submitTurnAction(roomId, action, participants);
    } catch (err) {
      const msg = (err as Error).message ?? "알 수 없는 오류";
      if (msg === "VERSION_MISMATCH") {
        setTxError("시간 초과 처리 중 상태가 바뀌었습니다. 다시 선택해 주세요.");
      } else {
        setTxError(msg);
      }
    } finally {
      setTxPending(false);
    }
  }, [game, hand, me, gameEnded, txPending, roomId, participants]);

  useEffect(() => {
    runTimeoutAutoPlayRef.current = handleTurnTimeout;
    return () => {
      runTimeoutAutoPlayRef.current = null;
    };
  }, [handleTurnTimeout]);

  const handleSelectCard = useCallback(
    (cardId: string) => {
      if (gameEnded) return;
      setSelectedCard((prev) => (prev === cardId ? null : cardId));
      setTxError(null);
    },
    [gameEnded],
  );

  const handleCellClick = useCallback(
    async (cellId: number) => {
      if (gameEnded || !selectedCard || !isMyTurn || !game || txPending) return;

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
    [gameEnded, selectedCard, isMyTurn, game, txPending, roomId, participants],
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
    <main className="h-dvh overflow-visible bg-dq-charcoalDeep text-dq-white flex flex-col">
      {/* 시퀀스 완성 팝업 (5개 칩 라인 달성 시) */}
      {sequencePopup && <SequenceCompletePopup teamId={sequencePopup} />}

      {/* 승리/패배 결과창 (시퀀스 팝업 1초 후 표시) */}
      {game?.phase === "ended" && game.winner && showResultOverlay && (
        <EndedOverlay
          game={game}
          myTeamId={me?.teamId}
          onGoHome={handleGoToLobby}
          onClose={() => setShowResultOverlay(false)}
        />
      )}

      {/* ── 상단 상태 표시줄 ──────────────────────────────────────── */}
      <header className="shrink-0 px-3 lg:px-4 py-1 lg:py-3 bg-dq-charcoal border-b border-white/10 flex items-center justify-between gap-2 lg:gap-3">
        <div className="flex items-center gap-1.5 lg:gap-2">
          {gameEnded ? (
            <button
              type="button"
              onClick={handleGoToLobby}
              className="px-2.5 py-1 lg:px-3 lg:py-1.5 rounded-lg lg:rounded-xl text-xs lg:text-sm font-bold bg-white/10 text-dq-white border border-white/20 hover:bg-white/20 transition-colors"
            >
              로비로
            </button>
          ) : (
            <>
              <span className="text-[10px] lg:text-xs text-dq-white/50">턴</span>
              <span className="font-mono font-bold text-dq-white text-xs lg:text-sm">
                {game?.turnNumber ?? "-"}
              </span>
              {isMyTurn && (
                <span className="px-1.5 py-0.5 lg:px-2 lg:py-0.5 rounded-full text-[9px] lg:text-[10px] font-bold bg-amber-400/20 text-amber-400 border border-amber-400/30">
                  내 차례
                </span>
              )}
              {turnSecondsLeft !== null && (
                <span
                  className={[
                    "font-mono font-bold text-xs lg:text-sm tabular-nums",
                    turnSecondsLeft <= TURN_WARNING_AT
                      ? "text-dq-redLight animate-timer-warning"
                      : "text-dq-white/90",
                  ].join(" ")}
                  aria-label={`남은 시간 ${turnSecondsLeft}초`}
                >
                  {turnSecondsLeft}초
                </span>
              )}
            </>
          )}
        </div>
        <div className="flex items-center gap-2 lg:gap-3">
          <div className="flex items-center gap-1 lg:gap-1.5 lg:hidden">
            <span className="text-[10px] lg:text-xs text-dq-white/50">덱</span>
            <span className="font-mono text-xs lg:text-sm text-dq-white">
              {game?.deckMeta?.drawLeft ?? "-"}
            </span>
          </div>
          <div className="flex gap-2 lg:gap-3 text-[10px] lg:text-xs">
            <span className="text-dq-redLight font-bold">A {game?.scoreByTeam?.A ?? 0}</span>
            <span className="text-dq-blueLight font-bold">B {game?.scoreByTeam?.B ?? 0}</span>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* 데스크톱 레이아웃 (lg+): 3열 그리드                       */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="hidden lg:grid flex-1 grid-cols-[300px_minmax(0,1fr)_360px] gap-6 p-6 overflow-visible min-h-0">
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
                cellClickable={isMyTurn}
                onCellClick={handleCellClick}
              />
            </div>
          </div>
        </section>

        {/* 우측: 덱 + 손패 + 액션바 (overflow-visible로 손패 카드 확대 시 잘림 방지) */}
        <aside className="flex flex-col gap-6 overflow-visible">
          <DeckVisual drawLeft={game?.deckMeta?.drawLeft} />
          <HandSection
            hand={hand}
            game={game}
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
            gameEnded={gameEnded}
          />
        </aside>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* 모바일 레이아웃 (기본): 수직 스택                         */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col gap-2 px-4 pt-2 overflow-visible lg:hidden min-h-0">
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
              cellClickable={isMyTurn}
              onCellClick={handleCellClick}
            />
          </div>
        </section>

        {/* shrink-0: 손패는 고정 높이, overflow-visible로 선택 시 카드 확대가 잘리지 않도록 */}
        <div className="shrink-0 overflow-visible">
          <HandSection
            hand={hand}
            game={game}
            me={me}
            selectedCard={selectedCard}
            onSelectCard={handleSelectCard}
            layout="mobile"
          />
        </div>
      </div>

      {/* 모바일 하단 고정 액션바 */}
      <div
        className="shrink-0 px-4 py-2 bg-dq-charcoal border-t border-white/10 lg:hidden"
        style={{ paddingBottom: "calc(8px + env(safe-area-inset-bottom))" }}
      >
        <ActionBar
          isMyTurn={isMyTurn}
          selectedCard={selectedCard}
          txPending={txPending}
          txError={txError}
          onClearError={() => setTxError(null)}
          gameEnded={gameEnded}
        />
      </div>
    </main>
  );
}
