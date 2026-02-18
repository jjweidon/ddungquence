# 19. 프론트엔드 코드 컨벤션

> 대상: **Next.js(App Router) + React + TypeScript + TailwindCSS** 기반의 클라이언트 코드
>
> 참고: Toss의 `toss-frontend-rules`에서 제시하는 원칙(가독성/예측가능성/응집도/결합도)을 본 프로젝트에 맞게 재구성했다.

---

## 0) 목표

- **읽기 쉬운 코드**: 한 파일을 위→아래로 읽으면 흐름이 이해된다.
- **예측 가능한 코드**: 함수/훅 이름만 봐도 부작용 여부와 반환 타입이 예상된다.
- **도메인 중심**: UI는 얇게, 룰/판정/상태 전이는 `src/domain`로 내려보낸다.
- **무료 구간 최적화**: Firestore 구독/업데이트는 얇고 명확하게 유지한다.

---

## 1) 가독성(Readability)

### 1.1 매직 넘버 금지 → 의미 있는 상수로 치환

**규칙**
- 보드/턴/애니메이션/타임아웃 등 숫자 리터럴을 직접 쓰지 않는다.
- 상수는 “의미”가 드러나는 이름으로 만든다.

**예시**
```ts
export const BOARD_SIZE = 10 as const;
export const SEQUENCE_LEN = 5 as const;
export const ROOM_CODE_LEN = 6 as const;

export const TURN_LOCK_TIMEOUT_MS = 800 as const; // txPending 잠금 UI 제한(UX)
```

---

### 1.2 구현 디테일은 감추고, 의도를 드러내는 컴포넌트/훅으로 감싼다

**규칙**
- 페이지 컴포넌트(`page.tsx`)는 **조립(Composition)** 역할만 수행한다.
- 인증/방 참가/턴 체크/confirm overlay 같은 “흐름 제어”는 전용 래퍼로 분리한다.

**패턴: Guard 컴포넌트**
```tsx
// app/game/[roomId]/page.tsx (가능하면 얇게)
export default function GamePage() {
  return (
    <AuthGuard>
      <RoomGuard>
        <GameScreen />
      </RoomGuard>
    </AuthGuard>
  );
}
```

**패턴: 전용 인터랙션 컴포넌트**
```tsx
// "카드 선택 → 칸 선택 → 확정" 플로우를 한 컴포넌트로 캡슐화
export function ConfirmTurnActionButton({ disabled, onConfirm }: {
  disabled?: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  return (
    <button
      disabled={disabled || pending}
      onClick={async () => {
        setPending(true);
        try {
          await onConfirm();
        } finally {
          setPending(false);
        }
      }}
    >
      확정
    </button>
  );
}
```

---

### 1.3 조건 분기가 크면 “코드 경로”를 컴포넌트로 분리

**규칙**
- 역할/상태에 따라 UI·로직이 크게 달라지면 한 컴포넌트에서 `if`를 늘리지 말고 분리한다.

**예시**
```tsx
export function GameActionBar() {
  const { isMyTurn } = useTurn();
  return isMyTurn ? <MyTurnActionBar /> : <OpponentTurnActionBar />;
}
```

---

### 1.4 복잡한 삼항 연산자/중첩 조건 금지

**규칙**
- 중첩 삼항은 금지. `if/return`(early return) 또는 `switch`로 바꾼다.

**예시**
```tsx
export function PhaseBanner() {
  const phase = useRoomPhase();
  switch (phase) {
    case 'lobby':
      return <Banner>로비</Banner>;
    case 'playing':
      return <Banner>진행 중</Banner>;
    case 'ended':
      return <Banner>종료</Banner>;
    default:
      return null;
  }
}
```

---

### 1.5 복잡한 조건은 이름을 붙인다

**규칙**
- 조건이 길어지면 변수로 이름을 붙여 의미를 명확히 한다.
- 이후 테스트/리팩토링 포인트가 된다.

**예시**
```ts
const isMyTurn = room.game?.currentUid === uid;
const canAct = room.status === 'playing' && isMyTurn && !txPending;
```

---

## 2) 예측가능성(Predictability)

### 2.1 훅은 반환 타입/형태를 표준화한다

**규칙**
- 동일 계열 훅은 동일한 shape로 반환한다.
- 상태는 문자열 enum이 아니라 **discriminated union**으로 고정한다.

**권장 표준 타입**
```ts
export type Loadable<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'success'; data: T };
```

**예시**
```ts
export function useRoom(roomId: string): Loadable<RoomDoc> {
  // 구현체는 자유지만 반환 shape는 고정
}
```

---

### 2.2 이름이 곧 계약이다(부작용 숨기지 않기)

**규칙**
- `fetch*`: 데이터 조회만 한다.
- `sync*` / `bootstrap*` / `ensure*`: 내부에서 상태 변경/로그인/리다이렉트 같은 부작용이 있을 수 있다.

