export type Suit = "spade" | "heart" | "diamond" | "clover";
export type Rank =
  | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10"
  | "j" | "q" | "k" | "a";
export type Variant = 1 | 2;

/** 카드 ID: "{suit}_{rank}_{variant}" 형식. 예) "spade_2_1", "heart_j_2", "o_o_1"(코너) */
export type CardId = string;

export type TeamId = "A" | "B";

/** 보드 점유 맵: cellId(0..99) string key → TeamId */
export type ChipsByCell = Record<string, TeamId>;

/** 완성된 시퀀스 */
export interface CompletedSequence {
  teamId: TeamId;
  cells: number[]; // 길이 5, 정렬됨
  createdTurn: number;
}

/** 새로 탐지된 시퀀스 후보 (createdTurn은 호출자가 부여) */
export interface DetectedSequence {
  teamId: TeamId;
  cells: number[]; // 길이 5, 정렬됨
}
