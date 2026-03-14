"use client";

import { useEffect, useLayoutEffect, useState, useRef, useCallback, memo } from "react";
import { useParams, useRouter } from "next/navigation";
import { ensureAnonAuth } from "@/features/auth/ensureAnonAuth";
import { subscribeToRoom, rejoinRoomAfterGameEnd, sendReaction } from "@/features/room/roomApi";
import { subscribeToHand, submitTurnAction, submitBotTurnAction, getBotHand } from "@/features/game/gameApi";
import { decideBotAction } from "@/domain/bot/botDecision";
import { cardImageUrl, cardAltText } from "@/shared/lib/cardImage";
import { sortParticipantsRedBlue } from "@/shared/lib/players";
import { isDeadCard, getPlayableCells, getCardCells } from "@/domain/rules/deadCard";
import { isTwoEyedJack, isOneEyedJack, isJack } from "@/domain/rules/jacks";
import { getHighlightForCard } from "@/domain/rules/highlight";
import boardLayout from "@/domain/board/board-layout.v1.json";
import type { RoomDoc, RoomPlayerDoc, PublicGameState, TeamId, RoomReaction } from "@/features/room/types";
import type { PrivateHandDoc, GameAction } from "@/features/game/types";
import { collection, getDocs } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/client";

const BOARD_LAYOUT = boardLayout as string[];

/** 턴 제한 시간(초) */
const TURN_SECONDS = 30;
/** 임박 경고 시작 초(이하일 때 빨간색 + 애니메이션) */
const TURN_WARNING_AT = 5;

/** 채팅 리액션: 미리 정의된 메시지 목록 */
const REACTION_MESSAGES = ["😮", "😜", "😴", "❓", "훗", "최악", "썩을", "아싸", "쓰레기같은", "굿굿"] as const;
/** 리액션 쿨타임(ms) */
const REACTION_COOLDOWN_MS = 5000;
/** 말풍선 표시 유지 시간(ms) */
const REACTION_DISPLAY_MS = 3500;

/** 손패 카드 픽셀 크기 — 모바일(작게) / 데스크톱(원래 크기). 셀·버튼·이미지 동일 적용 */
const HAND_CARD_MOBILE = { width: 48, height: 69 };
const HAND_CARD_DESKTOP = { width: 72, height: 104 };

/** 보드 셀용 SVG 이미지 경로 — 벡터라 어떤 셀 크기에도 잘림 없음 */
function boardCardImageUrl(cardId: string): string {
  return `/cards/svg/${cardId}.svg`;
}

