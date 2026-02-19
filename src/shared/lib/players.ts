import type { RoomPlayerDoc } from "@/features/room/types";

/**
 * 참여자 목록을 레드(A) → 블루(B) → 레드(A) → 블루(B) 순으로 정렬한다.
 *
 * - A팀과 B팀을 각각 seat 오름차순으로 정렬한 뒤 인터리브한다.
 *   결과: A[0], B[0], A[1], B[1] …
 * - 팀 미배정 플레이어는 seat 순으로 뒤에 배치한다.
 * - spectator는 포함하지 않는다.
 *
 * 팀 변경이 일어나도 항상 레드-블루-레드-블루 순서를 유지한다.
 */
export function sortParticipantsRedBlue(players: RoomPlayerDoc[]): RoomPlayerDoc[] {
  const bySeat = (a: RoomPlayerDoc, b: RoomPlayerDoc) =>
    (a.seat ?? 999) - (b.seat ?? 999);

  const participants = players.filter((p) => p.role === "participant");
  const reds = participants.filter((p) => p.teamId === "A").sort(bySeat);
  const blues = participants.filter((p) => p.teamId === "B").sort(bySeat);
  const noTeam = participants.filter((p) => !p.teamId).sort(bySeat);

  const result: RoomPlayerDoc[] = [];
  const max = Math.max(reds.length, blues.length);
  for (let i = 0; i < max; i++) {
    if (reds[i]) result.push(reds[i]);
    if (blues[i]) result.push(blues[i]);
  }
  return [...result, ...noTeam];
}
