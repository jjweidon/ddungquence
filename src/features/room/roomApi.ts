import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  deleteField,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/client";
import { getFirebaseAuth } from "@/lib/firebase/client";
import { sortParticipantsRedBlue } from "@/shared/lib/players";
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
    ready: true,
    readyAt: now,
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
  const participants = playersSnap.docs
    .map((d) => d.data() as RoomPlayerDoc)
    .filter((p) => p.role === "participant");
  const maxPlayers = 4;
  if (participants.length >= maxPlayers) {
    throw new Error("방이 가득 찼습니다.");
  }

  // 현재 팀 카운트 기준으로 더 적은 팀에 배정 (동수면 레드 우선)
  const redCount = participants.filter((p) => p.teamId === "A").length;
  const blueCount = participants.filter((p) => p.teamId === "B").length;
  const teamId: TeamId = redCount <= blueCount ? "A" : "B";

  // 인터리빙 seat: 레드 = 짝수(0,2,...), 블루 = 홀수(1,3,...)
  // 비어있는 가장 낮은 슬롯에 배정 (누군가 나가도 seat 충돌 없음)
  const occupiedSeats = new Set(
    participants.map((p) => p.seat).filter((s) => s !== undefined)
  );
  let seat = 0;
  if (teamId === "A") {
    for (let s = 0; ; s += 2) {
      if (!occupiedSeats.has(s)) { seat = s; break; }
    }
  } else {
    for (let s = 1; ; s += 2) {
      if (!occupiedSeats.has(s)) { seat = s; break; }
    }
  }

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
 * ready=true 시 readyAt을 갱신하여 팀 내 순서(준비 시점이 빠른 사람이 앞)에 반영합니다.
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
  const payload: Record<string, unknown> = {
    ready,
    lastSeenAt: serverTimestamp(),
  };
  if (ready) {
    payload.readyAt = serverTimestamp();
  } else {
    payload.readyAt = null;
  }
  await setDoc(playerRef, payload, { merge: true });
}

/**
 * 로비에서 참여자 → 관전자로 전환합니다.
 * 호스트가 관전할 경우, 남은 참여자 중 첫 번째(seat·joinedAt 순)에게 호스트를 넘깁니다.
 */
