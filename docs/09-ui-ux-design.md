# 09. UI/UX & 디자인 컨셉

## 0) 브랜드 개요

- 프로젝트명: **뚱퀀스**
- 영문 표기(브랜드): **DdungQuence**
- 한 줄 설명(앱/랜딩용):
  - **“5줄을 완성하는 온라인 보드게임”**
  - **“칩으로 라인을 잇는 5-in-a-row”**
- 브랜드 키워드: **카드 테이블 / 미니멀 / 선명한 대비 / 속도감 있는 턴 플레이**

> 디자인 방향은 “트럼프 카드(블랙/화이트/레드) + 포커칩(차콜)” 무드로 고정한다.

---

## 1) 로고 시스템

### 1.1 로고 컨셉: **Chip + 5 Lines**
- 심볼은 **포커칩(원형)**을 기반으로 하고,
- 중앙에 **5개의 직선 라인**을 배치해 “5-in-a-row(승리 라인)”를 즉시 연상시키는 구조로 설계한다.
- 라인은 기본적으로 **대각(\)** 방향을 1순위로 권장한다(승리 라인의 역동성 + 카드 테이블 감성).

### 1.2 로고 구성 요소
- **Primary Mark(심볼)**: 칩 + 5라인
- **Lockup(조합형)**:
  - `뚱퀀스` (메인 워드마크) + `DdungQuence` (서브)
  - 상황에 따라 영문 단독(`DdungQuence`) 사용 가능

### 1.3 권장 시안(초기 기본값)
- 마크(심볼): **`mark02_slash5_ridges`**
  - 칩의 리지(세그먼트)가 카드/카지노 무드를 강화
- 앱 아이콘: **`appicon01_primary_charcoal`**
  - 작은 사이즈에서 식별성이 안정적

> 로고 시안 파일은 별도 ZIP(`ddungquence_logos.zip`)로 제공하며, 최종 채택 후 `public/brand/`로 옮겨 관리한다.

### 1.4 세이프 에어리어 & 최소 크기(실무 기준)
- 세이프 에어리어: **마크 외곽 원 반지름의 12%** 이상 여백 유지
- 최소 크기:
  - Favicon/작은 UI: **24px 이상** 권장 (`mark01_slash5_flat` 같은 단순 마크가 유리)
  - 앱 아이콘/스플래시: **512px~1024px** 사용

### 1.5 Do / Don’t
- Do
  - 다크 배경에서는 **화이트 텍스트 + 레드 포인트**로 대비 확보
  - 마크는 가능한 **단색 배경(블랙/차콜/오프화이트)** 위에 사용
- Don’t
  - 마크를 임의로 비율 왜곡(늘리기/찌그러뜨리기) 금지
  - 레드 라인의 각도/개수 변경 금지(브랜드 핵심 메타포)

---

## 2) 컬러 시스템

### 2.1 베이스 팔레트(고정)
- **DQ Black**: `#0B0B0F`
- **DQ Charcoal**: `#1A1D24`
- **DQ Charcoal Deep**: `#111318`
- **DQ White**: `#F8FAFC`
- **DQ Red (Primary)**: `#D61F2C`
- **DQ Red Dark**: `#A0121C`
- **DQ Red Light**: `#FF4D5A`
- **DQ Blue** (팀 2): `#2563EB` (또는 유사 블루)
- **DQ Green** (팀 3): `#16A34A` (또는 유사 그린)

### 2.2 UI 토큰(권장 매핑)
- Background (앱 바탕): `DQ Charcoal Deep`
- Surface (패널/카드): `DQ Charcoal`
- Surface Alt (보조 패널): `DQ Black`
- Text Primary: `DQ White`
- Text Muted: `DQ White` 70% (`/70`)
- Border/Subtle: `DQ White` 10~14% (`/10 ~ /14`)
- Primary Action: `DQ Red`
- Focus/Selection: `DQ Red Light` (외곽 글로우/링)
- Danger/Remove: `DQ Red Dark`

