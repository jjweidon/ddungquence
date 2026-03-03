# 21. PWA(Progressive Web App) — 모바일 앱처럼 사용

> 홈 화면 추가 시 standalone 실행, 주소창/상태바 테마 색상 적용.

---

## 구성

- **manifest**: `src/app/manifest.ts` — 앱 이름, 아이콘, `display: standalone`, `theme_color`/`background_color` (DQ Charcoal Deep `#111318`).
- **viewport**: `src/app/layout.tsx` — `themeColor`, `viewport` export.
- **서비스 워커**: `public/sw.js` — 최소 구현(설치 가능 조건 충족). 오프라인 캐시 없음.
- **등록**: `src/shared/pwa/register-sw.tsx` — 클라이언트에서 SW 등록.

## 아이콘

- `public/icons/icon-192.png`, `public/icons/icon-512.png` 추가 시 홈 화면/설치 시 사용.
- 없어도 설치·실행 가능(기본 아이콘). 추천: `public/logos/README.md`의 03-app-icons 시안을 192/512로 리사이즈.

## 사용 방법

1. **HTTPS**로 서비스(Vercel 배포 시 자동).
2. 모바일 브라우저에서 사이트 접속 후:
   - **Android/Chrome**: 주소창 또는 메뉴의 "앱 설치" / "홈 화면에 추가".
   - **iOS/Safari**: 공유 버튼 → "홈 화면에 추가".

## 참고

- 푸시 알림·오프라인 캐시는 미구현. 필요 시 Next.js PWA 문서 및 Serwist 등 검토.
