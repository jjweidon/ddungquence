"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonAuth } from "@/features/auth/ensureAnonAuth";
import { createRoom, joinRoomByCode } from "@/features/room/roomApi";

export default function LandingPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 폼 상태
  const [createNickname, setCreateNickname] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinNickname, setJoinNickname] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [joinPending, setJoinPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    ensureAnonAuth()
      .then((id) => {
        setUid(id);
      })
      .catch((err) => {
        setError(err?.message ?? "익명 로그인 실패");
        console.error("ensureAnonAuth error:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !createNickname.trim() || createPending) return;
    setFormError(null);
    setCreatePending(true);
    try {
      const { code } = await createRoom(createNickname.trim());
      router.push(`/lobby/${code}`);
    } catch (err) {
      setFormError((err as Error).message);
      setCreatePending(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid || !joinCode.trim() || !joinNickname.trim() || joinPending) return;
    setFormError(null);
    setJoinPending(true);
    try {
      await joinRoomByCode(joinCode.trim(), joinNickname.trim());
      router.push(`/lobby/${joinCode.trim().toUpperCase()}`);
    } catch (err) {
      setFormError((err as Error).message);
      setJoinPending(false);
    }
  };

  if (loading || !uid) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-8">
        <h1 className="text-2xl font-bold mb-4">DdungQuence</h1>
        {error && <p className="text-red-600">{error}</p>}
        {!error && <p className="text-gray-500">로그인 중...</p>}
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold mb-8">DdungQuence</h1>

      <div className="w-full max-w-sm space-y-8">
        {/* 방 만들기 */}
        <form onSubmit={handleCreateRoom} className="space-y-3">
          <h2 className="font-semibold text-lg">방 만들기</h2>
          <input
            type="text"
            placeholder="닉네임"
            value={createNickname}
            onChange={(e) => setCreateNickname(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
            maxLength={20}
            required
          />
          <button
            type="submit"
            disabled={createPending || !createNickname.trim()}
            className="w-full py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createPending ? "생성 중..." : "방 만들기"}
          </button>
        </form>

        {/* 방 참가 */}
        <form onSubmit={handleJoinRoom} className="space-y-3">
          <h2 className="font-semibold text-lg">방 참가</h2>
          <input
            type="text"
            placeholder="방 코드"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            className="w-full px-4 py-2 border rounded-lg uppercase"
            maxLength={6}
            required
          />
          <input
            type="text"
            placeholder="닉네임"
            value={joinNickname}
            onChange={(e) => setJoinNickname(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
            maxLength={20}
            required
          />
          <button
            type="submit"
            disabled={joinPending || !joinCode.trim() || !joinNickname.trim()}
            className="w-full py-2 bg-green-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {joinPending ? "참가 중..." : "참가하기"}
          </button>
        </form>

        {formError && (
          <p className="text-red-600 text-sm text-center">{formError}</p>
        )}
      </div>
    </main>
  );
}
