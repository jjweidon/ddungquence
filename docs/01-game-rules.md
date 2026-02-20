# 01. 게임 규칙 정리(구현 기준)

> 참고 규칙 문서: JAX/Sequence 공식(또는 유통) 규칙 PDF를 기준으로 정리했다.

## 1) 목표
- **같은 색 칩 5개 연속(가로/세로/대각)**으로 “시퀀스”를 만든다.
- 2인/2팀 게임: **2개의 시퀀스**를 먼저 만들면 승리.
- 3인/3팀 게임: **1개의 시퀀스**를 먼저 만들면 승리.
- **변형 규칙 적용**: 코너 4칸에도 **코너 카드**를 사용해서 칩을 놓아야 한다. 코너를 포함해도 시퀀스는 5칸으로 완성(코너가 와일드가 아님).

## 2) 구성요소(온라인 구현 관점)
- 10x10 보드: 각 카드(잭 제외)가 보드에 2번씩 등장. 변형 규칙에서는 코너 4칸도 해당 코너 카드로 칩 배치.
- 카드 덱: 104장(= 2덱 구성), 잭 8장
- 칩: 팀별 색상 **레드 · 블루 · 그린**. 처음 배정 팀 = 레드, 다음 = 블루, 그 다음 = 그린(2팀이면 레드·블루, 3팀이면 레드·블루·그린).

## 3) 셋업
- 플레이어 수: 2~12(2 또는 3으로 나누어 떨어지는 인원)
- 3명까지는 개인전 가능, 그 이상은 팀전(최대 3팀)
- 카드 배분(기본 규칙):
  - 2명: 7장 (**수정 규칙: 2~4명 모두 6장**)
  - 3명: 6장
  - 4명: 6장
  - 6명: 5장
  - 8명: 4장
  - 9명: 4장
  - 10명: 3장
  - 12명: 3장

