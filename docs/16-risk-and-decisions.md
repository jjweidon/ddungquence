# 16. 리스크/결정 로그

## 1) 결정(Decision) 로그
아래 형식으로 누적 기록한다.

```md
### [D-YYYYMMDD-01] 제목
- 맥락:
- 고려한 옵션:
- 결정:
- 근거:
- 영향 범위:
- 후속 작업:
```

## 2) 초기 결정 목록(초안)

### [D-20260217-01] Firestore 사용 + public/private 문서 분리
- 결정: public game state는 `rooms/{roomId}` 1문서, 손패는 `privateHands/{uid}`로 분리
- 근거: 손패 비공개 보장 + 구독 문서 수 최소화

### [D-20260217-02] RoomCode 조회를 위한 `roomCodes/{code}` 도입
- 결정: 참가자는 code로 `roomCodes`를 읽어 roomId를 알아낸 뒤 join
- 근거: 참가 전에는 `rooms`를 읽을 권한이 없도록 설계하기 위함

### [D-20260217-03] 공정성(랜덤/딜링) MVP는 host 신뢰 모델
- 결정: host가 dealer로 덱을 보관하고 딜링 수행
- 근거: 서버 없이 완전 공정 RNG는 구현 복잡도가 매우 큼
- 리스크: host 치팅 가능 → 친구방 전제 + 차기 개선

### [D-20260219-01] 잭 종류 판별: 문양 대신 카드 ID 번호(j_1/j_2) 기준
- 맥락: 기획 변경으로 Two-eyed/One-eyed Jack 구분 방식을 문양(클로버·다이아 vs 하트·스페이드)에서 카드 ID variant 번호로 변경
- 고려한 옵션: (1) 기존 문양 기준 유지 (2) j_1/j_2 기준으로 변경
- 결정: **j_2** = Two-eyed Jack(와일드 배치), **j_1** = One-eyed Jack(칩 제거). `cardId.endsWith("_j_2")` / `endsWith("_j_1")`로 판별
- 근거: 카드 이미지/디자인이 j_1(한 눈), j_2(두 눈)로 구분되어 있어 ID와 일치시킴
- 영향 범위: `src/domain/rules/jacks.ts`, 문서(01, 05, 08, 17, 18), Cursor rules
- 후속 작업: 없음

### [D-20260220-01] One-eyed Jack: 자기 팀 칩 제거 허용
- 맥락: 6목 해소 등 전략상 자기 팀 칩을 제거해야 하는 경우가 있음
- 결정: One-eyed Jack으로 **상대 칩뿐 아니라 자기 팀 칩도** 제거 가능(완성 시퀀스 칩은 여전히 제거 불가)
- 근거: 룰 해석 확장으로 전략 폭 확대
- 영향 범위: `src/domain/rules/highlight.ts`, `src/features/game/gameApi.ts`, 문서(01), Cursor rules
- 후속 작업: 없음

## 3) 핵심 리스크

### R-1 비용 폭증(Reads)
- 원인: 구독 문서/쿼리 남발, presence 고빈도 업데이트, 이벤트 로그 상시 구독
- 완화: public 1 + private 1, 턴 단위 업데이트, presence 저빈도, events 옵션

### R-2 치팅/무결성
- 원인: 클라이언트가 state를 생성/업데이트
- 완화: 최소 권한 룰(현재 턴만 update), expectedVersion, 로그 기록, 차기 공정성 강화

### R-3 룰 해석 모호성(시퀀스 중복, 제거 제한 등)
- 완화: 본 문서/08 문서에서 해석을 **명시 고정**하고, 변경은 Decision 로그로 관리

### R-4 저작권/상표
- 완화: 공개 배포 시 자체 아트/자체 텍스트로 전환, 상표/로고 사용 금지

## 4) 액션 아이템 템플릿
- [ ] (Owner) 항목 - 기한/상태
