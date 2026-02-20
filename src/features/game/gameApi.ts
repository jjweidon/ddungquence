import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreDb, getFirebaseAuth } from "@/lib/firebase/client";
import { createShuffledDeck } from "@/domain/cards/deck";
import { detectNewSequences } from "@/domain/rules/sequenceDetect";
import type { RoomPlayerDoc, PublicGameState, TeamId } from "@/features/room/types";
import type { PrivateHandDoc, PrivateDealerDoc, GameAction } from "./types";

/** 플레이어 수에 따른 초기 손패 장수 */
function handSize(playerCount: number): number {
  return 6;
}

/**
 * 게임 시작: host만 호출 가능.
 *
 * 1. 덱 셔플 → privateDealer/deck 저장
 * 2. 각 플레이어 privateHands/{uid} 딜링
 * 3. rooms/{roomId} status="playing" + game 초기 상태 업데이트
 *
 * 모든 쓰기는 WriteBatch로 원자적으로 처리.
 */
export async function startGame(roomId: string): Promise<void> {
  const db = getFirestoreDb();
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("로그인이 필요합니다.");

  // ── 방 상태 확인 ─────────────────────────────────────────────
  const roomRef = doc(db, "rooms", roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) throw new Error("방을 찾을 수 없습니다.");

  const roomData = roomSnap.data();
  if (roomData.hostUid !== uid) throw new Error("호스트만 게임을 시작할 수 있습니다.");
  if (roomData.status !== "lobby") throw new Error("이미 게임이 시작됐습니다.");

  // ── 참여자 목록 조회 ──────────────────────────────────────────
  const playersSnap = await getDocs(collection(db, "rooms", roomId, "players"));
  const participants = playersSnap.docs
    .map((d) => d.data() as RoomPlayerDoc)
    .filter((p) => p.role === "participant");

  if (participants.length < 2) throw new Error("최소 2명이 있어야 게임을 시작할 수 있습니다.");

  // 플레이 순서: 팀 내 readyAt 기준(가장 최근 준비 시점이 빠른 사람이 앞) → 레드-블루 인터리브
  const byReadyAtThenSeat = (a: RoomPlayerDoc, b: RoomPlayerDoc) => {
    const ta = a.readyAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
    const tb = b.readyAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb;
    return (a.seat ?? 999) - (b.seat ?? 999);
  };
  const reds = participants.filter((p) => p.teamId === "A").sort(byReadyAtThenSeat);
  const blues = participants.filter((p) => p.teamId === "B").sort(byReadyAtThenSeat);
  const orderedParticipants: RoomPlayerDoc[] = [];
  const maxTeam = Math.max(reds.length, blues.length);
  for (let i = 0; i < maxTeam; i++) {
    if (reds[i]) orderedParticipants.push(reds[i]);
    if (blues[i]) orderedParticipants.push(blues[i]);
  }
  // 게임 순서에 따라 seat 0,1,2,... 재배정
  const seatByUid: Record<string, number> = {};
  orderedParticipants.forEach((p, idx) => {
    seatByUid[p.uid] = idx;
  });
  const firstPlayer = orderedParticipants[0] ?? participants[0];
  const firstSeat = seatByUid[firstPlayer.uid] ?? 0;

  // ── 덱 생성 및 딜링 ──────────────────────────────────────────
  const drawPile = createShuffledDeck();
  const size = handSize(participants.length);

  const hands: Record<string, string[]> = {};
  for (const player of participants) {
    hands[player.uid] = drawPile.splice(0, size);
  }

  // ── Batch 쓰기 ───────────────────────────────────────────────
  const batch = writeBatch(db);

  // privateDealer/deck
  const dealerRef = doc(db, "rooms", roomId, "privateDealer", "deck");
  batch.set(dealerRef, {
    dealerUid: uid,
    drawPile,
    discardPile: [],
    deckVersion: 1,
  } satisfies PrivateDealerDoc);

  // privateHands/{uid}
  for (const player of participants) {
    const handRef = doc(db, "rooms", roomId, "privateHands", player.uid);
    batch.set(handRef, {
      uid: player.uid,
      cardIds: hands[player.uid],
      handVersion: 1,
      updatedAt: serverTimestamp(),
    } as PrivateHandDoc);
  }

  // 각 참여자 seat를 게임 순서대로 갱신
  const playersRef = collection(db, "rooms", roomId, "players");
  for (const p of orderedParticipants) {
    const newSeat = seatByUid[p.uid] ?? 0;
    batch.update(doc(playersRef, p.uid), { seat: newSeat });
  }

  // rooms/{roomId}: status + game 초기 상태
  const initialDiscardBySeat: Record<string, null> = {};
  for (const uid of Object.keys(seatByUid)) {
    initialDiscardBySeat[String(seatByUid[uid])] = null;
  }

  batch.update(roomRef, {
    status: "playing",
    updatedAt: serverTimestamp(),
    game: {
      version: 1,
      phase: "playing",
      turnNumber: 1,
      currentUid: firstPlayer.uid,
      currentSeat: firstSeat,
      chipsByCell: {},
      completedSequences: [],
      discardTopBySeat: initialDiscardBySeat,
      scoreByTeam: { A: 0, B: 0 },
      deckMeta: { drawLeft: drawPile.length, reshuffles: 0 },
    },
  });

  await batch.commit();
}

