# 21. 플레이어 통계 및 팀 기여도 가중치

## 1) 목적
게임 종료 결과 모달에서 개인 플레이어의 플레이 기록과 팀 내 기여도를 시각적으로 표시한다.

## 2) 통계 항목

| 항목 | 설명 |
|------|------|
| 1-eye jack | One-eyed Jack(스페이드·하트)으로 칩 제거한 횟수 |
| 2-eye jack | Two-eyed Jack(클로버·다이아)으로 칩 배치한 횟수 |
| 시퀀스 완성 | 이 플레이어가 놓은 칩으로 시퀀스(5목)를 완성한 횟수 |
| 4목 | 시퀀스가 아닌 4개 연속(가로/세로/대각)을 만든 횟수 |
| 3목 | 3개 연속을 만든 횟수 |
| 핵심 제거(4목) | 1-eye로 상대의 4목 칩을 제거한 횟수 |
| 핵심 제거(3목) | 1-eye로 상대의 3목(4목 미만) 칩을 제거한 횟수 |
| 핵심 배치(4목) | 2-eye로 아군 4목에 핵심 칩을 놓은 횟수 |
| 핵심 배치(3목) | 2-eye로 아군 3목(4목 미만)에 핵심 칩을 놓은 횟수 |

## 3) 팀 기여도 점수 공식

다음 가중치로 점수를 합산한다(문서 기반, 변경 시 Decision 로그 업데이트).

| 항목 | 가중치 | 비고 |
|------|--------|------|
| 시퀀스 완성 | 10 | 승리에 직접 기여 |
| 4목 | 6 | 시퀀스 직전 단계 |
| 3목 | 2 | 연속 구축 기여 |
| 2-eye jack | 1 | 전략적 배치 |
| 1-eye jack | 1 | 상대 진행 방해 |
| 핵심 제거(4목) | 5 | 상대 4목 파괴 |
| 핵심 제거(3목) | 2 | 상대 3목 파괴 |
| 핵심 배치(4목) | 5 | 아군 4목 구축 |
| 핵심 배치(3목) | 2 | 아군 3목 구축 |

**점수 계산:**
```
contributionScore =
  sequencesCompleted * 10
  + fourInARowCount * 6
  + threeInARowCount * 2
  + twoEyedJackUsed * 1
  + oneEyedJackUsed * 1
  + keyJackRemovals4 * 5
  + keyJackRemovals3 * 2
  + keyJackPlacements4 * 5
  + keyJackPlacements3 * 2
```

## 4) UI 표시

- **개인 기록**: 팀별로 플레이어 목록 + 각 항목 수치
- **팀 기여도**: 팀 내 플레이어별 contributionScore를 막대 그래프(또는 비율)로 표시
- 승리 팀/패배 팀 색상 유지

## 5) 구현 참고

- `src/domain/rules/playerStats.ts` — 점수 계산 pure function
- `src/features/room/types.ts` — `PlayerGameStats`, `playerStatsByUid`
- `docs/16-risk-and-decisions.md` — 변경 시 Decision 로그 추가