### 2.3 팀 칩 컬러(배정 순서 고정)
> 베이스 팔레트를 유지하면서 “팀 구분”은 **색 + 패턴** 조합으로 해결한다(색각 배려).

**팀 색상 풀**: **레드(Red) · 블루(Blue) · 그린(Green)** 세 가지.  
**배정 순서**: 처음 배정되는 팀은 **레드**, 그 다음 팀은 **블루**, 그 다음 팀은 **그린**이다.
- 1번 팀 → **레드** (Red Chip)
- 2번 팀 → **블루** (Blue Chip)
- 3번 팀 → **그린** (Green Chip)

> UI 버튼/패널에 팀 색상을 섞지 않는다. **팀 색상은 “칩/배지/미니 인디케이터”에만 제한적으로 사용**한다.  
> (버튼 컬러가 팀 색상과 섞이면 “내 팀이 유리/불리” 같은 오해를 만들고, 화면이 쉽게 지저분해진다.)

### 2.4 Tailwind 설정 예시(브랜드 컬러 고정 등록)
`tailwind.config.ts`에 브랜드 컬러를 고정 등록한다.

```ts
// tailwind.config.ts (발췌)
export default {
  theme: {
    extend: {
      colors: {
        dq: {
          black: "#0B0B0F",
          charcoal: "#1A1D24",
          charcoalDeep: "#111318",
          white: "#F8FAFC",
          red: "#D61F2C",
          redDark: "#A0121C",
          redLight: "#FF4D5A",
          blue: "#2563EB",
          green: "#16A34A",
        },
      },
    },
  },
}
```

### 2.5 컴포넌트 컬러 규칙(고정)
- **페이지 배경**: `bg-dq-charcoalDeep` 고정 (라이트 배경 금지)
- **패널/카드**: `bg-dq-charcoal` + `border border-white/10` + `rounded-2xl`
- **보조 패널**: `bg-dq-black` + `border-white/10`
- **CTA(가장 중요한 버튼)**: `bg-dq-red text-dq-white` (게임/로비 공통)
- **선택/포커스/현재 턴 강조**: `ring-dq-redLight` (링/글로우만 사용, 면적 큰 배경 채색 금지)
- **Ready/성공 상태**: `dq.green`은 **배지/아이콘**으로만 사용 (버튼 전체 배경으로 사용 금지)
- **주의/오류/삭제**: `dq.redDark` (강조 영역 최소)
- 금지
  - 임의의 그라데이션/파스텔 배경
  - 텍스트 대비가 무너지는 투명도(특히 `white/40` 이하 텍스트 금지)

---

## 3) 타이포그래피

### 3.1 폰트 전략(Next.js 권장)
- 메인(UI/한글): **Noto Sans KR**
- 라틴/숫자(기본): **Inter**
- 코드/룸 코드/카드 코드(고정폭): **JetBrains Mono**

> MVP에서는 `next/font/google`로 Inter + Noto Sans KR만 적용해도 충분하다.  
> 룸 코드/로그는 `font-mono`로 JetBrains Mono를 붙인다.

### 3.2 타입 스케일(권장)
- Display(로고/타이틀): 32~40px, `font-black` 또는 `font-extrabold`
- Heading: 18~24px, `font-bold`
- Body: 14~16px, `font-medium`/`font-normal`
- Caption/Meta: 12~13px

### 3.3 톤(문장 스타일)
- 버튼/라벨: 짧게, 동사로 끝내기 (예: “참가”, “준비”, “확정”, “취소”)
- 안내 문구: 1~2문장, 핵심만 (예: “내 턴이 아닙니다.”)

---

## 4) 앱 아이콘 방향

### 4.1 기본 컨셉
- 배경: **Charcoal Deep**
- 중앙: **Primary Mark(칩 + 5라인)**
- 텍스트/글자는 아이콘에 넣지 않는다(작은 사이즈에서 깨짐 + 가독성 저하).

