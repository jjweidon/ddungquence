# 뚱퀀스(DdungQuence) 구현 문서 모음

> 스택: Next.js(App Router) + TypeScript + TailwindCSS + Firebase(무료 구간 최대 활용) + Vercel

## 목적
- Cursor 기반 바이브코딩을 빠르게 진행할 수 있도록 **요구사항/설계/컨벤션/로드맵**을 사전 정리한다.
- 자체 서버 없이 Firebase(BaaS)로 **턴 기반 실시간 동기화**를 구현한다.
- 원작 보드게임(Sequence 계열)의 플레이 경험을 “친구 모임용 온라인”으로 재구성한다.  
  (브랜드/명칭/아트워크는 별도 관리 필요)

## 문서 목록
- [00. 프로젝트 개요](./00-overview.md)
- [01. 게임 규칙 정리](./01-game-rules.md)
- [02. 기능적 요구사항](./02-functional-requirements.md)
- [03. 비기능적 요구사항](./03-nonfunctional-requirements.md)
- [04. 아키텍처](./04-architecture.md)
- [05. 데이터 모델 & ERD](./05-data-model-erd.md)
- [06. Firebase 설정](./06-firebase-setup.md)
- [07. Firestore Security Rules](./07-firestore-security-rules.md)
- [08. 상태/액션 프로토콜](./08-state-and-actions.md)
- [09. UI/UX & 디자인 컨셉](./09-ui-ux-design.md)
- [10. 로드맵](./10-roadmap.md)
- [11. 코드 컨벤션](./11-code-conventions.md)
- [12. Git 컨벤션](./12-git-conventions.md)
- [13. 테스트 전략](./13-testing-strategy.md)
- [14. 배포(Vercel)](./14-deployment-vercel.md)
- [15. 관측성(로그/모니터링)](./15-observability.md)
- [16. 리스크 & 의사결정 기록](./16-risk-and-decisions.md)
- [17. Cursor 프롬프트 팩](./17-cursor-prompts.md)
- [18. 보드 레이아웃](./18-board-layout.md)
