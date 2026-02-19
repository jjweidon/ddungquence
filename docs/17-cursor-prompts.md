# 17. Cursor 작업 프롬프트 팩(바이브코딩용)

> 사용법: 아래 프롬프트를 Cursor에게 그대로 던지고, 생성된 코드가 문서(요구사항/스키마/규칙)와 일치하는지 리뷰한다.  
> 원칙: **작게 생성 → 즉시 실행/테스트 → 다음 단계**.

---

## P0. 부트스트랩
### 프롬프트
- Next.js(App Router) + TypeScript + Tailwind 프로젝트를 만든 뒤, 아래 구조로 폴더를 구성해줘:
  - `src/lib/firebase/client.ts`
  - `src/features/auth/ensureAuth.ts`
  - `src/app/page.tsx` (landing)
  - `src/app/lobby/[code]/page.tsx`
  - `src/app/game/[roomId]/page.tsx`
- `ensureAuth()`를 만들어서 앱 진입 시 Google 로그인 팝업으로 uid를 발급받게 해줘.
- 환경변수는 `NEXT_PUBLIC_FIREBASE_*`만 사용해.

### 완료 기준
- `/` 접속 시 Google 로그인 후 uid가 발급되고 콘솔에 uid가 출력된다.

---

## P1. Firestore 스키마 기반 로비 구현
### 프롬프트
- Firestore에 `roomCodes/{code}`와 `rooms/{roomId}`를 생성하는 `createRoom(nickname)` 함수를 만들어줘.
- 참가자는 `joinRoomByCode(code, nickname)`로 입장한다:
  1) `roomCodes/{code}`를 읽어 roomId를 가져온다.
  2) `rooms/{roomId}/players/{uid}`를 create 한다.
  3) 로비 화면에서 참가자 리스트를 실시간 구독한다.
- 로비에서 Ready 토글/팀 선택을 본인 문서 업데이트로 구현해줘.
- host만 “게임 시작” 버튼이 보이게 해줘.

### 완료 기준
- 서로 다른 브라우저 2개로 로비 입장 후 Ready/팀 변경이 실시간 반영된다.

---

## P2. 도메인(룰 엔진) 작성
### 프롬프트
- `src/domain`에 다음을 만들어줘:
  - `cards/deck.ts`: 104장 덱 생성, 셔플
  - `rules/jacks.ts`: two-eye/one-eye 판정(카드 ID j_2/j_1 기준)
  - `rules/deadCard.ts`: 데드 카드 판정(변형: 사용 불가, 교체 없음)
  - `rules/sequenceDetect.ts`: chipsByCell 기반 시퀀스 탐지(가로/세로/대각, 변형: 코너도 점유)
- 함수는 모두 pure function으로 작성하고, 입력/출력 타입을 명확히 해줘.
- Vitest로 최소 10개 케이스 테스트를 만들어줘.

### 완료 기준
- `npm test`가 통과하고, 시퀀스 판정이 안정적으로 동작한다.

---

## P3. 게임 시작(딜링)
### 프롬프트
- host가 `startGame(roomId)`를 누르면:
  - privateDealer/deck에 drawPile/discardPile을 저장하고
  - 각 플레이어의 `privateHands/{uid}`에 초기 손패를 분배해
  - `rooms/{roomId}.status=playing`, `game` 초기 상태를 저장해줘.
- 손패는 본인만 읽을 수 있게(구독) 해줘.

### 완료 기준
- 2명이 start 후 game 화면에서 서로 다른 손패를 본다.

---

## P4. 턴 액션(트랜잭션)
### 프롬프트
- `submitTurnAction(roomId, action)`을 만들어:
  - `expectedVersion`을 검사하고
  - public room doc의 chipsByCell/discard/turn/version을 transaction으로 업데이트해줘.
- 액션은 다음을 지원:
  - normal card: targetCellId에 칩 배치
  - two-eye jack: 어떤 빈칸 배치
  - one-eye jack: 상대 칩 제거(완성 시퀀스 칩 제거 금지)
  - dead card exchange: deadCard를 버리고 교체
- UI에서 가능한 칸/제거 가능한 칩 하이라이트를 제공해줘.

### 완료 기준
- 2명이 번갈아 클릭해도 중복/경쟁 업데이트가 발생하지 않는다.

---

## P5. 폴리싱/배포
### 프롬프트
- txPending 상태에서 UI 잠금/피드백(스피너)을 추가해줘.
- offline 감지 시 턴 액션을 disable 해줘.
- Vercel 배포 체크리스트를 코드/README에 반영해줘.

### 완료 기준
- 배포된 URL에서 2명이 실제로 한 판 완주 가능하다.