/**
 * 레드(A)-블루(B) 인터리브 순서로 플레이어 목록을 정렬한다.
 * UI의 sortParticipantsRedBlue와 동일한 로직 — 게임 순서와 표시 순서를 일치시키기 위함.
 */
function sortPlayersRedBlue<T extends { uid: string; seat: number; teamId: TeamId }>(
  participants: T[],
): T[] {
  const bySeat = (a: T, b: T) => a.seat - b.seat;
  const reds = participants.filter((p) => p.teamId === "A").sort(bySeat);
  const blues = participants.filter((p) => p.teamId === "B").sort(bySeat);
  const ordered: T[] = [];
  const max = Math.max(reds.length, blues.length);
  for (let i = 0; i < max; i++) {
    if (reds[i]) ordered.push(reds[i]);
    if (blues[i]) ordered.push(blues[i]);
  }
  return ordered;
}

// ─── 참여자 기준 다음 플레이어 ─────────────────────────────────────────
function getNextPlayer(
  participants: Array<{ uid: string; seat: number; teamId: TeamId }>,
  currentUid: string,
): { uid: string; seat: number } {
  const ordered = sortPlayersRedBlue(participants);
  const idx = ordered.findIndex((p) => p.uid === currentUid);
  return ordered[(idx + 1) % ordered.length];
}

/**
 * 턴 액션 제출 (Firestore Transaction).
 *
 * Phase 1: rooms/{roomId} — 공개 게임 상태 업데이트(칩/턴/시퀀스/승리 판정)
 * Phase 2: privateDealer/deck + privateHands/{uid} — 사용 카드 제거 + 드로우
 *
 * ※ 보안 규칙: privateDealer/deck 는 현재 turnPlayer도 read/write 허용 필요.
 */
