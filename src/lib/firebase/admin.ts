import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let adminApp: App | null = null;

/**
 * 서버 전용 Firebase Admin SDK.
 * 환경변수 FIREBASE_SERVICE_ACCOUNT_KEY(JSON 문자열) 필요.
 */
function getAdminApp(): App {
  if (adminApp) return adminApp;
  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!key) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_KEY가 설정되지 않았습니다. Firebase 콘솔에서 서비스 계정 키 JSON을 내려받아 환경변수에 넣어주세요."
    );
  }
  const credential = cert(JSON.parse(key) as Record<string, string>);
  if (getApps().length > 0) {
    adminApp = getApps()[0] as App;
    return adminApp;
  }
  adminApp = initializeApp({
    credential,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
  return adminApp;
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
