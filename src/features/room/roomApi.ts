import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/client";
import { getFirebaseAuth } from "@/lib/firebase/client";
import type { RoomPlayerDoc, RoomPlayerDocWrite, TeamId } from "./types";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // I,O,0,1 제외
const CODE_LENGTH = 6;

function generateRoomCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

/**
 * 방을 생성하고 host를 players에 추가합니다.
 * @returns { roomId, code } 또는 실패 시 에러 throw
 */
export async function createRoom(nickname: string): Promise<{
  roomId: string;
  code: string;
}> {
  const db = getFirestoreDb();
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error("로그인이 필요합니다.");
  }

  const roomId = doc(collection(db, "rooms")).id;

  // 코드 충돌 시 재시도 (최대 5회)
  let code: string | null = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = generateRoomCode();
    const roomCodesRef = doc(db, "roomCodes", candidate);
    const existing = await getDoc(roomCodesRef);
    if (existing.exists()) continue;
    await setDoc(roomCodesRef, {
      roomId,
      createdAt: serverTimestamp(),
    });
    code = candidate;
    break;
  }
  if (!code) {
    throw new Error("방 생성에 실패했습니다. 다시 시도해주세요.");
  }

  const now = serverTimestamp();
  const roomsRef = doc(db, "rooms", roomId);
  const hostPlayerRef = doc(db, "rooms", roomId, "players", uid);

  await setDoc(roomsRef, {
    roomCode: code,
    status: "lobby",
    hostUid: uid,
    createdAt: now,
    updatedAt: now,
    config: {
      mode: "teams2",
      maxPlayers: 4,
      maxSpectators: 2,
      sequenceToWin: 2,
      oneEyedJackCanBreakSequence: false,
    },
  });

  await setDoc(hostPlayerRef, {
    uid,
    nickname,
    role: "participant",
    teamId: "A",
    seat: 0,
    ready: false,
    joinedAt: now,
    lastSeenAt: now,
  } satisfies RoomPlayerDocWrite);

  return { roomId, code };
}

/**
 * 코드로 방에 참가합니다.
 * 1) roomCodes/{code} → roomId 획득
 * 2) rooms/{roomId}/players/{uid} 생성
 */
export async function joinRoomByCode(
  code: string,
  nickname: string
): Promise<string> {
  const db = getFirestoreDb();
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error("로그인이 필요합니다.");
  }

  const normalizedCode = code.trim().toUpperCase();
  const roomCodeRef = doc(db, "roomCodes", normalizedCode);
  const roomCodeSnap = await getDoc(roomCodeRef);

  if (!roomCodeSnap.exists()) {
    throw new Error("존재하지 않는 방 코드입니다.");
  }

  const roomId = roomCodeSnap.data().roomId as string;
  const playersRef = collection(db, "rooms", roomId, "players");
  const playersSnap = await getDocs(playersRef);
  const participants = playersSnap.docs.filter(
    (d) => (d.data() as RoomPlayerDoc).role === "participant"
  );
  const participantCount = participants.length;
  const maxPlayers = 4;
  if (participantCount >= maxPlayers) {
    throw new Error("방이 가득 찼습니다.");
  }
  // 입장 순서대로 레드(A) - 블루(B) - 레드 - 블루 배정
  const seat = participantCount;
  const teamId: TeamId = seat % 2 === 0 ? "A" : "B";

  const now = serverTimestamp();
  const playerRef = doc(db, "rooms", roomId, "players", uid);

  await setDoc(playerRef, {
    uid,
    nickname,
    role: "participant",
    teamId,
    seat,
    ready: false,
    joinedAt: now,
    lastSeenAt: now,
  } satisfies RoomPlayerDocWrite);

  return roomId;
}

/**
 * roomCodes/{code}를 읽어 roomId를 반환합니다.
 */
export async function getRoomIdByCode(code: string): Promise<string | null> {
  const db = getFirestoreDb();
  const normalizedCode = code.trim().toUpperCase();
  const roomCodeRef = doc(db, "roomCodes", normalizedCode);
  const snap = await getDoc(roomCodeRef);
  if (!snap.exists()) return null;
  return snap.data().roomId as string;
}

/**
 * 본인 플레이어 문서의 ready 필드를 업데이트합니다.
 */