### 4.2 iOS/Android 공통 안전 규칙
- 가장 바깥 요소가 잘리지 않도록 **여백을 충분히** 둔다(마크는 아이콘 폭의 70~75%).
- 대비(명도차)를 최우선. 레드는 “강조”로만 사용하고 면적을 과도하게 넓히지 않는다.

---

## 5) UI/UX 목표(게임 플레이)

### 5.1 디자인 목표
- 모바일에서 **보드가 중심**이고, 손패/액션이 자연스럽게 이어지는 턴 기반 UX
- 룰 이해를 돕는 **명확한 하이라이트**(가능 칸, 제거 가능 칸, 시퀀스 완성)
- 라이트/다크 모드 지원(기본: **다크 우선**)

### 5.2 비주얼 컨셉
- 키워드: **tabletop**, **clean**, **tactile**
- 보드: 펠트/테이블 느낌(실제 텍스처 이미지는 추후; MVP는 **단색 + 미세 노이즈**)
- 칩: 팀별 색 + 패턴(색각 배려)
- 강조선(Sequence overlay): **DQ Red** + 얇은 글로우(옵션)

### 5.3 레이아웃/컴포넌트 시스템(공통 규칙)
- 간격 시스템: **8pt 그리드**(8/16/24/32px 단위)
- 라운드: 기본 `rounded-2xl`(16px), 작은 요소 `rounded-xl`(12px)
- 테두리: `border border-white/10` 기본, 강조 시 `ring-2 ring-dq-redLight`
- 그림자: 과한 shadow 금지(카드 테이블 무드 유지). 필요한 경우 아주 약하게만.
- 터치 타겟: 44px 이상(모바일)
- 페이지 컨테이너:
  - 모바일: `px-4 py-4` 기본, 하단 고정 바가 있으면 `pb-[calc(16px+env(safe-area-inset-bottom)+72px)]`
  - 데스크톱: `max-w-7xl mx-auto px-6 py-6`

---

## 6) 화면 구조

### 6.0 앱 접속 배경(랜딩)
앱 접속 시(랜딩 등) 배경 레이어:
- **구성**: 카드 이미지가 **랜덤한 순서**로 배열되어, **대각선 방향**으로 **2줄**을 이루며 **천천히 무한 슬라이드**
- **핵심**: 슬라이드가 **끊김 없이** 연속되어야 함(루프 시 시각적 튐/깜빡임 없음)

#### 기술 구현

1. **무한 루프(끊김 없음)**
   - **방법**: 동일한 카드 시퀀스를 **2회 이상 복제**하여 나란히 배치. 뷰포트 기준 한 복제분이 완전히 스크롤 아웃될 때, `transform`을 **즉시 0으로 리셋**한다. 이 시점에는 두 번째 복제분이 첫 번째와 동일한 위치에 있어 사용자는 리셋을 인지하지 못함.
   - 구현: `transform: translateX(...)`를 키프레임 또는 `requestAnimationFrame`으로 증가. 한 복제분 너비(`loopWidth`)만큼 이동했을 때 `translateX(-loopWidth)` → `translateX(0)`으로 순간 이동(이미 화면 밖이므로 시각적 점프 없음).
   - **주의**: 복제 개수·루프 타이밍이 어긋나면 끊김이 보일 수 있음. `loopWidth`를 정확히 복제본 1개 분량으로 맞추고, 리셋 시점을 ±1px 오차 없이 맞출 것.

2. **대각선 2줄**
   - 상단 줄·하단 줄 각각 별도 트랙으로 두고, 두 줄 모두 같은 방향/속도로 슬라이드(또는 약간 오프셋).
   - 대각선 느낌: `transform: rotate(-3deg)`(또는 2~5deg)로 전체를 기울이거나, 각 카드에 `translateX` + `translateY`를 주어 지그재그 배치.

3. **랜덤 순서**
   - 마운트 시 보드용 카드 ID(또는 서브셋)를 **셔플**(Fisher-Yates 등). 이 순서를 두 줄에 동일 적용하거나, 줄마다 별도 셔플. 재접속 시 새로운 랜덤은 허용(또는 세션 스토리지로 고정).

