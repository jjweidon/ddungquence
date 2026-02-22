import type { Timestamp } from "firebase/firestore";

export type TeamId = "A" | "B";

/** 서버에서 읽은 후의 플레이어 문서 (joinedAt/lastSeenAt/readyAt은 Timestamp) */
export interface RoomPlayerDoc {
  uid: string;
  nickname: string;
  role: "participant" | "spectator";
  teamId?: TeamId;
  seat?: number;
  ready?: boolean;
  /** 마지막으로 준비 상태가 된 시점. 게임 순서(팀 내) 정렬 기준 */
  readyAt?: Timestamp | null;
  joinedAt: Timestamp;
  lastSeenAt: Timestamp;
  /** 봇 플레이어 여부. true이면 호스트 클라이언트가 턴을 자동 실행 */
  isBot?: boolean;
}

/** setDoc 시 사용. joinedAt/lastSeenAt/readyAt에 serverTimestamp() 허용 */
export type RoomPlayerDocWrite = Omit<RoomPlayerDoc, "joinedAt" | "lastSeenAt" | "readyAt"> & {
  joinedAt: Timestamp | ReturnType<typeof import("firebase/firestore").serverTimestamp>;
  lastSeenAt: Timestamp | ReturnType<typeof import("firebase/firestore").serverTimestamp>;
  readyAt?: Timestamp | null | ReturnType<typeof import("firebase/firestore").serverTimestamp>;
};

export interface CompletedSequenceEntry {
  teamId: TeamId;
  cells: number[];
  createdTurn: number;
}

export interface PublicGameState {
  version: number;
  phase: "setup" | "playing" | "ended";
  turnNumber: number;
  currentUid: string;
  currentSeat: number;
  chipsByCell: Record<string, TeamId>;
  completedSequences: CompletedSequenceEntry[];
  discardTopBySeat: Record<string, string | null>;
  scoreByTeam: Record<TeamId, number>;
  deckMeta: { drawLeft: number; reshuffles: number };
  /** One-eyed Jack으로 제거된 셀: 바로 다음 플레이어는 Two-eyed로 여기에 배치 불가 */
  oneEyeLockedCell?: number | null;
  /** Two-eyed Jack으로 배치된 셀: 바로 다음 플레이어는 One-eyed로 여기 칩 제거 불가 */
  twoEyeLockedCell?: number | null;
  winner?: { teamId: TeamId; atTurn: number };
  lastAction?: { uid: string; type: string; at: Timestamp };
  /** 직전 턴에 칩이 놓인 칸(칩에 그림자 힌트). 배치가 없으면 null */
  lastPlacedCellId?: number | null;
  /** 직전 턴에 액션이 일어난 칸(배치·제거 모두). 빈 칸(1-eye 제거)도 셀 어둡게 표시용 */
  lastActionCellId?: number | null;
  /** 현재 턴이 시작된 시각(서버 기준). 새로고침 후에도 타이머 유지용 */
  turnStartedAt?: Timestamp;
}

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
  game?: PublicGameState;
}

export interface RoomCodeDoc {
  roomId: string;
  createdAt: Timestamp;
}
