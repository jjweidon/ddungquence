import type { PlayerGameStats } from "@/features/room/types";

/** docs/21-player-stats-weighting.md 기반 가중치 */
const WEIGHTS = {
  sequencesCompleted: 10,
  fourInARowCount: 6,
  threeInARowCount: 2,
  twoEyedJackUsed: 1,
  oneEyedJackUsed: 1,
  keyJackRemovals4: 5,
  keyJackRemovals3: 2,
  keyJackPlacements4: 5,
  keyJackPlacements3: 2,
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
    stats.keyJackRemovals4 * WEIGHTS.keyJackRemovals4 +
    stats.keyJackRemovals3 * WEIGHTS.keyJackRemovals3 +
    stats.keyJackPlacements4 * WEIGHTS.keyJackPlacements4 +
    stats.keyJackPlacements3 * WEIGHTS.keyJackPlacements3
  );
}