4. **성능**
   - `will-change: transform` 또는 `transform: translateZ(0)`으로 GPU 레이어 사용.
   - 카드 이미지는 `preload` 또는 한 번에 로드. SVG/WebP 사용(05 문서 카드 규격).
   - 애니메이션은 **transform만** 사용(레이나우트·리페인트 최소화).

5. **권장 구조(예시)**
   ```
   [컨테이너 overflow:hidden]
     [트랙 wrap, width: 200%+ 이상]
       [복제1: 카드1, 카드2, ... 카드N]  // 루프 폭 = 이 너비
       [복제2: 카드1, 카드2, ... 카드N]  // 동일
     [/트랙]
   [/컨테이너]
   ```
   - CSS `animation` 사용 시: `@keyframes slide { 0% { transform: translateX(0) } 100% { transform: translateX(-50%) } }` + `animation: slide 60s linear infinite` (50% = 복제 1개 분량 가정).
   - 또는 JS로 `requestAnimationFrame` + `translateX` 증가 → `translateX >= loopWidth`이면 `translateX -= loopWidth` 한 번에 보정.

---

### 6.1 Landing
- 닉네임 입력
- 방 코드 입력 + 참가
- 새 방 만들기

---

### 6.2 Lobby (route: `/lobby/[code]`) — **상세 레이아웃 가이드(필수 준수)**

#### 6.2.1 화면 목표
- 유저가 **1) 방 코드 확인/복사 → 2) 팀 선택 → 3) 준비/시작** 흐름을 10초 내 완료할 수 있어야 한다.
- “참여자/관전자” 영역이 명확히 분리되어야 한다(텍스트만 바뀌는 수준 금지).

#### 6.2.2 모바일 레이아웃(세로, 기본)
**구조**: 상단 정보 → 리스트 → 하단 액션(고정)

1) **RoomHeader 카드(상단)**
- 내용: `방 코드(대문자/모노)` + `복사 버튼` + `연결 상태 배지(syncing/offline)`
- 룸 코드는 `font-mono text-xl tracking-[0.2em]`로 “코드”임이 즉시 보이게 한다.

2) **PlayerSection 카드**
- 참여자 리스트(최대 4명): 행 단위로 고정
- 행 구성: `칩(팀 컬러)` + `닉네임` + `HOST/ME` 배지 + `READY` 배지
- 턴/호스트 같은 강조는 **배지/링**으로만 처리(면적 큰 배경색 금지)

3) **SpectatorSection 카드**
- 관전자 리스트(최대 2명): 참여자와 다른 카드로 분리
- 관전자에게는 “참여하기” CTA를 노출(자리 남을 때만)

4) **ActionBar(하단 고정)**
- 참여자: `팀 선택(세그먼트/칩 카드)` + `준비(Primary)`  
- 관전자: `참여하기(Secondary)`  
- 호스트: `게임 시작(Primary)`는 **참여자 전원 READY일 때만 활성화**
- 모바일에서는 ActionBar를 `sticky bottom-0` 또는 `fixed bottom-0`로 고정하고 safe-area를 반드시 반영한다.

#### 6.2.3 데스크톱 레이아웃(가로, `lg` 이상)
**구조**: 좌측(리스트) + 우측(설정/액션)

- 좌측: `RoomHeader` + `PlayerSection` + `SpectatorSection`을 세로 스택
- 우측: `TeamPicker` + `Primary Actions` + `도움말(룰 요약/진행 상태)`
- 우측 하단에 CTA를 두되, **페이지 하단까지 내려가야 보이는 배치 금지** (스크롤 없이 즉시 접근)

권장 그리드(예):
- `grid grid-cols-[420px_1fr] gap-6`
- 좌측 컬럼 고정, 우측은 여유 폭