**예시**
```ts
// OK: 부작용 가능성이 드러남
export async function ensureAnonAuth() {}

// OK: "읽기" 전용이 드러남
export async function fetchRoomByCode(code: string) {}
```

---

### 2.3 액션/이벤트는 Discriminated Union으로 고정

**규칙**
- 게임 액션은 문자열 + payload 조합의 union으로 정의한다.
- `switch(action.type)`에서 **exhaustive check**를 강제한다.

**예시**
```ts
export type TurnAction =
  | { type: 'PLAY_NORMAL'; cardId: string; cellId: number }
  | { type: 'PLAY_JACK_WILD'; cardId: string; cellId: number }
  | { type: 'PLAY_JACK_REMOVE'; cardId: string; targetCellId: number }
  | { type: 'EXCHANGE_DEAD'; cardId: string };

function assertNever(x: never): never {
  throw new Error('Unhandled case: ' + String(x));
}

export function reduceAction(action: TurnAction) {
  switch (action.type) {
    case 'PLAY_NORMAL':
      return;
    case 'PLAY_JACK_WILD':
      return;
    case 'PLAY_JACK_REMOVE':
      return;
    case 'EXCHANGE_DEAD':
      return;
    default:
      assertNever(action);
  }
}
```

---

## 3) 응집도(Cohesion)

### 3.1 기능/도메인 기준으로 파일을 묶는다

**규칙**
- “타입별 폴더(components/hooks/utils)”만으로 분리하지 않는다.
- 로비/게임/공통 같이 **기능 단위로 묶고**, 공유가 검증되면 공통으로 승격한다.

**권장 구조 예시**
```txt
src/
  app/
    page.tsx
    lobby/[code]/page.tsx
    game/[roomId]/page.tsx

  features/
    lobby/
      components/
      hooks/
      model/
      index.ts
    game/
      components/
      hooks/
      model/
      index.ts

  domain/
    rules/
    cards/

  repositories/
  shared/
    ui/
    utils/
```

---

### 3.2 상수는 “연관된 로직” 근처에 둔다

**규칙**
- `constants.ts`를 무한정 키우지 않는다.
- 예: 보드 관련 상수는 `domain/board/constants.ts` 같은 식으로 붙인다.

---

### 3.3 폼 검증은 요구사항에 맞게 응집도를 선택한다

**규칙**
- 단일 필드(닉네임 등) 중심이면 field-level로 단순하게.
- 여러 필드가 서로 영향을 주면 zod 같은 schema 기반으로 form-level로.

---

## 4) 결합도(Coupling)

### 4.1 중복 제거는 "나중"에 한다(성급한 추상화 금지)

**규칙**
- 서로 다른 화면에서 비슷해 보이는 코드가 있어도, 요구사항이 갈릴 가능성이 있으면 그대로 둔다.
- 최소 2~3회 재사용이 검증되면 공통화한다.

---

### 4.2 전역 상태는 “얇게”, 훅은 “작게”

**규칙**
- Zustand(또는 Context) 사용 시, **큰 스토어 하나에 모든 것을 넣지 않는다**.
- selector 훅으로 필요한 조각만 구독한다.

**예시**
```ts
// store에서 필요한 값만 선택하는 훅
export const useTxPending = () => useGameStore((s) => s.txPending);
export const useSelectedCard = () => useGameStore((s) => s.selectedCard);
```

---

### 4.3 Props drilling 대신 Composition/Context를 사용

**규칙**
- 2단계 이상 내려가는 props 전달은 경고 신호다.
- `RoomProvider` 같은 컨텍스트로 해결하거나, 컴포지션으로 트리를 평평하게 만든다.

---

## 5) Next.js(App Router) 추가 규칙

### 5.1 `'use client'`는 최소한으로
- Firebase 클라이언트 SDK를 쓰는 컴포넌트만 client로 둔다.
- 가능하면 페이지는 얇게 유지하고, 실제 UI를 client 컴포넌트로 분리한다.

### 5.2 라우트 세그먼트별 로컬 컴포넌트는 동봉(Colocation)
- 특정 라우트에서만 쓰는 컴포넌트는 해당 기능 폴더(또는 route 내부 `_components`)에 둔다.
- 공유가 확정되면 `shared/ui`로 승격.

---

## 6) TailwindCSS 규칙(요약)

- `cn()` 유틸(= `clsx` + `tailwind-merge`)로 클래스 결합.
- 반복되는 UI 패턴은 컴포넌트화(`Chip`, `CardTile`, `Badge`).
- 임의 값(`w-[37px]`) 남발 금지. 토큰/스케일 우선.

---

## 7) PR/리뷰 체크리스트

- [ ] 중첩 삼항/거대한 `if` 덩어리가 없다(분리했는가?)
- [ ] 매직 넘버를 상수로 치환했는가?
- [ ] 훅 반환 shape가 표준화되어 있는가?
- [ ] 도메인 로직이 UI에 섞이지 않았는가?
- [ ] props drilling이 과하지 않은가?
- [ ] Firestore 구독/업데이트 경로가 명확한가(repository/훅로 정리)
