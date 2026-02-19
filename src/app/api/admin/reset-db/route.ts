import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function verifyPassword(body: unknown): string | null {
  if (!ADMIN_PASSWORD) return null;
  if (body == null || typeof body !== "object" || !("password" in body)) return null;
  const p = (body as { password?: unknown }).password;
  return typeof p === "string" && p === ADMIN_PASSWORD ? p : null;
}

/**
 * roomCodes 전체, rooms 전체(및 서브컬렉션) 삭제.
 * FIREBASE_SERVICE_ACCOUNT_KEY, ADMIN_PASSWORD 환경변수 필요.
 */
export async function POST(request: Request) {
  if (!verifyPassword(await request.json().catch(() => null))) {
    return NextResponse.json(
      { error: "비밀번호가 일치하지 않거나 설정되지 않았습니다." },
      { status: 401 }
    );
  }

  try {
    const db = getAdminDb();
    const roomCodesRef = db.collection("roomCodes");
    const roomsRef = db.collection("rooms");
    await db.recursiveDelete(roomCodesRef);
    await db.recursiveDelete(roomsRef);
    return NextResponse.json({ ok: true, message: "DB 초기화가 완료되었습니다." });
  } catch (err) {
    const message = err instanceof Error ? err.message : "DB 초기화 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