#### 6.2.4 버튼/색상 규칙(로비)
- Primary(빨강): `준비`, `게임 시작`
- Secondary(중립): `관전하기`, `참여하기`, `나가기(있다면)`
- Ready 상태는 “버튼 컬러 변경”보다 **READY 배지 + 체크 아이콘**으로 표현한다.
- 팀 선택 UI는 “칩 카드” 형태로:
  - 선택 전: `bg-dq-black border-white/10`
  - 선택 후: `ring-2 ring-dq-redLight`

#### 6.2.5 Lobby 컴포넌트 트리(권장)
- `<LobbyPage>`
  - `<RoomHeader />`
  - `<PlayerSection />`
  - `<SpectatorSection />`
  - `<ActionBar />`

---

### 6.3 Game — **상세 레이아웃 가이드(필수 준수)**

#### 6.3.0 와이어프레임(참고)
- 모바일 와이어프레임: `./assets/wireframes/game-mobile-wireframe.png`
- 데스크톱 와이어프레임: `./assets/wireframes/game-desktop-wireframe.png`

#### 6.3.1 공통 목표
- 보드는 항상 **화면의 시각적 중심(가장 큰 면적)**.
- 플레이어가 “내 턴/상대 턴”을 1초 안에 인지해야 한다.
- 실수 방지: 기본은 **선택 → 확정**(즉시 실행 금지).

#### 6.3.2 모바일 레이아웃(세로, 기본) — 첨부 와이어프레임 준수
**구조**: 상단(덱+플레이어 스트립) → 보드 → 손패 → CTA(하단)

1) **TopStatus(상단)**
- 좌측: Deck 아이콘 + 남은 카드 수(또는 “덱” 라벨)
- 우측: `TurnBadge`(현재 턴 플레이어 닉네임/팀) + `syncing/offline`
- 높이 56px 내로 고정(너무 두껍게 만들지 않는다)

2) **PlayerStrip(가로 리스트)**
- 4명 기준: 가로로 4개가 딱 들어가면 스크롤 없이 노출
- 각 아이템: `칩(팀)` + `닉네임`
- 내 플레이어는 `ME` 배지(작게)
- 현재 턴 플레이어는:
  - 아이템에 `ring-2 ring-dq-redLight`
  - 하단에 작은 `TURN` 배지(텍스트)

3) **Board(중앙)**
- `aspect-square` 유지
- 화면 폭의 100%를 쓰되, 좌우 `px-4` 여백 유지
- 보드 위에는 불필요한 텍스트/버튼 금지(보드가 중심)

4) **HandBar(하단, “My Card”)**
- 기본 6장: `grid grid-cols-6 gap-2` 또는 폭이 좁으면 `flex overflow-x-auto`로 처리
- 선택된 카드는 `ring-2 ring-dq-redLight` + `bg-dq-black`로 명확히

5) **Primary CTA(하단)**
- 기본 라벨: “카드 놓기”
- 위치: 화면 하단 고정(`sticky`/`fixed`)
- 높이: 56~64px, 폭: `w-full`(모바일)
- 비활성 조건: `notYourTurn`, `txPending`, `offline`, `선택 미완료` 등

#### 6.3.3 데스크톱 레이아웃(`lg` 이상) — 첨부 와이어프레임 준수
**구조**: 좌측 Player List + 중앙 Board + 우측 Side Panel(Deck/Hand/CTA)

- 좌측(Player List Panel)
  - 폭 260~320px
  - 플레이어 행 구성:
    - `칩(팀)` + `닉네임` + `ME/HOST/READY` 배지
    - 현재 턴 행: `bg-dq-red/10`(작게) + `ring-dq-redLight`(또는 left bar)
- 중앙(Board)
  - 최대한 크게, 화면 중앙 정렬
  - `max-w-[720px]` 정도를 상한으로 두고(과대 확대 방지) `aspect-square`
- 우측(Side Panel)
  - 상단: Deck(스택 + 카운트)
  - 중단: My Card(2x3 그리드 기본)
  - 하단: Primary CTA(큰 버튼)

권장 그리드(예):
- `grid grid-cols-[300px_minmax(520px,1fr)_360px] gap-6`

