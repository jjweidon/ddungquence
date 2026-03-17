import type { PlayerGameStats } from "@/features/room/types";

/** docs/21-player-stats-weighting.md 기반 가중치 */
const WEIGHTS = {
  sequencesCompleted: 15,
  fourInARowCount: 6,
  threeInARowCount: 2,
  twoEyedJackUsed: 3,
  oneEyedJackUsed: 3,
  keyJackRemovals: 5,
  keyJackPlacements: 5,
} as const;

/**
 * 플레이어 통계로부터 팀 내 기여도 점수를 계산한다.
 * docs/21-player-stats-weighting.md 가중치 공식 적용.
 */
export function computeContributionScore(stats: PlayerGameStats): number {
  return (
    stats.sequencesCompleted * WEIGHTS.sequencesCompleted +
    stats.fourInARowCount * WEIGHTS.fourInARowCount +
    stats.threeInARowCount * WEIGHTS.threeInARowCount +
    stats.twoEyedJackUsed * WEIGHTS.twoEyedJackUsed +
    stats.oneEyedJackUsed * WEIGHTS.oneEyedJackUsed +
    stats.keyJackRemovals * WEIGHTS.keyJackRemovals +
    stats.keyJackPlacements * WEIGHTS.keyJackPlacements
  );
}
