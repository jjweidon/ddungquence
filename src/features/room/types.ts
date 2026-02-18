import type { Timestamp } from "firebase/firestore";

export type TeamId = "A" | "B";

/** 서버에서 읽은 후의 플레이어 문서 (joinedAt/lastSeenAt은 Timestamp) */
export interface RoomPlayerDoc {
  uid: string;
  nickname: string;
  role: "participant" | "spectator";
  teamId?: TeamId;
  seat?: number;
  ready?: boolean;
  joinedAt: Timestamp;
  lastSeenAt: Timestamp;
}

/** setDoc 시 사용. joinedAt/lastSeenAt에 serverTimestamp() 허용 */
export type RoomPlayerDocWrite = Omit<RoomPlayerDoc, "joinedAt" | "lastSeenAt"> & {
  joinedAt: Timestamp | ReturnType<typeof import("firebase/firestore").serverTimestamp>;
  lastSeenAt: Timestamp | ReturnType<typeof import("firebase/firestore").serverTimestamp>;
};

export interface RoomDoc {
  roomCode: string;
  status: "lobby" | "playing" | "ended";
  hostUid: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  config: {
    mode: "teams2";
    maxPlayers: 4;
    maxSpectators: 2;
    sequenceToWin: 2;
    oneEyedJackCanBreakSequence: boolean;
  };
}

export interface RoomCodeDoc {
  roomId: string;
  createdAt: Timestamp;
}
