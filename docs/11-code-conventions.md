# 11. 코드 컨벤션

## 1) 기본 원칙
- TypeScript `strict` 유지
- 도메인 로직(UI 비의존)과 Firebase I/O를 분리
- “한 파일 한 책임” + 얇은 컴포넌트 + 두꺼운 도메인

## 2) 폴더 구조(권장)
```
src/
  app/                      # Next.js routes
  components/               # 공용 UI 컴포넌트
  features/
    lobby/                  # 로비 기능(화면/훅/스토어)
    game/                   # 게임 화면(컨테이너/훅)
  domain/
    cards/                  # 카드/덱/셔플
    rules/                  # 잭/데드/시퀀스 판정
    types/                  # 도메인 타입
  repositories/
    roomRepository.ts       # Firestore read/write 추상화
    handRepository.ts
  lib/
    firebase/client.ts
    utils/
```

## 3) 네이밍
- 파일/폴더: `kebab-case`
- 컴포넌트: `PascalCase`
- 훅: `useXxx`
- 타입: `Xxx`, 유니온: `XxxType`

## 4) 타입/스키마
- Firestore 문서 타입은 `type`으로 정의하되, 런타임 검증은 `zod`(P1) 권장
- `unknown` 입력(Firestore snapshot)은 반드시 파싱 후 사용

## 5) React 규칙
- 기본 export 금지(일관성)
- “상태는 가능한 위로 끌어올리지 말고, 도메인/스토어로 내려보내기”
- 보드 Cell은 `React.memo` + stable props로 리렌더 최소화

## 6) 상태관리(권장)
- 전역: Zustand 1개 스토어로 시작(과도한 전역화 금지)
- 서버 상태(Firestore)는 “구독 훅”에서 스토어에 반영

## 7) Tailwind 규칙
- 클래스는 `clsx`/`cn` 유틸로 조합
- 반복 스타일은 컴포넌트로 추상화(`CardTile`, `Chip`, `Badge`)
- 임의 값(예: `w-[37px]`) 남발 금지: 디자인 토큰 우선

## 8) 에러 처리
- repository는 예외 throw
- UI 레이어는 토스트/배너로 사용자 피드백
- transaction 충돌은 “최신 상태 반영 후 재시도 안내”

## 9) 로그
- `console.log`는 개발 모드에서만
- 도메인 로직은 pure 함수 기반으로 로그 최소화

## DoD 체크리스트
- [ ] domain 함수는 UI 없이 단위 테스트가 가능하다
- [ ] Firebase I/O는 repositories로만 접근한다
- [ ] 보드 렌더가 불필요하게 전체 리렌더되지 않는다