export async function submitTurnAction(
  roomId: string,
  action: GameAction,
  participants: Array<{ uid: string; seat: number; teamId: TeamId }>,
): Promise<void> {
  const db = getFirestoreDb();
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("로그인이 필요합니다.");

  const roomRef = doc(db, "rooms", roomId);
  const deckRef = doc(db, "rooms", roomId, "privateDealer", "deck");
  const handRef = doc(db, "rooms", roomId, "privateHands", uid);

  const me = participants.find((p) => p.uid === uid);
  if (!me) throw new Error("참여자 목록에서 본인을 찾을 수 없습니다.");

  // ── Phase 1: 공개 상태 트랜잭션 ────────────────────────────────────
  await runTransaction(db, async (tx) => {
    const roomSnap = await tx.get(roomRef);
    if (!roomSnap.exists()) throw new Error("방을 찾을 수 없습니다.");

    const roomData = roomSnap.data();
    const game = roomData.game as PublicGameState;

    if (game.phase !== "playing") throw new Error("게임이 진행 중이 아닙니다.");
    if (game.currentUid !== uid) throw new Error("내 차례가 아닙니다.");
    if (game.version !== action.expectedVersion) {
      throw new Error("VERSION_MISMATCH");
    }

    // 턴 패스(시간 초과 등): 카드 사용·드로우 없이 다음 플레이어로만 넘김
    if (action.type === "TURN_PASS") {
      const nextPlayer = getNextPlayer(participants, uid);
      tx.update(roomRef, {
        "game.version": game.version + 1,
        "game.turnNumber": game.turnNumber + 1,
        "game.currentUid": nextPlayer.uid,
        "game.currentSeat": nextPlayer.seat,
        "game.lastAction": { uid, type: "TURN_PASS", at: serverTimestamp() },
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const newChipsByCell: Record<string, TeamId> = { ...game.chipsByCell };

    if (action.type === "TURN_PLAY_NORMAL" || action.type === "TURN_PLAY_JACK_WILD") {
      const { targetCellId } = action;
      if (newChipsByCell[String(targetCellId)]) {
        throw new Error("해당 칸은 이미 점유되어 있습니다.");
      }
      newChipsByCell[String(targetCellId)] = me.teamId;
    } else if (action.type === "TURN_PLAY_JACK_REMOVE") {
      const { removeCellId } = action;
      const cellChip = newChipsByCell[String(removeCellId)];
      if (!cellChip) throw new Error("해당 칸에 칩이 없습니다.");
      const sequenceCells = new Set(game.completedSequences.flatMap((s) => s.cells));
      if (sequenceCells.has(removeCellId)) {
        throw new Error("완성된 시퀀스의 칩은 제거할 수 없습니다.");
      }
      delete newChipsByCell[String(removeCellId)];
    }

    // 시퀀스 탐지
    const existingSeqs = game.completedSequences.map((s) => ({
      teamId: s.teamId,
      cells: s.cells,
      createdTurn: s.createdTurn,
    }));
    const newSeqs = detectNewSequences(newChipsByCell, existingSeqs);
    const allSeqs = [
      ...existingSeqs,
      ...newSeqs.map((s) => ({ ...s, createdTurn: game.turnNumber })),
    ];

    // 점수 집계
    const scoreByTeam: Record<TeamId, number> = { A: 0, B: 0 };
    for (const s of allSeqs) {
      scoreByTeam[s.teamId] = (scoreByTeam[s.teamId] ?? 0) + 1;
    }

    // 승리 판정 (2시퀀스)
    const winnerTeam =
      scoreByTeam.A >= 2 ? "A" : scoreByTeam.B >= 2 ? "B" : null;
    const isEnded = winnerTeam !== null;

    // 다음 플레이어 (레드-블루 인터리브 순서)
    const nextPlayer = getNextPlayer(participants, uid);

    // discardTopBySeat 업데이트 (TURN_PASS는 위에서 return됨)
    const newDiscardTopBySeat: Record<string, string | null> = {
      ...game.discardTopBySeat,
      [String(me.seat)]: action.cardId,
    };

    // oneEyeLockedCell
    const oneEyeLockedCell =
      action.type === "TURN_PLAY_JACK_REMOVE" ? action.removeCellId : null;

    // deckMeta: 드로우 1장 시 drawLeft 감소 (Phase 2에서 실제 덱 업데이트)
    const currentDrawLeft = game.deckMeta?.drawLeft ?? 0;
    const newDeckMeta = {
      drawLeft: Math.max(0, currentDrawLeft - 1),
      reshuffles: game.deckMeta?.reshuffles ?? 0,
    };

    // lastAction은 dot-notation으로 따로 기록 (serverTimestamp 사용)
    const gameUpdate = {
      "game.version": game.version + 1,
      "game.phase": isEnded ? "ended" : "playing",
      "game.turnNumber": game.turnNumber + 1,
      "game.currentUid": nextPlayer.uid,
      "game.currentSeat": nextPlayer.seat,
      "game.chipsByCell": newChipsByCell,
      "game.completedSequences": allSeqs,
      "game.discardTopBySeat": newDiscardTopBySeat,
      "game.scoreByTeam": scoreByTeam,
      "game.deckMeta": newDeckMeta,
      "game.oneEyeLockedCell": oneEyeLockedCell ?? null,
      "game.lastAction": { uid, type: action.type, at: serverTimestamp() },
      ...(winnerTeam
        ? { "game.winner": { teamId: winnerTeam, atTurn: game.turnNumber } }
        : {}),
      status: isEnded ? "ended" : "playing",
      updatedAt: serverTimestamp(),
    };

    tx.update(roomRef, gameUpdate);
  });

  // ── Phase 2: 손패 + 덱 트랜잭션 (TURN_PASS는 카드 사용/드로우 없음) ───
  if (action.type === "TURN_PASS") return;

  try {
    await runTransaction(db, async (tx) => {
      const deckSnap = await tx.get(deckRef);
      const handSnap = await tx.get(handRef);

      if (!deckSnap.exists() || !handSnap.exists()) return;

      const deck = deckSnap.data() as PrivateDealerDoc;
      const hand = handSnap.data() as PrivateHandDoc;

      // 사용한 카드 제거 (첫 번째 일치만)
      const newCardIds = [...hand.cardIds];
      const removeIdx = newCardIds.indexOf(action.cardId);
      if (removeIdx !== -1) newCardIds.splice(removeIdx, 1);

      // 드로우
      const newDrawPile = [...deck.drawPile];
      const drawnCard = newDrawPile.shift();
      if (drawnCard) newCardIds.push(drawnCard);

      tx.update(deckRef, {
        drawPile: newDrawPile,
        deckVersion: deck.deckVersion + 1,
      });
      tx.update(handRef, {
        cardIds: newCardIds,
        handVersion: hand.handVersion + 1,
        updatedAt: serverTimestamp(),
      });
    });
  } catch {
    // Phase 2 실패 시 로그만 남기고 Phase 1은 유지 (손패 불일치는 재시도로 복구)
    console.warn("[submitTurnAction] 손패/덱 업데이트 실패. 재시도 필요.");
  }
}

/**
 * 본인 손패(privateHands/{uid})를 실시간 구독.
 * Firestore 보안 규칙: uid만 read 가능.
 */
export function subscribeToHand(
  roomId: string,
  uid: string,
  onUpdate: (hand: PrivateHandDoc | null) => void,
): Unsubscribe {
  const db = getFirestoreDb();
  const handRef = doc(db, "rooms", roomId, "privateHands", uid);
  return onSnapshot(handRef, (snap) => {
    onUpdate(snap.exists() ? (snap.data() as PrivateHandDoc) : null);
  });
}
