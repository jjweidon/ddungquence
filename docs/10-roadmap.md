# 10. 로드맵(진행도 점검표)

> 목표: Cursor로 구현을 쪼개기 쉬운 “작업 단위”로 분해하고, 각 단계의 DoD를 명확히 한다.

---

## M0. 프로젝트 부트스트랩
- [ ] Next.js(App Router) + TS + Tailwind 초기화
- [ ] ESLint/Prettier 설정
- [ ] Firebase SDK 연결 + 익명 로그인
- [ ] 기본 라우팅: `/`(landing), `/lobby/[code]`, `/game/[roomId]`

**DoD**
- [ ] 배포(Vercel) 후 Firebase 연결이 정상 동작

---

## M1. 로비(E2E)
- [ ] 방 생성: `rooms` + `roomCodes`
- [ ] 방 참가: 코드 → roomId 조회 → players 문서 생성
- [ ] 참가자 리스트 실시간 표시
- [ ] Ready 토글 / 팀 선택
- [ ] host만 “게임 시작” 버튼

**DoD**
- [ ] 2~4명이 로비에 모이고, Ready/팀 변경이 서로 실시간 반영

---

## M2. 게임 엔진(로컬 단위 테스트)
- [ ] 카드/덱 모델(104장) + 셔플
- [ ] 보드 레이아웃 상수 JSON 확정(내용은 01-game-rules boardImages와 동일, 클라이언트에서는 JSON만 사용, 18-board-layout 참조)
- [ ] 칩 점유 맵(chipsByCell) 기반 보드 상태
- [ ] 잭/데드 카드 규칙 함수
- [ ] 시퀀스 판정 알고리즘

**DoD**
- [ ] domain 함수만으로 한 턴 진행이 가능(입력 state + action → 출력 state)

---

## M3. 게임 시작(딜링/초기화)
- [ ] host가 dealer로 덱 생성/보관(privateDealer)
- [ ] 각 플레이어 privateHands 초기 딜링
- [ ] public game 초기 상태 write

**DoD**
- [ ] 로비에서 start 누르면 모든 클라이언트가 game 화면으로 이동 및 손패 확인

---

## M4. 턴 진행(실시간)
- [ ] public room doc 구독(onSnapshot)
- [ ] privateHands 구독(onSnapshot)
- [ ] 액션 제출(트랜잭션): normal/jack/dead
- [ ] 충돌 처리(expectedVersion mismatch)
- [ ] 승리 판정 및 ended 전환

**DoD**
- [ ] 2~4명이 실제로 한 판 끝까지 플레이 가능

---

## M5. UX 폴리싱
- [ ] 가능한 칸/제거 가능 칩 하이라이트
- [ ] txPending 잠금/피드백
- [ ] 재접속 복원 안정화
- [ ] 오류 토스트/가이드 문구(How to play)

**DoD**
- [ ] 초심자도 룰을 크게 헤매지 않고 1판 완주 가능

---

## M6. 품질/운영
- [ ] 보안 규칙 적용 및 검증
- [ ] 간단한 이벤트 로그(선택)
- [ ] 라이트 성능 최적화(보드 cell memo)
- [ ] (선택) Sentry/분석 도입

**DoD**
- [ ] 타 계정이 손패를 읽거나 게임 상태를 임의로 바꾸기 어렵다

---

## 진행도 점검 템플릿(주간/스프린트)
아래를 복사해 이슈/노션/깃허브 프로젝트에 사용.

- [ ] 이번 주 목표(Mx): ____
- [ ] 완료한 PR:
  - [ ] PR#__
- [ ] 남은 리스크:
  - [ ] ____
- [ ] 비용/트래픽 점검:
  - [ ] 구독 문서 수: public __ / private __ / events __
  - [ ] 턴당 write 횟수: __
- [ ] 다음 작업:
  - [ ] ____
