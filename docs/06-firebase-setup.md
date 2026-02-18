# 06. Firebase 설정 가이드

## 1) Firebase 프로젝트 생성
1. Firebase Console에서 프로젝트 생성
2. "웹 앱 추가" → 앱 등록(이름: sequence-web 등)
3. `firebaseConfig` 값 확보(apiKey, authDomain, projectId 등)

## 2) Authentication 설정
- Authentication → Sign-in method → **Google** 활성화
- Google Sign-In은 Spark(무료) 플랜에서 **추가 비용 없음**
- (필수) Google Cloud Console → APIs & Services → OAuth consent screen → User type "External" 선택 후 앱 이름/이메일 등록

## 3) Firestore 설정
- Firestore Database 생성(Production 모드 권장)
- 리전은 사용자 기반 고려(예: asia-northeast3(Seoul) 등)  
  *리전 선택은 변경이 어렵다.*

## 4) (선택) App Check
- 공개 배포 시 남용 방지 용도
- MVP에서는 생략 가능(개발 속도 우선)

## 5) Next.js 환경변수
`.env.local` (로컬) 및 Vercel Project Env에 동일하게 설정:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

> `NEXT_PUBLIC_` 접두사는 클라이언트 번들에 포함되므로 비밀 키를 넣지 않는다.

## 6) Firebase SDK 설치
```bash
npm i firebase
```

## 7) Firebase 초기화 코드(권장 위치)
- `src/lib/firebase/client.ts`

```ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
```

## 8) Google 로그인(클라이언트)
- `src/features/auth/ensureAuth.ts`

```ts
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export function ensureAuth(): Promise<string> {
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      try {
        if (user?.uid) {
          unsub();
          resolve(user.uid);
          return;
        }
        const provider = new GoogleAuthProvider();
        const cred = await signInWithPopup(auth, provider);
        unsub();
        resolve(cred.user.uid);
      } catch (e) {
        unsub();
        reject(e);
      }
    });
  });
}
```

## 9) Firestore 에뮬레이터(권장, P1)
Cursor로 빠르게 돌리려면 에뮬레이터를 켜는 편이 좋다.
- Firebase CLI 설치
- `firebase init emulators`로 Firestore/Auth 설정

## 10) 무료 구간 최적화 팁(실무)
- 개발 중 구독(onSnapshot) 남발 금지: **public 1 + private 1**로 고정
- presence(마지막 접속 시간) 업데이트는 저빈도(예: 30초~60초)로 제한
- 이벤트 로그는 디버깅 시에만 옵션으로 켠다(구독 비용 증가)

## DoD 체크리스트
- [ ] Google 로그인 uid가 정상 발급되고 새로고침 후 유지된다
- [ ] Firestore read/write가 개발 환경에서 정상 동작한다
- [ ] Vercel에 env가 주입되어 배포 후에도 연결된다
