# 03. 비기능 요구사항(NFR)

## NFR-1 성능/반응성
- 모바일에서 **첫 로드 LCP 3초 이내**(중간급 안드로이드 기준)
- 액션 후 **상태 반영 1초 이내**(평균), 3초 초과는 “동기화 지연” UI 표시

**가이드**
- 보드 렌더는 가상화/캔버스 고려(초기 MVP는 CSS Grid + memo 최적화)
- 구독 문서는 최소화(권장: public 1개 + private 1개)

## NFR-2 비용(무료 구간 최적화)
- Firestore Read/Write 폭증 방지:
  - “커서/마우스 이동” 같은 초고빈도 이벤트는 절대 동기화하지 않는다.
  - 게임 상태는 “턴 단위”로만 변경한다.
- 구독 범위:
  - public room doc 1개 구독
  - private hand doc 1개 구독
  - (선택) turn log subcollection은 최근 N개만 페이징/옵션 구독

## NFR-3 신뢰성/일관성
- 핵심 상태 변경은 **Firestore Transaction**으로 처리해 동시 클릭/중복 제출을 방지한다.
- 각 상태 변경은 `version`을 증가시켜 클라이언트가 out-of-order 이벤트를 무시할 수 있게 한다.
- 재접속 시 “현재 스냅샷”을 받아 정확히 복원한다.

## NFR-4 보안/권한
- 읽기 권한:
  - public: 방 참가자만
  - private hand: 해당 uid만(또는 host write-only 허용)
- 쓰기 권한:
  - 로비: host 또는 본인 프로필 영역만
  - 게임: **현재 턴 플레이어만** public game state 업데이트 허용(규칙은 07 문서)

## NFR-5 개인정보/데이터 최소화
- email/전화번호 등 PII는 저장하지 않는다.
- Google uid + 닉네임(자유 텍스트 또는 Google displayName) 사용
- 로그/분석 도입 시 옵트인(선택)

## NFR-6 접근성
- 색상만으로 팀을 구분하지 않는다(아이콘/패턴 병행)
- 색각 보정 모드(P1): 고대비 팔레트, 형태 마커 제공
- 버튼/터치 타겟 44px 이상

## NFR-7 호환성
- iOS Safari, Android Chrome 최신 2개 메이저 버전 지원
- PWA 설치 가능(홈 화면 추가)

## NFR-8 관측/디버깅
- 오류: Sentry(또는 대안) 도입(P1)
- 상태: 개발 모드에서 room state JSON을 보기 쉽게 출력(디버그 패널)

## NFR-9 유지보수성
- 도메인 로직(규칙 엔진)은 UI와 분리(`src/domain`)
- Firestore 접근은 repository 계층으로 추상화(`src/repositories`)
- 스키마 변경은 마이그레이션 문서화(16 문서)

## DoD 체크리스트
- [ ] “턴 단위 갱신”만으로 게임이 진행된다(고빈도 동기화 없음)
- [ ] 손패/덱이 public에 노출되지 않는다
- [ ] 트랜잭션 충돌/재시도 시 UX가 안전하다(중복 배치 없음)
