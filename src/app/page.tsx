"use client";

import { useEffect, useState } from "react";
import { ensureAnonAuth } from "@/features/auth/ensureAnonAuth";

export default function LandingPage() {
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ensureAnonAuth()
      .then((id) => {
        setUid(id);
        console.log("uid:", id);
      })
      .catch((err) => {
        setError(err?.message ?? "익명 로그인 실패");
        console.error("ensureAnonAuth error:", err);
      });
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-2xl font-bold mb-4">DdungQuence</h1>
      {uid && (
        <p className="text-green-600">로그인됨 (uid: {uid.slice(0, 8)}...)</p>
      )}
      {error && <p className="text-red-600">{error}</p>}
      {!uid && !error && <p className="text-gray-500">익명 로그인 중...</p>}
    </main>
  );
}