// ─── 말풍선 ──────────────────────────────────────────────────────
function SpeechBubble({
  message,
  /** 모바일: 셀 정중앙에 겹침, 살짝 위로 */
  overlay = false,
}: {
  message: string;
  overlay?: boolean;
}) {
  const bubbleContent = (
    <div
      className={[
        "relative whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-bold",
        "bg-dq-white border border-black/10 text-dq-charcoalDeep shadow-lg",
        "pointer-events-none select-none",
        "animate-speech-bubble-in",
      ].join(" ")}
    >
      {message}
      <span
        className="absolute -bottom-[5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-dq-white border-r border-b border-black/10 rotate-45"
        aria-hidden="true"
      />
    </div>
  );

  if (overlay) {
    return (
      <div
        className="absolute inset-0 flex items-center justify-center z-[50] pointer-events-none"
        aria-hidden
      >
        <div className="-translate-y-8">{bubbleContent}</div>
      </div>
    );
  }

  return (
    <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-[50]">
      {bubbleContent}
    </div>
  );
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
  isLastPlaced,
  chipAnimClass,
}: {
  teamId: TeamId;
  isInSequence: boolean;
  isRemovable?: boolean;
  /** 직전 턴에 놓인 칩 — 칩에만 힌트 링 표시 (모든 플레이어 공통) */
  isLastPlaced?: boolean;
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
      : isLastPlaced
        ? "shadow-[0_0_3px_3px_rgba(0,0,0,0.5)]"
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
  isHint,
  isDimmed,
  isLastPlaced,
  isLastActionCell,
  jackType,
  placedAnim,
  removingTeamId,
  cellClickable,
  /** true면 손패 미선택 상태로, 셀 클릭 시 해당 카드의 두 위치 힌트 표시용(모든 셀 클릭 가능) */
  hintModeActive,
  onClick,
}: {
  cellId: number;
  cardId: string;
  chip?: TeamId;
  isInSequence: boolean;
  isPlayable: boolean;
  isRemovable: boolean;
  /** 이 카드가 대응하지만 이미 점유되어 놓을 수 없는 칸 (인지용, 클릭 불가) */
  isHint: boolean;
  isDimmed: boolean;
  /** 직전 턴에 놓인 칩 → 칩에 그림자 (칩 있을 때만) */
  isLastPlaced?: boolean;
  /** 직전 턴에 액션이 일어난 칸(배치·제거) → 셀 살짝 어둡게 (1-eye 제거된 빈 칸 포함) */
  isLastActionCell?: boolean;
  jackType: "wild" | "remove" | null;
  /** 방금 배치된 칩의 종류 → 배치 애니메이션 선택 */
  placedAnim?: "normal" | "wild";
  /** 방금 제거된 칩 팀 → 유령 칩 제거 애니메이션 렌더링 */
  removingTeamId?: TeamId;
  /** false면 하이라이트만 표시, 클릭 불가(상대 턴 위치 확인용) */
  cellClickable: boolean;
  /** true면 손패 미선택 상태로, 모든 셀 클릭 가능(해당 카드 위치 힌트용) */
  hintModeActive?: boolean;
  onClick: () => void;
}) {
  const interactive = isPlayable || isRemovable;
  const canClick = (interactive || !!hintModeActive) && cellClickable;

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

  // opacity: 무관한 셀 75%, 힌트(이미 칩 있는 카드 대응 칸) 100%, 활성 셀은 brightness로 추가 강조
  const opacityClass = isDimmed ? "opacity-75" : "opacity-100";
  // 활성(playable/removable) 셀은 더 밝게 강조
  const activeBrightness = (isPlayable || isRemovable) ? "brightness-110" : "";

  return (
    <button
      type="button"
      onClick={canClick ? onClick : undefined}
      disabled={!canClick}
      aria-label={cardAltText(cardId)}
      className={[
        "relative overflow-hidden rounded-[2px] select-none transition-opacity duration-150 transition-[filter]",
        canClick ? "cursor-pointer" : "cursor-default",
        opacityClass,
        activeBrightness,
        canClick && isPlayable ? "hover:brightness-125" : "",
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
      {/* 직전 턴 액션 셀(배치·제거) — 셀만 살짝 어둡게 (1-eye 제거된 빈 칸도 표시) */}
      {isLastActionCell && (
        <div className="absolute inset-0 bg-black/25 pointer-events-none rounded-[2px]" aria-hidden />
      )}
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
          isLastPlaced={isLastPlaced}
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
  boardCellHintCellId,
  cellClickable,
  onCellClick,
}: {
  game: PublicGameState | undefined;
  myTeamId: TeamId | undefined;
  selectedCard: string | null;
  /** 손패 미선택 시 보드 셀 클릭으로 선택한 셀(해당 카드의 두 위치 힌트용). null이면 미사용 */
  boardCellHintCellId: number | null;
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
      : boardCellHintCellId != null
        ? (() => {
            const cardId = BOARD_LAYOUT[boardCellHintCellId];
            const cells = getCardCells(cardId);
            if (cells.length === 0) return null; // 잭 등 보드에 2칸이 없는 카드
            return {
              playable: new Set<number>(),
              removable: new Set<number>(),
              hint: new Set<number>(cells),
            };
          })()
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
        const isHint = highlight?.hint.has(idx) ?? false;
        // 카드가 선택됐을 때: 무관한 셀은 살짝 어둡게, 활성 셀은 밝게, hint(이미 칩 있는 칸)는 기존 유지
        const isDimmed = !!highlight && !isPlayable && !isRemovable && !isHint;
        // 직전에 놓인 칩 → 칩에만 그림자
        const isLastPlaced =
          game?.lastPlacedCellId != null && game.lastPlacedCellId === idx;
        // 직전 턴 액션 셀(배치 또는 1-eye 제거) → 셀 살짝 어둡게 (빈 칸도 표시)
        const isLastActionCell =
          game?.lastActionCellId != null && game.lastActionCellId === idx;

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
            isHint={isHint}
            isDimmed={isDimmed}
            isLastPlaced={isLastPlaced}
            isLastActionCell={isLastActionCell}
            jackType={jackType}
            placedAnim={placedAnim}
            removingTeamId={removingTeamId}
            cellClickable={cellClickable}
            hintModeActive={selectedCard === null}
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
  onClick,
  width,
  height,
  isNew,
}: {
  cardId: string;
  selected: boolean;
  onClick?: () => void;
  width: number;
  height: number;
  isNew?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ width, height }}
      className={[
        "relative shrink-0 rounded-lg overflow-hidden select-none transition-all duration-100",
        selected
          ? "border border-amber-400 ring-1 ring-amber-400 scale-105 z-10"
          : "border border-white/20 hover:border-white/50",
        "cursor-pointer active:scale-95",
        isNew ? "animate-card-flip-in" : "",
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
  reactions,
  nowMs,
  onOpenReactionPanel,
  reactionCooldownUntil,
  isSpectator,
  spectatorViewingHandUid,
  onToggleSpectatorHand,
}: {
  players: RoomPlayerDoc[];
  game: PublicGameState | undefined;
  myUid: string | null;
  reactions?: Record<string, RoomReaction>;
  nowMs: number;
  onOpenReactionPanel: () => void;
  reactionCooldownUntil: number;
  isSpectator?: boolean;
  spectatorViewingHandUid?: string | null;
  onToggleSpectatorHand?: (uid: string) => void;
}) {
  const participants = sortParticipantsRedBlue(players);
  return (
    <div className="bg-dq-charcoal border border-white/10 rounded-2xl p-4 flex flex-col gap-3 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-bold tracking-widest text-dq-white/50 uppercase">
          Player List
        </h2>
        <CooldownTriggerButton
          onClick={onOpenReactionPanel}
          cooldownUntil={reactionCooldownUntil}
          nowMs={nowMs}
        />
      </div>
      <div className="flex flex-col gap-2">
        {participants.map((p) => {
          const isCurrentTurn = game?.currentUid === p.uid;
          const isMe = p.uid === myUid;
          const isViewingHand = isSpectator && spectatorViewingHandUid === p.uid;
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
          const reaction = reactions?.[p.uid];
          const activeReactionMsg =
            reaction && nowMs - reaction.sentAt < REACTION_DISPLAY_MS ? reaction.message : null;
          const handleRowClick = isSpectator && onToggleSpectatorHand
            ? () => onToggleSpectatorHand(p.uid)
            : undefined;
          return (
            <div
              key={p.uid}
              role={handleRowClick ? "button" : undefined}
              tabIndex={handleRowClick ? 0 : undefined}
              onClick={handleRowClick}
              onKeyDown={handleRowClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleRowClick(); } } : undefined}
              className={[
                "relative flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all",
                teamBg,
                isCurrentTurn
                  ? "border-amber-400/60 ring-1 ring-amber-400/60"
                  : "border-white/10",
                isSpectator ? "cursor-pointer hover:border-white/30" : "",
                isViewingHand ? "ring-2 ring-dq-redLight/70 border-dq-redLight/50" : "",
              ].join(" ")}
            >
              {/* 말풍선 위치 기준: 아바타+이름 영역의 가로 중앙 */}
              <div className="relative flex items-center gap-3 flex-1 min-w-0">
                {activeReactionMsg && (
                  <SpeechBubble key={reaction!.sentAt} message={activeReactionMsg} />
                )}
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
                    {isViewingHand && (
                      <span
                        className="inline-flex items-center justify-center size-6 rounded-full bg-dq-red/20 text-dq-redLight border border-dq-red/30"
                        title="손패 보기 중"
                        aria-label="손패 보기 중"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-dq-white/90 truncate mt-0.5">{p.nickname}</p>
                </div>
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
  reactions,
  nowMs,
  isSpectator,
  spectatorViewingHandUid,
  onToggleSpectatorHand,
}: {
  players: RoomPlayerDoc[];
  game: PublicGameState | undefined;
  myUid: string | null;
  reactions?: Record<string, RoomReaction>;
  nowMs: number;
  isSpectator?: boolean;
  spectatorViewingHandUid?: string | null;
  onToggleSpectatorHand?: (uid: string) => void;
}) {
  const participants = sortParticipantsRedBlue(players);
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${participants.length}, 1fr)` }}>
      {participants.map((p) => {
        const isCurrentTurn = game?.currentUid === p.uid;
        const isMe = p.uid === myUid;
        const isViewingHand = isSpectator && spectatorViewingHandUid === p.uid;
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
        const reaction = reactions?.[p.uid];
        const activeReactionMsg =
          reaction && nowMs - reaction.sentAt < REACTION_DISPLAY_MS ? reaction.message : null;
        const handleStripClick = isSpectator && onToggleSpectatorHand
          ? () => onToggleSpectatorHand(p.uid)
          : undefined;
        return (
          <div
            key={p.uid}
            role={handleStripClick ? "button" : undefined}
            tabIndex={handleStripClick ? 0 : undefined}
            onClick={handleStripClick}
            onKeyDown={handleStripClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleStripClick(); } } : undefined}
            className={[
              "relative flex flex-col items-center px-2 py-0.5 rounded-xl border min-w-0",
              teamBg,
              isCurrentTurn
                ? "border-amber-400 ring-1 ring-amber-400"
                : "border-white/10",
              isSpectator ? "cursor-pointer hover:border-white/30" : "",
              isViewingHand ? "ring-2 ring-dq-redLight/70 border-dq-redLight/50" : "",
            ].join(" ")}
          >
            {/* 말풍선: 모바일은 셀 정중앙에 겹침, 꼬리 없음 */}
            {activeReactionMsg && (
              <SpeechBubble
                key={reaction!.sentAt}
                message={activeReactionMsg}
                overlay
              />
            )}
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

// ─── 손패 섹션 (참여자만, 관전자일 때는 상위에서 렌더하지 않음) ─────
function HandSection({
  hand,
  game,
  me,
  selectedCard,
  onSelectCard,
  layout,
  spectatorView,
}: {
  hand: PrivateHandDoc | null;
  game: PublicGameState | undefined;
  me: RoomPlayerDoc | undefined;
  selectedCard: string | null;
  onSelectCard: (cardId: string) => void;
  layout: "mobile" | "desktop";
  spectatorView?: { player: RoomPlayerDoc };
}) {
  const prevHandVersionRef = useRef<number | null>(null);
  const [animatingIdx, setAnimatingIdx] = useState<number | null>(null);
  const isReadOnly = !!spectatorView;

  useEffect(() => {
    if (!hand) return;

    if (prevHandVersionRef.current === null) {
      prevHandVersionRef.current = hand.handVersion;
      return;
    }

    if (hand.handVersion > prevHandVersionRef.current) {
      prevHandVersionRef.current = hand.handVersion;
      const lastIdx = hand.cardIds.length - 1;
      setAnimatingIdx(lastIdx);
      const timer = setTimeout(() => setAnimatingIdx(null), 950);
      return () => clearTimeout(timer);
    }
  }, [hand]);

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
            {spectatorView ? `${spectatorView.player.nickname}의 손패` : "My Card"}
          </h2>
          {me && !spectatorView && (
            <div className="flex items-center gap-1.5">
              <TeamBadge teamId={me.teamId} />
              <span className="text-xs text-dq-white/50">{me.nickname}</span>
            </div>
          )}
          {spectatorView && (
            <div className="flex items-center gap-1.5">
              <TeamBadge teamId={spectatorView.player.teamId} />
              <span className="text-xs text-dq-white/50">{spectatorView.player.nickname}</span>
            </div>
          )}
        </div>
      )}
      {layout === "mobile" && spectatorView && (
        <p className="text-[10px] font-bold tracking-widest text-dq-white/50 uppercase">
          {spectatorView.player.nickname}의 손패
        </p>
      )}
      {hand ? (
        <div className="grid overflow-visible justify-center lg:justify-start" style={gridStyle}>
          {hand.cardIds.map((cardId, idx) => (
            <CardTile
              key={`${cardId}-${idx}`}
              cardId={cardId}
              selected={!isReadOnly && selectedCard === cardId}
              onClick={isReadOnly ? undefined : () => onSelectCard(cardId)}
              width={cardSize.width}
              height={cardSize.height}
              isNew={idx === animatingIdx}
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
  isSpectator,
}: {
  isMyTurn: boolean;
  selectedCard: string | null;
  txPending: boolean;
  txError: string | null;
  onClearError: () => void;
  gameEnded?: boolean;
  isSpectator?: boolean;
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
  if (isSpectator || !isMyTurn) {
    return (
      <div className={`w-full ${barHeight} rounded-lg lg:rounded-xl bg-dq-black border border-white/10 flex items-center justify-center`}>
        <span className={`text-dq-white/40 ${textSize}`}>
          {isSpectator ? "관전 중" : "상대 턴 대기 중…"}
        </span>
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

// ─── 리액션 패널 (채팅 선택 토스트) ─────────────────────────────
function ReactionPanel({
  visible,
  onClose,
  onSelect,
  cooldownUntil,
  nowMs,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (msg: string) => void;
  cooldownUntil: number;
  nowMs: number;
}) {
  const isOnCooldown = nowMs < cooldownUntil;
  const cooldownProgress = isOnCooldown
    ? Math.min(100, ((nowMs - (cooldownUntil - REACTION_COOLDOWN_MS)) / REACTION_COOLDOWN_MS) * 100)
    : 100;

  if (!visible) return null;

  return (
    <>
      {/* 배경 오버레이 (탭으로 닫기) */}
      <div
        className="fixed inset-0 z-[40]"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* 패널 본체 */}
      <div
        className={[
          "fixed bottom-[72px] left-0 right-0 z-[45] px-4",
          "animate-reaction-panel-up",
        ].join(" ")}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="bg-dq-charcoal border border-white/15 rounded-2xl p-4 shadow-2xl max-w-sm mx-auto">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold tracking-widest text-dq-white/50 uppercase">
              반응
            </span>
            {isOnCooldown && (
              <span className="text-[10px] text-dq-white/40">
                {Math.ceil((cooldownUntil - nowMs) / 1000)}초 후 사용 가능
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {REACTION_MESSAGES.map((msg) => (
              <button
                key={msg}
                type="button"
                disabled={isOnCooldown}
                onClick={() => onSelect(msg)}
                className={[
                  "h-12 px-4 rounded-xl text-sm font-bold border transition-all whitespace-nowrap",
                  isOnCooldown
                    ? "bg-white/5 text-dq-white/30 border-white/5 cursor-not-allowed"
                    : "bg-white/10 text-dq-white border-white/15 active:scale-95 hover:bg-white/20",
                ].join(" ")}
              >
                {msg}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── 쿨타임 트리거 버튼 (원형 진행 표시기 포함) ──────────────────
function CooldownTriggerButton({
  onClick,
  cooldownUntil,
  nowMs,
}: {
  onClick: () => void;
  cooldownUntil: number;
  nowMs: number;
}) {
  const isOnCooldown = nowMs < cooldownUntil;
  const progress = isOnCooldown
    ? Math.min(100, ((nowMs - (cooldownUntil - REACTION_COOLDOWN_MS)) / REACTION_COOLDOWN_MS) * 100)
    : 100;

  const radius = 13;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress / 100);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="채팅 반응"
      className={[
        "relative shrink-0 size-7 rounded-xl flex items-center justify-center",
        "bg-white/10 border border-white/15 transition-all",
        isOnCooldown ? "opacity-60" : "hover:bg-white/20 active:scale-95",
      ].join(" ")}
    >
      {/* 쿨타임 원형 진행 표시기 */}
      {isOnCooldown && (
        <svg
          className="absolute inset-0 w-full h-full -rotate-90"
          viewBox="0 0 40 40"
          aria-hidden="true"
        >
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="2.5"
          />
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke="#D61F2C"
            strokeWidth="2.5"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.1s linear" }}
          />
        </svg>
      )}
      <span className="text-base select-none" aria-hidden="true">💬</span>
    </button>
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
  participantsWithNames,
  onGoHome,
  onClose,
}: {
  game: PublicGameState;
  myTeamId: TeamId | undefined;
  participantsWithNames: Array<{ teamId: TeamId; nickname: string }>;
  onGoHome: () => void;
  onClose: () => void;
}) {
  const winner = game.winner;
  if (!winner) return null;

  const isWinner = winner.teamId === myTeamId;
  const winnerTeamId = winner.teamId;
  const redNames = participantsWithNames
    .filter((p) => p.teamId === "A")
    .map((p) => p.nickname)
    .join(", ");
  const blueNames = participantsWithNames
    .filter((p) => p.teamId === "B")
    .map((p) => p.nickname)
    .join(", ");
  const redScore = game.scoreByTeam?.A ?? 0;
  const blueScore = game.scoreByTeam?.B ?? 0;

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
        <p
          className={[
            "text-3xl font-black tracking-tight",
            isWinner ? "text-dq-green" : "text-dq-white/70",
          ].join(" ")}
        >
          {isWinner ? "승리!" : "패배ㅠ"}
        </p>
        <p className="text-dq-white/60 text-sm -mt-2">게임 종료</p>

        {/* 레드 vs 블루 비교: 팀별 닉네임 + 시퀀스 수 */}
        <div className="w-full flex items-stretch gap-3 sm:gap-4">
          {/* 레드 팀 카드 */}
          <div
            className={[
              "flex-1 min-w-0 flex flex-col rounded-xl overflow-hidden border-2 transition-shadow",
              winnerTeamId === "A"
                ? "bg-dq-red/15 border-dq-red/60 shadow-[0_0_20px_rgba(214,31,44,0.2)_inset_0_1px_0_rgba(255,255,255,0.06)]"
                : "bg-dq-red/10 border-dq-red/40 shadow-[0_0_12px_rgba(214,31,44,0.1)]",
            ].join(" ")}
          >
            <div className="px-3 py-2 border-b border-dq-red/30 bg-dq-red/10">
              <p className="text-dq-redLight font-bold text-sm tracking-wide">
                레드 팀
              </p>
              <p className="text-dq-redLight/90 text-[10px] font-semibold mt-0.5">
                {winnerTeamId === "A" ? "승리" : "패배"}
              </p>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center py-3 px-2 min-h-[52px]">
              {redNames ? (
                <p className="text-dq-white/95 text-xs leading-relaxed break-words text-center">
                  {redNames}
                </p>
              ) : (
                <span className="text-dq-white/40 text-xs">—</span>
              )}
            </div>
            <div className="px-3 py-2 border-t border-dq-red/30 bg-dq-red/10 flex items-center justify-center">
              <span className="text-dq-redLight font-black text-base tabular-nums">
                {redScore}
              </span>
              <span className="text-dq-redLight/80 text-xs font-medium ml-0.5">시퀀스</span>
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-center justify-center">
            <span className="inline-flex size-8 items-center justify-center rounded-full bg-white/10 border border-white/20 text-dq-white/70 text-xs font-black">
              vs
            </span>
          </div>

          {/* 블루 팀 카드 */}
          <div
            className={[
              "flex-1 min-w-0 flex flex-col rounded-xl overflow-hidden border-2 transition-shadow",
              winnerTeamId === "B"
                ? "bg-dq-blue/15 border-dq-blueLight/50 shadow-[0_0_20px_rgba(107,154,232,0.25)_inset_0_1px_0_rgba(255,255,255,0.06)]"
                : "bg-dq-blue/10 border-dq-blue/40 shadow-[0_0_12px_rgba(107,154,232,0.1)]",
            ].join(" ")}
          >
            <div className="px-3 py-2 border-b border-dq-blueLight/30 bg-dq-blue/10">
              <p className="text-dq-blueLight font-bold text-sm tracking-wide">
                블루 팀
              </p>
              <p className="text-dq-blueLight/90 text-[10px] font-semibold mt-0.5">
                {winnerTeamId === "B" ? "승리" : "패배"}
              </p>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center py-3 px-2 min-h-[52px]">
              {blueNames ? (
                <p className="text-dq-white/95 text-xs leading-relaxed break-words text-center">
                  {blueNames}
                </p>
              ) : (
                <span className="text-dq-white/40 text-xs">—</span>
              )}
            </div>
            <div className="px-3 py-2 border-t border-dq-blueLight/30 bg-dq-blue/10 flex items-center justify-center">
              <span className="text-dq-blueLight font-black text-base tabular-nums">
                {blueScore}
              </span>
              <span className="text-dq-blueLight/80 text-xs font-medium ml-0.5">시퀀스</span>
            </div>
          </div>
        </div>

        {isWinner && (
          <p className="text-dq-redLight font-bold text-sm">축하합니다!</p>
        )}
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
  /** 손패 선택 없이 보드 셀을 눌렀을 때 해당 카드의 두 위치 힌트용. 같은 셀 재클릭 시 해제 */
  const [boardCellHintCellId, setBoardCellHintCellId] = useState<number | null>(null);
  const [txPending, setTxPending] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const unsubRoomRef = useRef<(() => void) | null>(null);
  const unsubHandRef = useRef<(() => void) | null>(null);
  const unsubWatchedHandRef = useRef<(() => void) | null>(null);
  const prevSeqCountRef = useRef<number>(0);
  const prevPhaseRef = useRef<string>("setup");
  const hasInitializedSeqRef = useRef(false);
  /** 턴 키: 턴이 바뀌었는지 판별용 */
  const lastTurnKeyRef = useRef<string>("");
  /** 시간 초과 자동 플레이 1회만 실행 방지 */
  const timeoutAutoPlayDoneRef = useRef(false);
  /** 시간 초과 시 호출할 자동 플레이 함수(ref로 interval에서 안전하게 호출) */
  const runTimeoutAutoPlayRef = useRef<(() => void) | null>(null);
  /** 봇 턴 30초 초과 시 호출할 TURN_PASS 함수 */
  const runBotTimeoutRef = useRef<(() => void) | null>(null);
  /** 봇 턴 실행 1회만 방지 */
  const botTurnDoneRef = useRef<string>("");
  /** 게임 종료 후 플레이어 doc이 삭제되어 me가 undefined가 되어도 닉네임·팀을 유지 */
  const frozenNicknameRef = useRef<string>("");
  const frozenTeamIdRef = useRef<TeamId | undefined>(undefined);
  /** 봇 턴 콜백에서 읽을 최신 game/participants/currentPlayer (effect 재실행 시 타이머 취소 방지용) */
  const botTurnContextRef = useRef<{
    game: PublicGameState;
    participants: Array<{ uid: string; seat: number; teamId: TeamId }>;
    currentPlayer: RoomPlayerDoc;
  } | null>(null);

  const [sequencePopup, setSequencePopup] = useState<TeamId | null>(null);
  const [showResultOverlay, setShowResultOverlay] = useState(false);
  /** 남은 턴 시간(초). 내 턴일 때만 갱신, 0이 되면 자동 플레이 */
  const [turnSecondsLeft, setTurnSecondsLeft] = useState<number | null>(null);

  /** 관전자가 손패를 볼 플레이어 uid. null이면 손패 영역 숨김. 같은 플레이어 재클릭 시 null로 토글 */
  const [spectatorViewingHandUid, setSpectatorViewingHandUid] = useState<string | null>(null);
  /** 관전자가 선택한 플레이어의 손패(실시간 구독) */
  const [watchedHand, setWatchedHand] = useState<PrivateHandDoc | null>(null);

  /** 리액션 패널 표시 여부 */
  const [showReactionPanel, setShowReactionPanel] = useState(false);
  /** 리액션 쿨타임 만료 시각(ms). 현재 시각 < cooldownUntil 이면 쿨타임 중 */
  const [reactionCooldownUntil, setReactionCooldownUntil] = useState(0);
  /** 말풍선 렌더링 갱신용 — 500ms 주기로 현재 시각 추적 */
  const [nowMs, setNowMs] = useState(() => Date.now());

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

  /** 게임 종료 후 로비 재입장: 동일 닉네임으로 방 참가 로직으로 재입장. 방이 찼으면 홈으로 */
  const handleGoToLobby = useCallback(async () => {
    const code = room?.roomCode;
    if (!code) { router.push("/"); return; }
    // me가 이미 삭제된 경우를 대비해 frozenNicknameRef 사용
    const nickname = frozenNicknameRef.current?.trim() || players.find((p) => p.uid === uid)?.nickname?.trim() || "Player";
    try {
      const { roomCode } = await rejoinRoomAfterGameEnd(roomId, nickname);
      router.push(`/lobby/${roomCode}`);
    } catch (err) {
      const msg = (err as Error).message;
      if (msg === "방이 찼습니다.") {
        setError(msg);
        router.push("/");
      } else {
        setError(msg);
      }
    }
  }, [room?.roomCode, roomId, router, players, uid]);

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

  // 관전자가 선택한 플레이어 손패 구독 (선택 시에만 구독, 해제 시 정리)
  useEffect(() => {
    if (!spectatorViewingHandUid || !roomId) {
      setWatchedHand(null);
      unsubWatchedHandRef.current?.();
      unsubWatchedHandRef.current = null;
      return;
    }
    unsubWatchedHandRef.current = subscribeToHand(roomId, spectatorViewingHandUid, setWatchedHand);
    return () => {
      unsubWatchedHandRef.current?.();
      unsubWatchedHandRef.current = null;
    };
  }, [roomId, spectatorViewingHandUid]);

  // 말풍선 표시 만료 체크용 — 500ms 주기 인터벌
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  const handleSendReaction = useCallback(
    async (message: string) => {
      if (Date.now() < reactionCooldownUntil) return;
      setReactionCooldownUntil(Date.now() + REACTION_COOLDOWN_MS);
      setShowReactionPanel(false);
      try {
        await sendReaction(roomId, message);
      } catch {
        // 리액션 실패는 무시
      }
    },
    [reactionCooldownUntil, roomId],
  );

  /** 관전자: 플레이어 클릭 시 해당 플레이어 손패 보기 토글(같은 플레이어 재클릭 시 숨김) */
  const handleToggleSpectatorHand = useCallback((uid: string) => {
    setSpectatorViewingHandUid((prev) => (prev === uid ? null : uid));
  }, []);

  const game = room?.game;
  const isMyTurn = !!uid && game?.currentUid === uid;
  const me = players.find((p) => p.uid === uid);
  // me가 삭제되어도 닉네임·팀 유지 (게임 종료 후 플레이어 doc 삭제 대비)
  if (me?.nickname) frozenNicknameRef.current = me.nickname;
  if (me?.teamId) frozenTeamIdRef.current = me.teamId as TeamId;
  const isHost = uid !== null && room?.hostUid === uid;
  const currentPlayer = game ? players.find((p) => p.uid === game.currentUid) : null;
  const isBotTurn = !!currentPlayer?.isBot && game?.phase === "playing";

  const participants = players
    .filter((p) => p.role === "participant")
    .map((p) => ({ uid: p.uid, seat: p.seat ?? 0, teamId: (p.teamId ?? "A") as TeamId }));

  // 봇 턴 콜백에서 사용할 최신 context (매 렌더마다 갱신)
  if (game && currentPlayer?.isBot && game.phase === "playing") {
    botTurnContextRef.current = { game, participants, currentPlayer };
  } else {
    botTurnContextRef.current = null;
  }

  // ── 턴 키 동기화: 턴이 바뀔 때마다 타임아웃 플래그 리셋 ──────────────────
  // 봇 턴(isBotTurn && isHost)도 30초 폴백이 필요하므로 함께 리셋
  useEffect(() => {
    if (!game || game.phase !== "playing") {
      setTurnSecondsLeft(null);
      return;
    }
    const turnKey = `${game.turnNumber}-${game.currentUid}`;
    if (lastTurnKeyRef.current !== turnKey) {
      lastTurnKeyRef.current = turnKey;
      timeoutAutoPlayDoneRef.current = false;
    }
  }, [game?.turnNumber, game?.currentUid, game?.phase]);

  // ── 1초마다 남은 시간 갱신 + 30초 초과 시 자동 패스 ────────────────────
  // 내 턴: 기존 자동 플레이 실행
  // 봇 턴(호스트 클라이언트): 봇이 2~7초 딜레이 중 실패했을 때 폴백으로 TURN_PASS 제출
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

      if (left <= 0 && !timeoutAutoPlayDoneRef.current) {
        if (isMyTurn) {
          timeoutAutoPlayDoneRef.current = true;
          runTimeoutAutoPlayRef.current?.();
        } else if (isBotTurn && isHost) {
          timeoutAutoPlayDoneRef.current = true;
          runBotTimeoutRef.current?.();
        }
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [
    isMyTurn,
    isBotTurn,
    isHost,
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

  /** 봇 턴 30초 초과: 호스트가 봇 대신 TURN_PASS 제출 */
  const handleBotTurnTimeout = useCallback(async () => {
    if (!game || !currentPlayer?.isBot || gameEnded) return;
    const botUid = currentPlayer.uid;
    try {
      await submitBotTurnAction(roomId, botUid, { type: "TURN_PASS", expectedVersion: game.version }, participants);
    } catch {
      // 이미 다른 액션이 제출됐거나 버전 불일치 — 무시
    }
  }, [game, currentPlayer, gameEnded, roomId, participants]);

  useEffect(() => {
    runBotTimeoutRef.current = handleBotTurnTimeout;
    return () => {
      runBotTimeoutRef.current = null;
    };
  }, [handleBotTurnTimeout]);

  // ── 봇 턴 자동 실행 (호스트 클라이언트에서만 동작) ──────────────────────
  // 의존성을 turnKey만 두어, 턴이 바뀔 때만 effect 재실행 → 타이머가 리렌더 시 cleanup으로 취소되지 않음
  const botTurnKey = isBotTurn && game ? `${game.turnNumber}-${game.currentUid}` : null;

  useEffect(() => {
    if (!botTurnKey || !isHost || !roomId) return;
    if (botTurnDoneRef.current === botTurnKey) return;
    botTurnDoneRef.current = botTurnKey;

    const delayMs = 2000 + Math.random() * 5000; // 2~7초

    const timer = setTimeout(async () => {
      const ctx = botTurnContextRef.current;
      if (!ctx || ctx.game.phase !== "playing") return;

      const { game: g, participants: p, currentPlayer: botPlayer } = ctx;
      try {
        const botHand = await getBotHand(roomId, botPlayer.uid);
        if (botHand.length === 0) return;

        const botTeamId = (botPlayer.teamId ?? "A") as TeamId;
        const action = decideBotAction({
          chipsByCell: g.chipsByCell ?? {},
          completedSequences: g.completedSequences ?? [],
          botTeamId,
          hand: botHand,
          oneEyeLockedCell: g.oneEyeLockedCell,
          twoEyeLockedCell: g.twoEyeLockedCell,
          scoreByTeam: g.scoreByTeam ?? { A: 0, B: 0 },
          expectedVersion: g.version,
        });

        await submitBotTurnAction(roomId, botPlayer.uid, action, p);
      } catch (err) {
        const msg = (err as Error).message ?? "봇 오류";
        if (msg !== "VERSION_MISMATCH" && msg !== "봇 차례가 아닙니다.") {
          console.warn("[bot] 턴 실행 실패:", msg);
        }
      }
    }, delayMs);

    return () => clearTimeout(timer);
  }, [botTurnKey, isHost, roomId]);

  const handleSelectCard = useCallback(
    (cardId: string) => {
      if (gameEnded) return;
      setSelectedCard((prev) => {
        const next = prev === cardId ? null : cardId;
        if (next !== null) setBoardCellHintCellId(null); // 손패 카드 선택 시 보드 셀 힌트 해제
        return next;
      });
      setTxError(null);
    },
    [gameEnded],
  );

  const handleCellClick = useCallback(
    async (cellId: number) => {
      // 손패 미선택 시: 해당 보드 셀 카드의 두 위치 힌트 토글
      if (!selectedCard) {
        setBoardCellHintCellId((prev) => (prev === cellId ? null : cellId));
        return;
      }
      if (gameEnded || !isMyTurn || !game || txPending) return;

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
          myTeamId={frozenTeamIdRef.current ?? me?.teamId}
          participantsWithNames={players
            .filter((p) => p.role === "participant")
            .map((p) => ({ teamId: (p.teamId ?? "A") as TeamId, nickname: p.nickname }))}
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
          <PlayerListPanel
            players={players}
            game={game}
            myUid={uid}
            reactions={room?.reactions}
            nowMs={nowMs}
            onOpenReactionPanel={() => setShowReactionPanel(true)}
            reactionCooldownUntil={reactionCooldownUntil}
            isSpectator={me?.role === "spectator"}
            spectatorViewingHandUid={spectatorViewingHandUid}
            onToggleSpectatorHand={handleToggleSpectatorHand}
          />
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
                boardCellHintCellId={boardCellHintCellId}
                cellClickable={selectedCard === null || isMyTurn}
                onCellClick={handleCellClick}
              />
            </div>
          </div>
        </section>

        {/* 우측: 덱 + 손패 + 액션바 (overflow-visible로 손패 카드 확대 시 잘림 방지) */}
        <aside className="flex flex-col gap-6 overflow-visible">
          <DeckVisual drawLeft={game?.deckMeta?.drawLeft} />
          {me?.role !== "spectator" && (
            <HandSection
              hand={hand}
              game={game}
              me={me}
              selectedCard={selectedCard}
              onSelectCard={handleSelectCard}
              layout="desktop"
            />
          )}
          {me?.role === "spectator" && spectatorViewingHandUid && (() => {
            const viewingPlayer = players.find((p) => p.uid === spectatorViewingHandUid);
            return viewingPlayer ? (
              <HandSection
                hand={watchedHand}
                game={game}
                me={undefined}
                selectedCard={null}
                onSelectCard={() => {}}
                layout="desktop"
                spectatorView={{ player: viewingPlayer }}
              />
            ) : null;
          })()}
          <ActionBar
            isMyTurn={isMyTurn}
            selectedCard={selectedCard}
            txPending={txPending}
            txError={txError}
            onClearError={() => setTxError(null)}
            gameEnded={gameEnded}
            isSpectator={me?.role === "spectator"}
          />
        </aside>
      </div>

      {/* ══════════════════════════════════════════════════════════ */}
      {/* 모바일 레이아웃 (기본): 수직 스택                         */}
      {/* ══════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col gap-2 px-4 pt-2 overflow-visible lg:hidden min-h-0">
        {/* shrink-0: 플레이어 스트립은 고정 높이 */}
        {/* 스와이프 업으로 리액션 패널 열기 */}
        <div
          className="shrink-0"
          onTouchStart={(e) => {
            const t = e.touches[0];
            (e.currentTarget as HTMLDivElement).dataset.touchStartY = String(t.clientY);
          }}
          onTouchEnd={(e) => {
            const startY = Number((e.currentTarget as HTMLDivElement).dataset.touchStartY ?? 0);
            const endY = e.changedTouches[0].clientY;
            if (startY - endY > 30 && me?.role !== "spectator") {
              setShowReactionPanel(true);
            }
          }}
        >
          <PlayerStrip
            players={players}
            game={game}
            myUid={uid}
            reactions={room?.reactions}
            nowMs={nowMs}
            isSpectator={me?.role === "spectator"}
            spectatorViewingHandUid={spectatorViewingHandUid}
            onToggleSpectatorHand={handleToggleSpectatorHand}
          />
        </div>

        {/* 보드: 남은 공간 전체를 채움 */}
        <section className="flex-1 min-h-0 overflow-hidden flex items-center justify-center">
          <div className="aspect-square h-full max-w-full">
            <GameBoard
              game={game}
              myTeamId={me?.teamId}
              selectedCard={selectedCard}
              boardCellHintCellId={boardCellHintCellId}
              cellClickable={selectedCard === null || isMyTurn}
              onCellClick={handleCellClick}
            />
          </div>
        </section>

        {/* shrink-0: 손패는 고정 높이, overflow-visible로 선택 시 카드 확대가 잘리지 않도록 */}
        {me?.role !== "spectator" && (
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
        )}
        {me?.role === "spectator" && spectatorViewingHandUid && (() => {
          const viewingPlayer = players.find((p) => p.uid === spectatorViewingHandUid);
          return viewingPlayer ? (
            <div className="shrink-0 overflow-visible">
              <HandSection
                hand={watchedHand}
                game={game}
                me={undefined}
                selectedCard={null}
                onSelectCard={() => {}}
                layout="mobile"
                spectatorView={{ player: viewingPlayer }}
              />
            </div>
          ) : null;
        })()}
      </div>

      {/* 모바일 하단 고정 액션바 */}
      <div
        className="shrink-0 px-4 py-2 bg-dq-charcoal border-t border-white/10 lg:hidden"
        style={{ paddingBottom: "calc(8px + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-2">
          {/* 리액션 트리거 버튼 (관전자 제외) */}
          {me?.role !== "spectator" && (
            <CooldownTriggerButton
              onClick={() => setShowReactionPanel(true)}
              cooldownUntil={reactionCooldownUntil}
              nowMs={nowMs}
            />
          )}
          <div className="flex-1">
            <ActionBar
              isMyTurn={isMyTurn}
              selectedCard={selectedCard}
              txPending={txPending}
              txError={txError}
              onClearError={() => setTxError(null)}
              gameEnded={gameEnded}
              isSpectator={me?.role === "spectator"}
            />
          </div>
        </div>
      </div>

      {/* 리액션 패널 (모바일 + 데스크톱 공용) */}
      <ReactionPanel
        visible={showReactionPanel}
        onClose={() => setShowReactionPanel(false)}
        onSelect={handleSendReaction}
        cooldownUntil={reactionCooldownUntil}
        nowMs={nowMs}
      />
    </main>
  );
}
