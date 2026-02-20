import type { RoomPlayerDoc } from "@/features/room/types";

/**
 * 참여자 목록을 레드(A) → 블루(B) → 레드(A) → 블루(B) 순으로 정렬한다.
 *
 * - 팀 내 순서는 readyAt 기준(가장 최근 준비 시점이 빠른 사람이 앞). readyAt 없으면 뒤로.
 * - A팀과 B팀을 각각 위 순서로 정렬한 뒤 인터리브한다. 결과: A[0], B[0], A[1], B[1] …
 * - 팀 미배정 플레이어는 readyAt 오름차순, 그다음 seat 순으로 뒤에 배치한다.
 * - spectator는 포함하지 않는다.
 *
 * 팀 변경이 일어나도 항상 레드-블루-레드-블루 순서를 유지한다.
 */
export function sortParticipantsRedBlue(players: RoomPlayerDoc[]): RoomPlayerDoc[] {
  const byReadyAtThenSeat = (a: RoomPlayerDoc, b: RoomPlayerDoc) => {
    const ta = a.readyAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
    const tb = b.readyAt?.toMillis?.() ?? Number.MAX_SAFE_INTEGER;
    if (ta !== tb) return ta - tb; // readyAt 오름차순(준비 시점이 빠른 사람이 앞)
    return (a.seat ?? 999) - (b.seat ?? 999);
  };

  const participants = players.filter((p) => p.role === "participant");
  const reds = participants.filter((p) => p.teamId === "A").sort(byReadyAtThenSeat);
  const blues = participants.filter((p) => p.teamId === "B").sort(byReadyAtThenSeat);
  const noTeam = participants.filter((p) => !p.teamId).sort(byReadyAtThenSeat);

  const result: RoomPlayerDoc[] = [];
  const max = Math.max(reds.length, blues.length);
  for (let i = 0; i < max; i++) {
    if (reds[i]) result.push(reds[i]);
    if (blues[i]) result.push(blues[i]);
  }
  return [...result, ...noTeam];
}
