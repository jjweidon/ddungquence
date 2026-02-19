import type { Timestamp } from "firebase/firestore";
import type { TeamId } from "@/features/room/types";

// ─── 완성된 시퀀스 ────────────────────────────────────────────────
export interface CompletedSequenceDoc {
  teamId: TeamId;
  cells: number[]; // 길이 5
  createdTurn: number;
}

// ─── 비공개: 플레이어 손패 (rooms/{roomId}/privateHands/{uid}) ────
export interface PrivateHandDoc {
  uid: string;
  cardIds: string[];
  handVersion: number;
  updatedAt: Timestamp;
}

// ─── 비공개: 딜러 덱 (rooms/{roomId}/privateDealer/deck) ─────────
export interface PrivateDealerDoc {
  dealerUid: string;
  drawPile: string[];
  discardPile: string[];
  deckVersion: number;
}