- 게임 보드(10x10):
  jack을 제외한 카드 2장씩(96장) + 코너 카드(4장) => 100장  
  (카드 ID 규격·이미지 경로: 05-data-model-erd §5 참조. 이미지는 `public/cards` 하위 svg/webp 사용, 베이스 경로는 프로젝트 세팅에 따라 가변)
  ``` javascript
  const boardImages = [
      // 1
      getCardImage('o', 'o', 1), getCardImage('spade', '2', 1), getCardImage('spade', '3', 1), getCardImage('spade', '4', 1), getCardImage('spade', '5', 1),
      getCardImage('spade', '6', 1), getCardImage('spade', '7', 1), getCardImage('spade', '8', 1), getCardImage('spade', '9', 1), getCardImage('o', 'o', 2),
      // 2
      getCardImage('clover', '6', 1), getCardImage('clover', '5', 1), getCardImage('clover', '4', 1), getCardImage('clover', '3', 1), getCardImage('clover', '2', 1),
      getCardImage('heart', 'a', 1), getCardImage('heart', 'k', 1), getCardImage('heart', 'q', 1), getCardImage('heart', '10', 1), getCardImage('spade', '10', 1),
      // 3
      getCardImage('clover', '7', 1), getCardImage('spade', 'a', 1), getCardImage('diamond', '2', 1), getCardImage('diamond', '3', 1), getCardImage('diamond', '4', 1),
      getCardImage('diamond', '5', 1), getCardImage('diamond', '6', 1), getCardImage('diamond', '7', 1), getCardImage('heart', '9', 1), getCardImage('spade', 'q', 1),
      // 4
      getCardImage('clover', '8', 1), getCardImage('spade', 'k', 1), getCardImage('clover', '6', 2), getCardImage('clover', '5', 2), getCardImage('clover', '4', 2),
      getCardImage('clover', '3', 2), getCardImage('clover', '2', 2), getCardImage('diamond', '8', 1), getCardImage('heart', '8', 1), getCardImage('spade', 'k', 2),
      // 5
      getCardImage('clover', '9', 1), getCardImage('spade', 'q', 2), getCardImage('clover', '7', 1), getCardImage('heart', '6', 1), getCardImage('heart', '5', 1),
      getCardImage('heart', '4', 1), getCardImage('heart', 'a', 2), getCardImage('diamond', '9', 1), getCardImage('heart', '7', 1), getCardImage('spade', 'a', 2),
      // 6
      getCardImage('clover', '10', 1), getCardImage('spade', '10', 2), getCardImage('clover', '8', 2), getCardImage('heart', '7', 2), getCardImage('heart', '2', 1),
      getCardImage('heart', '3', 1), getCardImage('heart', 'k', 2), getCardImage('diamond', '10', 1), getCardImage('heart', '6', 2), getCardImage('diamond', '2', 2),
      // 7
      getCardImage('clover', 'q', 1), getCardImage('spade', '9', 2), getCardImage('clover', '9', 2), getCardImage('heart', '8', 2), getCardImage('heart', '9', 2),
      getCardImage('heart', '10', 2), getCardImage('heart', 'q', 2), getCardImage('diamond', 'q', 1), getCardImage('heart', '5', 2), getCardImage('diamond', '3', 2),
      // 8
      getCardImage('clover', 'k', 1), getCardImage('spade', '8', 2), getCardImage('clover', '10', 2), getCardImage('clover', 'q', 2), getCardImage('clover', 'k', 2),
      getCardImage('clover', 'a', 1), getCardImage('diamond', 'a', 1), getCardImage('diamond', 'k', 1), getCardImage('heart', '4', 2), getCardImage('diamond', '4', 2),
      // 9
      getCardImage('clover', 'a', 2), getCardImage('spade', '7', 2), getCardImage('spade', '6', 2), getCardImage('spade', '5', 2), getCardImage('spade', '4', 2),
      getCardImage('spade', '3', 2), getCardImage('spade', '2', 2), getCardImage('heart', '2', 2), getCardImage('heart', '3', 2), getCardImage('diamond', '5', 2),
      // 10
      getCardImage('o', 'o', 3), getCardImage('diamond', 'a', 2), getCardImage('diamond', 'q', 2), getCardImage('diamond', 'k', 2), getCardImage('diamond', '10', 2),
      getCardImage('diamond', '9', 2), getCardImage('diamond', '8', 2), getCardImage('diamond', '7', 2), getCardImage('diamond', '6', 2), getCardImage('o', 'o', 4),
    ];
  ```
  > **보드 고정**: 위 `boardImages`가 10x10 보드의 유일한 정의이다. cellId = 배열 인덱스(0..99, row×10+col). 구현 시에는 이 내용을 **상수 JSON 파일**로 두고, 클라이언트에서는 JSON만 참조한다. 상세 규격은 [18. 보드 레이아웃](./18-board-layout.md) 참조.

## 4) 턴 진행(핵심)
시계방향으로 진행. 각 턴은 다음 순서:
1. 손에서 카드 1장 선택 → 본인 discard에 공개로 버림
2. 해당 카드에 대응하는 보드 칸에 **칩 1개 배치**
3. 덱에서 카드 1장 드로우(손패 유지)

주의(룰 문구): 턴 끝에 드로우를 깜박하고 다음 플레이어가 진행해버리면, **드로우 권리를 잃고** 남은 게임을 손패 1장 적게 진행한다.  
→ 온라인에서는 실수 여지를 제거하기 위해 “턴 종료 시 자동 드로우”로 처리.

## 5) 잭(Jack) 특수 규칙
보드에는 잭이 없다. 잭은 “행동 카드”다.

**잭 종류 판별**: 카드 ID의 번호(variant)로 구분한다. 문양(클로버/다이아 등)이 아니다.
- **j_2** → Two-eyed Jack (와일드 배치)
- **j_1** → One-eyed Jack (칩 1개 제거, 상대·자기 팀 모두 가능)

### 5.1 Two-eyed Jack (2-eye) = 와일드 배치
- 카드 ID가 `*_j_2` 형태인 잭(예: `clover_j_2`, `heart_j_2`)을 버리고, 보드의 **어떤 빈 칸**에도 내 칩 1개를 배치 가능.
- **변형 규칙 적용**: Two-eyed jack으로 칩을 놓은 칸에는 **바로 다음 플레이어만** one-eyed jack으로 그 칩을 제거할 수 없다. 그 다음 순서 플레이어부터는 one-eyed jack으로 제거 가능.

