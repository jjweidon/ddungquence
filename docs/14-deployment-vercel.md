# 14. Vercel 배포

## 1) Vercel 프로젝트 생성
- GitHub 레포 연결 → Import
- Framework: Next.js 자동 인식

## 2) Environment Variables
Vercel Project Settings → Environment Variables에 다음을 등록:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

## 3) Firebase Auth Authorized Domains
Firebase Console → Authentication → Settings → Authorized domains에:
- 로컬 개발: `localhost`
- Vercel 프리뷰/프로덕션 도메인 추가(예: `your-app.vercel.app`)
- 커스텀 도메인 사용 시 해당 도메인도 추가

## 4) 빌드/런타임
- 기본은 `next build` / `next start`(Vercel이 자동)
- 서버리스 함수는 사용하지 않는 방향(비용/복잡도 최소화)

## 5) PWA(선택)
- MVP에서는 생략 가능
- 도입 시:
  - manifest/아이콘
  - 서비스워커(캐시 전략)
  - 오프라인 UX 정책(턴 액션 금지)

## 6) DoD 체크리스트
- [ ] Vercel 배포 후 Google 로그인 및 Firestore 연결 정상
- [ ] iOS Safari에서도 기본 플로우가 동작
