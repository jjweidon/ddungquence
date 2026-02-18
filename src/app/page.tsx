"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureAnonAuth } from "@/features/auth/ensureAnonAuth";
import { createRoom, joinRoomByCode } from "@/features/room/roomApi";
import { CardSliderBackground } from "@/shared/ui/CardSliderBackground";

// ─── 로고: 다크 배경용 록업 (09 문서: 다크 우선) ─────────────────
function Logo() {
  return (
    <div className="flex flex-col items-center select-none">
      <Image
        src="/logos/02-lockups/lockup01_ko_en_on_dark.png"
        alt="뚱퀀스 DdungQuence"
        width={220}
        height={66}
        priority
        draggable={false}
      />
    </div>
  );
}

// ─── 로딩 화면 ──────────────────────────────────────────────
function LoadingScreen({ error }: { error: string | null }) {
  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-dq-charcoalDeep">
      <CardSliderBackground />
      <div className="relative z-10 flex flex-col items-center gap-4">
        <Logo />
        {error ? (
          <p className="text-dq-redLight text-sm font-medium">{error}</p>
        ) : (
          <LoadingDots />
        )}
      </div>
    </main>
  );
}

function LoadingDots() {
  return (
    <div className="flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-dq-white/50"
          style={{
            animation: `dq-pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ─── 공통 인풋 (09 문서: Surface Alt, Border, Text Primary) ─────
function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const base = [
    "w-full px-4 py-2.5 rounded-xl text-sm font-medium",
    "bg-dq-black border border-white/10 text-dq-white",
    "placeholder:text-dq-white/50",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-dq-redLight focus-visible:ring-offset-2 focus-visible:ring-offset-dq-charcoal",
    "transition-colors duration-150",
  ].join(" ");

  return <input {...props} className={`${base} ${props.className ?? ""}`} />;
}

// ─── 버튼 ─────────────────────────────────────────────────
function PrimaryButton({
  children,
  pending,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pending?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || pending}
      className={[
        "w-full min-h-[44px] py-2.5 rounded-xl text-sm font-bold tracking-wide",
        "bg-dq-red hover:bg-dq-redLight active:bg-dq-redDark text-dq-white",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dq-redLight focus-visible:ring-offset-2 focus-visible:ring-offset-dq-charcoal",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "transition-colors duration-150",
      ].join(" ")}
    >
      {pending ? (
        <span className="flex items-center justify-center gap-2">
          <SpinnerIcon />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

function SecondaryButton({
  children,
  pending,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pending?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || pending}
      className={[
        "w-full min-h-[44px] py-2.5 rounded-xl text-sm font-bold tracking-wide",
        "bg-dq-black hover:bg-white/14 border border-white/10 text-dq-white",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dq-redLight focus-visible:ring-offset-2 focus-visible:ring-offset-dq-charcoal",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        "transition-colors duration-150",
      ].join(" ")}
    >
      {pending ? (
        <span className="flex items-center justify-center gap-2">
          <SpinnerIcon />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

function SpinnerIcon() {
  return (
    <svg
      className="w-4 h-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-px bg-white/10" />
      <span className="text-xs text-dq-white/50 font-medium">{label}</span>
      <div className="flex-1 h-px bg-white/10" />
    </div>
  );
}

// ─── 메인 랜딩 페이지 ──────────────────────────────────────
export default function LandingPage() {
  const router = useRouter();
  const [uid, setUid] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [createNickname, setCreateNickname] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinNickname, setJoinNickname] = useState("");
  const [createPending, setCreatePending] = useState(false);
  const [joinPending, setJoinPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    ensureAnonAuth()
      .then((id) => setUid(id))
      .catch((err) => setAuthError(err?.message ?? "익명 로그인 실패"))
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
    return <LoadingScreen error={authError} />;
  }

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-dq-charcoalDeep px-4 py-6">
      <CardSliderBackground />

      <div className="relative z-10 w-full max-w-[360px] flex flex-col items-center gap-6">
        <Logo />
        <p className="text-sm text-dq-white/70 font-medium -mt-2 text-center">
          5줄을 완성하는 온라인 보드게임
        </p>

        <div className="dq-form-card w-full rounded-2xl p-6 flex flex-col gap-5">
          <form onSubmit={handleCreateRoom} className="flex flex-col gap-3">
            <h2 className="text-xs font-bold tracking-widest text-dq-white/70 uppercase">
              새 방 만들기
            </h2>
            <TextInput
              type="text"
              placeholder="닉네임"
              value={createNickname}
              onChange={(e) => setCreateNickname(e.target.value)}
              maxLength={20}
              autoComplete="off"
              required
            />
            <PrimaryButton
              type="submit"
              disabled={!createNickname.trim()}
              pending={createPending}
            >
              방 만들기
            </PrimaryButton>
          </form>

          <Divider label="또는" />

          <form onSubmit={handleJoinRoom} className="flex flex-col gap-3">
            <h2 className="text-xs font-bold tracking-widest text-dq-white/70 uppercase">
              방 참가
            </h2>
            <TextInput
              type="text"
              placeholder="방 코드 (6자리)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={6}
              autoComplete="off"
              className="font-mono tracking-[0.25em] uppercase"
              required
            />
            <TextInput
              type="text"
              placeholder="닉네임"
              value={joinNickname}
              onChange={(e) => setJoinNickname(e.target.value)}
              maxLength={20}
              autoComplete="off"
              required
            />
            <SecondaryButton
              type="submit"
              disabled={!joinCode.trim() || !joinNickname.trim()}
              pending={joinPending}
            >
              참가하기
            </SecondaryButton>
          </form>

          {formError && (
            <p className="text-dq-redLight text-xs text-center font-medium -mt-2">
              {formError}
            </p>
          )}
        </div>

        <p className="text-[11px] text-dq-white/30 text-center select-none">
          v0.1.0 · 비공개 베타
        </p>
      </div>
    </main>
  );
}
