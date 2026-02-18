# 04. 아키텍처

## 1) 한 줄 요약
Next.js 클라이언트가 Firebase(Auth + Firestore)를 직접 사용해 **로비/게임 상태를 실시간으로 공유**한다. 핵심 업데이트는 **Transaction + version 증가**로 일관성을 확보한다.

## 2) 구성도

```mermaid
flowchart LR
  U1[Player Browser/PWA] -->|Anon Auth| AUTH[Firebase Auth]
  U1 -->|read/write| FS[(Firestore)]
  U2[Other Players] --> AUTH
  U2 --> FS

  subgraph Vercel
    N[Next.js App (static/SSR as needed)]
  end
  U1 --> N
  U2 --> N
```

> 참고: Vercel은 앱 서빙만 담당. 게임 동기화/데이터는 Firebase가 담당.

## 3) 핵심 설계 선택

### 3.1 Firestore vs RTDB
- MVP: Firestore 채택(문서 단위 스냅샷, 트랜잭션, 규칙 작성 편의)
- 비용 최적화: “구독 문서 수 최소화 + 턴 단위 업데이트”로 Read를 제어

### 3.2 Public/Private 분리(필수)
- **Public**(모두가 봐도 되는 정보): 보드 칩, 현재 턴, discard, 점수/시퀀스
- **Private**(본인만 봐야 하는 정보): 손패(hand), 덱 정보(공정성 모델에 따라)

Firestore는 필드 단위 권한을 제공하지 않으므로, 손패는 반드시 **별도 문서**로 분리한다.

### 3.3 공정성/랜덤(현실적 접근)
자체 서버가 없으므로 “완전한 부정행위 방지”는 비용이 커진다. MVP는 친구방 전제로 다음 중 하나를 선택한다.

- **MVP(권장)**: host가 dealer 역할
  - host만 덱(순서)을 보관
  - host가 각 플레이어의 private hand 문서에 카드를 “딜”해준다
  - 나머지는 rules + transaction으로 턴만 보장
- **차기(P2)**: 커밋-리빌/다자 난수 기여 등 공정성 강화(16 문서에 실험 로그)

## 4) 데이터 흐름

### 4.1 로비
1. host가 room 문서 생성(status=lobby)
2. 참가자는 roomCode로 room을 조회하고 `players/{uid}`에 참가 등록(참가 자리 없으면 role=spectator로 관전 등록, 관전 최대 2명)
3. 로비에서 참여자는 “관전하기”로 관전 전환, 관전자는 자리 있을 때 “참여하기”로 참여 전환 가능
4. Ready 상태 변경은 각자 본인 `players/{uid}`에서 업데이트(참여자만)

### 4.2 게임 시작
1. host가 “start” 실행
2. host가 덱 생성/셔플
3. 각 플레이어의 `privateHands/{uid}`에 초기 손패를 write
4. public room doc에 `game` 초기 상태 write(status=playing)

### 4.3 한 턴 처리(권장: 단일 트랜잭션)
- public:
  - discard 업데이트(누가 어떤 카드 냈는지)
  - board 칩 배치/제거
  - 시퀀스 판정 결과/점수 업데이트
  - nextTurn 계산 및 currentPlayerUid 이동
  - version + 1
- private:
  - 현재 플레이어 hand에서 사용 카드 제거
  - 드로우 카드 1장 추가(또는 dead-card 교체 로직 반영)

> 구현 난이도를 낮추려면 private 업데이트는 “public 트랜잭션 성공 후” 별도 write로 처리할 수 있다.
> 단, 이 경우 중간 상태가 잠시 보일 수 있으므로 UX에서 로딩 상태를 관리한다.

## 5) 동시성/충돌 처리
- 모든 턴 액션은 `expectedVersion`을 포함하여 transaction에서 검증:
  - `resource.version == expectedVersion` 일 때만 적용
  - 아니면 “이미 다른 업데이트가 반영됨”으로 처리하고 최신 상태 재로딩

## 6) 캐시/오프라인
- Firestore 캐시를 켜면(기본) 일시적 네트워크 장애에 유리
- 단, 오프라인에서 턴 액션은 충돌 위험이 크므로:
  - “오프라인이면 턴 액션 금지” 정책을 둔다(버튼 disable + 토스트)

## 7) DoD 체크리스트
- [ ] public 1문서 + private 1문서 구독만으로 게임 진행이 가능하다
- [ ] 턴 액션은 transaction 기반으로 중복/경쟁 업데이트가 없다
- [ ] 손패는 본인 외에는 열람 불가다