export async function updatePlayerReady(
  roomId: string,
  ready: boolean
): Promise<void> {
  const db = getFirestoreDb();
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("로그인이 필요합니다.");

  const playerRef = doc(db, "rooms", roomId, "players", uid);
  await setDoc(
    playerRef,
    { ready, lastSeenAt: serverTimestamp() },
    { merge: true }
  );
}

/**
 * 본인 플레이어 문서의 teamId 필드를 업데이트합니다.
 */
export async function updatePlayerTeam(
  roomId: string,
  teamId: TeamId
): Promise<void> {
  const db = getFirestoreDb();
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("로그인이 필요합니다.");

  const playerRef = doc(db, "rooms", roomId, "players", uid);
  await setDoc(
    playerRef,
    { teamId, lastSeenAt: serverTimestamp() },
    { merge: true }
  );
}

/**
 * rooms/{roomId}/players 컬렉션을 실시간 구독합니다.
 * @returns unsubscribe 함수
 */
export function subscribeToPlayers(
  roomId: string,
  onUpdate: (players: RoomPlayerDoc[]) => void
): Unsubscribe {
  const db = getFirestoreDb();
  const playersRef = collection(db, "rooms", roomId, "players");

  return onSnapshot(playersRef, (snapshot) => {
    const players = snapshot.docs.map((d) => d.data() as RoomPlayerDoc);
    // seat 순으로 정렬, seat 없으면 joinedAt 기준
    players.sort((a, b) => {
      const seatA = a.seat ?? 999;
      const seatB = b.seat ?? 999;
      if (seatA !== seatB) return seatA - seatB;
      const tsA = a.joinedAt?.toMillis?.() ?? 0;
      const tsB = b.joinedAt?.toMillis?.() ?? 0;
      return tsA - tsB;
    });
    onUpdate(players);
  });
}

/**
 * rooms/{roomId} 문서를 한 번 읽어 hostUid 등을 가져옵니다.
 */
export async function getRoom(roomId: string): Promise<{
  hostUid: string;
  status: string;
} | null> {
  const db = getFirestoreDb();
  const roomRef = doc(db, "rooms", roomId);
  const snap = await getDoc(roomRef);
  if (!snap.exists()) return null;
  const data = snap.data();
  return { hostUid: data.hostUid, status: data.status };
}

/**
 * 게임 시작 전(로비)에만 방을 나갑니다.
 * - 본인 플레이어 문서 삭제
 * - 방장이 나가면: 남은 참여자 중 1명을 새 방장으로 지정. 남은 참여자가 없으면 방·방코드 삭제
 */
export async function leaveRoom(roomId: string): Promise<void> {
  const db = getFirestoreDb();
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("로그인이 필요합니다.");

  const roomRef = doc(db, "rooms", roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) {
    return; // 이미 방이 없음
  }
  const roomData = roomSnap.data();
  const status = roomData.status as string;
  const hostUid = roomData.hostUid as string;
  const roomCode = (roomData.roomCode as string) ?? "";

  if (status !== "lobby") {
    throw new Error("게임이 시작된 후에는 방을 나갈 수 없습니다.");
  }

  const playersRef = collection(db, "rooms", roomId, "players");
  const playersSnap = await getDocs(playersRef);
  const participants = playersSnap.docs
    .map((d) => d.data() as RoomPlayerDoc)
    .filter((p) => p.role === "participant");
  const remaining = participants.filter((p) => p.uid !== uid);
  const isHost = hostUid === uid;

  const playerRef = doc(db, "rooms", roomId, "players", uid);
  await deleteDoc(playerRef);

  if (isHost && roomSnap.exists()) {
    if (remaining.length > 0) {
      const sorted = [...remaining].sort((a, b) => {
        const seatA = a.seat ?? 999;
        const seatB = b.seat ?? 999;
        if (seatA !== seatB) return seatA - seatB;
        const tsA = a.joinedAt?.toMillis?.() ?? 0;
        const tsB = b.joinedAt?.toMillis?.() ?? 0;
        return tsA - tsB;
      });
      const newHostUid = sorted[0].uid;
      await setDoc(
        roomRef,
        { hostUid: newHostUid, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } else {
      await deleteDoc(roomRef);
      if (roomCode) {
        const roomCodeRef = doc(db, "roomCodes", roomCode.trim().toUpperCase());
        await deleteDoc(roomCodeRef);
      }
    }
  }
}