### 5.2 One-eyed Jack (1-eye) = 칩 제거
- 카드 ID가 `*_j_1` 형태인 잭(예: `clover_j_1`, `heart_j_1`)을 버리고, 보드 위 칩 1개를 **제거**한다. 상대 팀 칩뿐 아니라 **자기 팀 칩도** 필요 시 제거할 수 있다(예: 6목 해소).
- **변형 규칙 적용**: 제거한 칸에 **바로 다음 플레이어만** two-eyed jack으로 칩을 놓을 수 없다. 그 다음 순서 플레이어부터는 two-eyed jack으로 그 칸을 채울 수 있다. (예: 4명 플레이 시, one-eyed jack으로 뺀 자리에 바로 다음 상대는 two-eyed jack 사용 불가, 2번째 상대는 사용 가능.)
- **완성된 시퀀스에 포함된 칩은 제거 불가(기본 규칙)**

## 6) 데드 카드(Dead Card)
- 손의 카드가 보드에서 **두 칸 모두 이미 점유**되어 더 이상 둘 곳이 없으면 “데드 카드”
- **변형 규칙 적용**: 데드 카드는 **교체하지 않고** 손에 그대로 두며, 해당 턴에 사용할 수 없는 카드로만 취급한다(버리기/교체 드로우 없음).

## 7) 시퀀스 판정/중복 규칙
- 시퀀스: 같은 색 칩 5개가 직선으로 연속(가로/세로/대각)
- **변형 규칙 적용**: 코너에도 카드를 사용해 칩을 놓기 때문에 **코너 칸은 팀 전용**이며, 여러 팀이 동일 코너를 시퀀스 일부로 공유할 수 없다.
- 2시퀀스 승리 모드에서는 **첫 시퀀스의 임의의 한 칸을 두 번째 시퀀스에 재사용 가능**(중복 1칸 허용)

### 7-1) 6목(6개 이상 연속) 정책(고정)
- 같은 팀 칩이 동일 방향으로 **6개 이상 연속**으로 이어지면 **어떤 5칸 윈도우도 시퀀스로 인정하지 않는다.**
- 이유: 6개 연속에는 `[0~4]`, `[1~5]` 두 가지 5칸 윈도우가 존재하므로 "어떤 5칸이 시퀀스인지" 특정할 수 없어 둘 다 무효 처리한다.
- **이미 완성된 시퀀스에 1칸을 더 붙이는 경우** → 기존 시퀀스와 4칸 이상 겹쳐 어차피 신규 시퀀스로 인정되지 않으며, 6목 판정 대상과 무관하게 동일 결과다.
- **6개 연속 → one-eyed Jack으로 양쪽 끝 중 하나를 제거해 5개만 남기면** → 비로소 시퀀스로 인정한다.
  - 예: `[A][A][A][A][A][A]` 상태에서 왼쪽 끝 칩을 제거 → `[ ][A][A][A][A][A]` → 오른쪽 5칸 `[1~5]`이 시퀀스로 탐지됨.
- **판정 로직(구현)**: `findAllCandidates`에서 어떤 5칸 후보의 시작 직전 칸 또는 끝 직후 칸에 동일 팀 칩이 존재하면 해당 후보를 제외한다.

## 8) 덱 소진
- **변형 규칙 적용**: 드로우 덱이 모두 소진될 때까지 **승부가 나지 않으면** 게임을 **무승부**로 종료한다(리셔플하지 않음).

## 9) 온라인 구현 정책(권장)
- “턴 종료 시 자동 드로우”로 사용자 실수 케이스 제거
- 한 턴 = **단일 트랜잭션**으로 처리:
  - 공개 discard 업데이트
  - 보드 칩 변경(배치/제거)
  - 턴/현재 플레이어 이동
  - 손패/드로우 처리(비공개)

## 10) 참고 링크(원문)
- Sequence – Game Instructions (PDF, Amazon CDN): https://images-na.ssl-images-amazon.com/images/I/81c4gCJTojL.pdf
- Sequence Rulebook (PDF): https://cdn.1j1ju.com/medias/a9/0f/d2-sequence-rulebook.pdf
