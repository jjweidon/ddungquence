import { signInAnonymously } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";

/**
 * 앱 진입 시 자동 익명 로그인을 수행합니다.
 * 이미 로그인된 사용자는 그대로 두고, 로그인되지 않은 사용자만 익명으로 signIn합니다.
 * @returns 로그인된 사용자의 uid
 */
export async function ensureAnonAuth(): Promise<string> {
  const auth = getFirebaseAuth();
  const { currentUser } = auth;

  if (currentUser) {
    return currentUser.uid;
  }

  const { user } = await signInAnonymously(auth);
  return user.uid;
}