#### 6.3.4 참여자 vs 관전자 UI 차이(고정)
- 참여자:
  - HandBar 노출
  - CTA 노출
  - “퇴장 버튼” **없음**(문서 정책 유지: 연결 끊김으로만 퇴장)
- 관전자:
  - HandBar/CTA **숨김**
  - 우측/상단에 “퇴장” 버튼 제공
  - 선택/확정 UX 없음(보드 조작도 금지)

#### 6.3.5 보드/선택 하이라이트 규칙(게임)
- 가능한 칸(Place 가능): `outline`보다 `ring` 우선
  - 예: `ring-2 ring-dq-redLight/70` + `shadow-[0_0_0_2px_rgba(...)]` 같은 과한 효과 금지
- 잭(제거 가능) 대상: 상대 칩에만 `ring-dq-redLight`, 완성 시퀀스 칩에는 `lock` 아이콘
- 선택 상태는 “색 채우기”보다 **링/외곽선**으로 표현한다.

---

### 6.4 End
- 승리 팀 표시
- 리매치(선택), 로비로(선택)

---

## 7) 핵심 인터랙션

### 7.1 손패 → 보드
1) 카드 탭  
2) 보드에서 가능한 칸만 하이라이트  
3) 칸 탭 → “확정” 버튼(실수 방지)  
4) 확정 시 로딩/잠금 → 완료 후 자동 해제

> 모바일 실수(오탭) 방지를 위해 “즉시 실행”보다 “선택→확정”이 안정적이다.

### 7.2 잭(제거)
- 제거 가능한 상대 칩만 하이라이트
- 완성 시퀀스 칩은 잠금 아이콘 표시(제거 불가)

### 7.3 시퀀스 완성 피드백
- 완성된 5칸을 라인으로 오버레이(색/패턴)
- 점수 카운터 애니메이션(가볍게)

---

## 8) 보드 UI 구현 가이드(Tailwind)

- `10x10` Grid
- cell 컴포넌트는 `memo`로 최적화
- 칩/오버레이는 absolute 레이어로 분리

### 추천 컴포넌트 트리
- `<GamePage>`
  - `<TopStatus />`
  - `<PlayerStrip />` (모바일) / `<PlayerListPanel />` (데스크톱)
  - `<BoardCanvas />`
    - `<BoardCell />` x 100
    - `<ChipLayer />`
    - `<SequenceOverlay />`
  - `<HandPanel />` (참여자만)
  - `<PrimaryActionBar />` (참여자만)
  - `<SpectatorExit />` (관전자만)

---

## 9) 반응형(고정 규칙)
- 모바일(기본): **세로 스택 + 하단 CTA 고정**
- 데스크톱(`lg` 이상): **3열(플레이어/보드/사이드패널)** 고정
- 태블릿(`md`~`lg`): 모바일 레이아웃을 유지하되 HandBar는 2줄(또는 가로 스크롤)로 허용

---

## 10) 상태별 UI 정책
- `syncing`: 상단에 “동기화 중…” 배지
- `txPending`: 보드/손패 인터랙션 잠금 + 스피너
- `notYourTurn`: 손패 비활성 + “상대 턴” 안내
- `offline`: 턴 액션 금지(버튼 disabled)

---

## DoD 체크리스트(업데이트)
- [ ] Game: 모바일/데스크톱 레이아웃이 첨부 와이어프레임 구조를 유지한다
- [ ] Lobby: 방 코드/복사/리스트/액션이 “정보 → 리스트 → 하단 액션” 흐름으로 정리되어 있다
- [ ] CTA는 항상 화면에서 즉시 접근 가능하며, 스크롤 하단으로 숨지 않는다
- [ ] 팀 색상은 칩/배지에만 쓰고, 버튼/패널 배경에 섞지 않는다
- [ ] 선택 가능한 칸/불가능한 칸이 링 기반으로 명확히 구분된다
- [ ] 내 턴이 아닐 때 조작이 차단된다
- [ ] 다크 모드에서 텍스트 대비(가독성)가 충분하다
