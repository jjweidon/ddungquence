# 15. 관측/로그/분석(선택)

## 1) 목표
- 디버깅 가능(왜 동기화가 꼬였는지, 어떤 액션이 실패했는지)
- 비용 감시(무료 구간 초과 징후 조기 탐지)

## 2) 앱 레벨 로깅
- 개발 모드:
  - 마지막 public state(version/turn/currentUid) 표시
  - 마지막 제출 액션 payload 표시
- 프로덕션:
  - 사용자 노출 최소(토스트 수준)
  - PII 저장 금지

## 3) 오류 추적(P1)
- Sentry 도입 시:
  - transaction 실패/권한 오류/네트워크 오류 수집
  - roomId, version, actionType만 context로 첨부(개인정보 제외)

## 4) 이벤트 로그(선택)
- `rooms/{roomId}/events`에 최근 N턴만 저장(roll-up)
- 구독은 기본 OFF. 필요 시 디버그 토글로 ON.

## 5) 비용 점검 루틴
- Firebase Console에서 Firestore 사용량(Reads/Writes/Storage)을 주기적으로 확인
- 이상 징후:
  - Reads가 턴 수 대비 과도하게 증가(구독 문서/쿼리 폭발)
  - presence 업데이트가 과도한 빈도로 동작

## DoD 체크리스트
- [ ] 장애 상황에서 원인 파악을 위한 최소 로그가 남는다
- [ ] 구독 문서 수와 턴당 write 횟수를 쉽게 확인할 수 있다
