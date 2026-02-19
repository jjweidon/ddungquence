import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

/** 로비 방: 이 시간(ms) 이상 updatedAt이 지나면 미사용으로 간주 */
const LOBBY_STALE_MS = 24 * 60 * 60 * 1000; // 24시간
/** ended 방: 이 시간(ms) 이상 updatedAt이 지나면 정리 대상 */
const ENDED_STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7일

function verifyPassword(body: unknown): string | null {
  if (!ADMIN_PASSWORD) return null;
  if (body == null || typeof body !== "object" || !("password" in body)) return null;
  const p = (body as { password?: unknown }).password;
  return typeof p === "string" && p === ADMIN_PASSWORD ? p : null;
}

/**
 * 사용되지 않는 게임룸·roomCodes 정리.
 * - 로비(status=lobby): updatedAt이 24시간 이전인 방
 * - 종료(status=ended): updatedAt이 7일 이전인 방
 * playing 중인 방은 건드리지 않음.
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
    const now = Date.now();
    const lobbyCutoff = Timestamp.fromMillis(now - LOBBY_STALE_MS);
    const endedCutoff = Timestamp.fromMillis(now - ENDED_STALE_MS);

    const roomsRef = db.collection("rooms");
    const lobbySnap = await roomsRef
      .where("status", "==", "lobby")
      .where("updatedAt", "<", lobbyCutoff)
      .get();
    const endedSnap = await roomsRef
      .where("status", "==", "ended")
      .where("updatedAt", "<", endedCutoff)
      .get();

    const toDelete: { roomId: string; roomCode: string }[] = [];
    lobbySnap.docs.forEach((d) => {
      const data = d.data();
      const code = data.roomCode as string | undefined;
      if (code) toDelete.push({ roomId: d.id, roomCode: code });
    });
    endedSnap.docs.forEach((d) => {
      const data = d.data();
      const code = data.roomCode as string | undefined;
      if (code) toDelete.push({ roomId: d.id, roomCode: code });
    });

    let deletedRooms = 0;
    let deletedCodes = 0;

    for (const { roomId, roomCode } of toDelete) {
      const roomRef = db.collection("rooms").doc(roomId);
      const codeRef = db.collection("roomCodes").doc(roomCode.trim().toUpperCase());

      const codeSnap = await codeRef.get();
      if (codeSnap.exists) {
        await codeRef.delete();
        deletedCodes += 1;
      }
      await db.recursiveDelete(roomRef);
      deletedRooms += 1;
    }

    return NextResponse.json({
      ok: true,
      message: "미사용 룸 정리가 완료되었습니다.",
      deletedRooms,
      deletedCodes,
      lobbyCandidates: lobbySnap.size,
      endedCandidates: endedSnap.size,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "정리 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
