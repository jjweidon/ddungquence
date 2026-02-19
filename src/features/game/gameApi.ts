import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreDb, getFirebaseAuth } from "@/lib/firebase/client";
import { createShuffledDeck } from "@/domain/cards/deck";
import type { RoomPlayerDoc } from "@/features/room/types";
import type { PrivateHandDoc, PrivateDealerDoc } from "./types";

/** 플레이어 수에 따른 초기 손패 장수 */
function handSize(playerCount: number): number {
  return playerCount === 2 ? 7 : 6;
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
    .filter((p) => p.role === "participant")
    .sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));

  if (participants.length < 2) throw new Error("최소 2명이 있어야 게임을 시작할 수 있습니다.");

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

  // rooms/{roomId}: status + game 초기 상태
  const firstPlayer = participants[0];
  const initialDiscardBySeat: Record<string, null> = {};
  for (const p of participants) {
    initialDiscardBySeat[String(p.seat ?? 0)] = null;
  }

  batch.update(roomRef, {
    status: "playing",
    updatedAt: serverTimestamp(),
    game: {
      version: 1,
      phase: "playing",
      turnNumber: 1,
      currentUid: firstPlayer.uid,
      currentSeat: firstPlayer.seat ?? 0,
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