export async function switchToSpectator(roomId: string): Promise<void> {
  const db = getFirestoreDb();
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("로그인이 필요합니다.");

  const roomRef = doc(db, "rooms", roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) throw new Error("방을 찾을 수 없습니다.");

  const roomData = roomSnap.data();
  const hostUid = roomData.hostUid as string;
  const isHost = hostUid === uid;

  const playersRef = collection(db, "rooms", roomId, "players");
  const playersSnap = await getDocs(playersRef);
  const participants = playersSnap.docs
    .map((d) => d.data() as RoomPlayerDoc)
    .filter((p) => p.role === "participant");
  const remaining = participants.filter((p) => p.uid !== uid);

  const batch = writeBatch(db);
  const playerRef = doc(playersRef, uid);
  batch.set(
    playerRef,
    {
      role: "spectator",
      teamId: null,
      seat: null,
      ready: false,
      readyAt: null,
      lastSeenAt: serverTimestamp(),
    },
    { merge: true }
  );

  if (isHost && remaining.length > 0) {
    // 로비 표시 순서(레드-블루 인터리브, 팀 내 readyAt→seat)와 동일하게 첫 번째 참여자에게 호스트 이전
    const sorted = sortParticipantsRedBlue(remaining);
    const newHostUid = sorted[0].uid;
    batch.set(roomRef, { hostUid: newHostUid, updatedAt: serverTimestamp() }, { merge: true });
  }

  await batch.commit();
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
 * rooms/{roomId} 문서를 실시간 구독합니다.
 * 로비에서 status 변경 감지(→ "playing" 시 게임 화면 이동),
 * 게임에서 공개 game 상태 구독에 사용합니다.
 */
export function subscribeToRoom(
  roomId: string,
  onUpdate: (data: import("./types").RoomDoc | null) => void,
): Unsubscribe {
  const db = getFirestoreDb();
  const roomRef = doc(db, "rooms", roomId);
  return onSnapshot(roomRef, (snap) => {
    onUpdate(snap.exists() ? (snap.data() as import("./types").RoomDoc) : null);
  });
}

/**
 * 게임 종료 후 로비로 재입장합니다.
 *
 * - 참여자: joinedAt을 현재 시각으로 갱신(입장 순서 재설정) + ready/readyAt 초기화
 * - 관전자: role/status 그대로 유지, lastSeenAt만 갱신
 * - 방이 playing/ended 상태이면 status를 "lobby"로 되돌리고 game 필드 제거(로비에서 봇 제거·나가기 등 가능)
 *
 * 게임 페이지의 "로비로" 버튼 클릭 시 navigate 전에 호출합니다.
 */
export async function returnToLobby(roomId: string): Promise<void> {
  const db = getFirestoreDb();
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("로그인이 필요합니다.");

  const roomRef = doc(db, "rooms", roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) return;

  const roomData = roomSnap.data() as { status?: string };
  const roomStatus = roomData.status;

  const playerRef = doc(db, "rooms", roomId, "players", uid);
  const playerSnap = await getDoc(playerRef);
  if (!playerSnap.exists()) return;

  const playerData = playerSnap.data() as RoomPlayerDoc;
  const now = serverTimestamp();

  if (playerData.role === "spectator") {
    await setDoc(playerRef, { lastSeenAt: now }, { merge: true });
  } else {
    // 참여자: 입장 시각 갱신(로비 입장 순서) + 준비 상태 초기화
    await setDoc(playerRef, {
      uid: playerData.uid,
      nickname: playerData.nickname,
      role: "participant",
      teamId: playerData.teamId,
      seat: playerData.seat,
      ready: false,
      readyAt: null,
      joinedAt: now,
      lastSeenAt: now,
    } satisfies RoomPlayerDocWrite);
  }

  // 게임 중/종료 상태에서 돌아온 경우 방을 로비 상태로 복원(봇 제거·나가기 허용)
  if (roomStatus === "playing" || roomStatus === "ended") {
    await setDoc(
      roomRef,
      {
        status: "lobby",
        updatedAt: now,
        game: deleteField(),
      },
      { merge: true },
    );
  }
}

/**
 * 호스트만 호출 가능. 봇 플레이어를 로비에 추가합니다.
 * 봇 uid: "bot_<nickname>" 형식 (예: bot_뚱1)
 * 봇은 즉시 ready=true 상태로 추가됩니다.
 */
export async function addBot(
  roomId: string,
  nickname: string,
): Promise<void> {
  const db = getFirestoreDb();
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("로그인이 필요합니다.");

  const roomRef = doc(db, "rooms", roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) throw new Error("방을 찾을 수 없습니다.");

  const roomData = roomSnap.data();
  if (roomData.hostUid !== uid) throw new Error("호스트만 봇을 추가할 수 있습니다.");
  if (roomData.status !== "lobby") throw new Error("로비 상태에서만 봇을 추가할 수 있습니다.");

  const playersRef = collection(db, "rooms", roomId, "players");
  const playersSnap = await getDocs(playersRef);
  const participants = playersSnap.docs
    .map((d) => d.data() as RoomPlayerDoc)
    .filter((p) => p.role === "participant");

  if (participants.length >= 4) throw new Error("방이 가득 찼습니다.");

  const redCount = participants.filter((p) => p.teamId === "A").length;
  const blueCount = participants.filter((p) => p.teamId === "B").length;
  const teamId: TeamId = redCount <= blueCount ? "A" : "B";

  const occupiedSeats = new Set(
    participants.map((p) => p.seat).filter((s) => s !== undefined),
  );
  let seat = 0;
  if (teamId === "A") {
    for (let s = 0; ; s += 2) {
      if (!occupiedSeats.has(s)) { seat = s; break; }
    }
  } else {
    for (let s = 1; ; s += 2) {
      if (!occupiedSeats.has(s)) { seat = s; break; }
    }
  }

  const botUid = `bot_${nickname}`;
  const now = serverTimestamp();
  const botRef = doc(db, "rooms", roomId, "players", botUid);

  await setDoc(botRef, {
    uid: botUid,
    nickname,
    role: "participant",
    teamId,
    seat,
    ready: true,
    readyAt: now,
    joinedAt: now,
    lastSeenAt: now,
    isBot: true,
  } satisfies RoomPlayerDocWrite & { isBot: boolean });
}

/**
 * 호스트만 호출 가능. 봇 플레이어를 로비에서 제거합니다.
 */
export async function removeBot(
  roomId: string,
  botUid: string,
): Promise<void> {
  const db = getFirestoreDb();
  const auth = getFirebaseAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("로그인이 필요합니다.");

  const roomRef = doc(db, "rooms", roomId);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) throw new Error("방을 찾을 수 없습니다.");

  const roomData = roomSnap.data();
  if (roomData.hostUid !== uid) throw new Error("호스트만 봇을 제거할 수 있습니다.");
  if (roomData.status !== "lobby") throw new Error("로비 상태에서만 봇을 제거할 수 있습니다.");

  const botRef = doc(db, "rooms", roomId, "players", botUid);
  const botSnap = await getDoc(botRef);
  if (!botSnap.exists()) return;

  const botData = botSnap.data() as RoomPlayerDoc;
  if (!botData.isBot) throw new Error("봇 플레이어만 제거할 수 있습니다.");

  await deleteDoc(botRef);
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

  // player 삭제 + host 변경/방 삭제를 단일 batch로 원자적 처리
  const batch = writeBatch(db);
  batch.delete(playerRef);

  if (isHost) {
    if (remaining.length > 0) {
      const newHostUid = sortParticipantsRedBlue(remaining)[0].uid;
      batch.set(roomRef, { hostUid: newHostUid, updatedAt: serverTimestamp() }, { merge: true });
    } else {
      batch.delete(roomRef);
      if (roomCode) {
        const roomCodeRef = doc(db, "roomCodes", roomCode.trim().toUpperCase());
        batch.delete(roomCodeRef);
      }
    }
  }

  await batch.commit();
}
