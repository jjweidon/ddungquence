# 12. Git 컨벤션

## 1) 브랜치 전략(단순)
- `main`: 항상 배포 가능한 상태
- `dev`: 통합 브랜치(선택)
- 기능 브랜치: `feat/<topic>`
- 버그 수정: `fix/<topic>`
- 문서: `docs/<topic>`
- 리팩터: `refactor/<topic>`

예:
- `feat/lobby-room-create`
- `fix/sequence-detect-diagonal`

## 2) 커밋 메시지(Conventional Commits)
- **커밋 메시지는 한글로 작성**한다.

형식:
```
<type>(scope): <제목>

[본문(선택)]
```

- **제목**: 한 줄로 변경 내용을 요약. 50자 내외 권장.
- **본문**: 변경 사항이 **많을 때**에는 본문을 작성한다. 짧은 변경이면 **제목만** 써도 된다.
  - 무엇을/왜 바꿨는지, 주의사항이 있으면 본문에 적는다.

type:
- `feat`: 기능
- `fix`: 버그
- `docs`: 문서
- `refactor`: 리팩터(기능 변경 없음)
- `test`: 테스트
- `chore`: 빌드/도구/설정
- `perf`: 성능 개선

예(제목만):
- `feat(lobby): 방 생성 시 roomCodes 매핑 추가`
- `fix(game): one-eyed jack으로 완성 시퀀스 칩 제거 불가 처리`
- `docs: Firebase 설정 가이드 추가`

예(제목 + 본문, 변경이 많을 때):
- `refactor(board): 보드 레이아웃을 상수 JSON으로 분리`
  - 01 boardImages 내용을 board-layout.json으로 이동
  - 클라이언트는 JSON만 로드하도록 변경
  - 카드 ID 규격 정리(05 문서)

## 3) PR 규칙
- PR은 “작게” (리뷰/리버트 쉬움)
- PR 제목은 커밋 타입과 유사하게
- PR 템플릿(권장)

```md
## 변경 요약
-

## 체크리스트
- [ ] UI 스크린샷(변경 시)
- [ ] Firestore 규칙/스키마 변경 시 문서(16번) 업데이트
```

## 4) 릴리즈/버전
- MVP 전까지는 태그 생략 가능
- 공개 배포 시 `v0.1.0`, `v0.2.0`처럼 시멘틱 버전 사용

## DoD 체크리스트
- [ ] main은 항상 빌드/배포 가능
- [ ] 스키마 변경은 문서/마이그레이션 로그에 남는다
