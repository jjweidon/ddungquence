"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { CardSliderBackground } from "@/shared/ui/CardSliderBackground";

const STORAGE_KEY = "dq-admin-unlocked";

// ─── 공통 인풋 (랜딩과 동일) ─────────────────────────────────────
function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const base = [
    "w-full px-4 py-2.5 rounded-xl text-sm font-medium",
    "bg-dq-charcoalDeep border border-white/25 text-dq-white",
    "placeholder:text-dq-white/50",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-dq-redLight focus-visible:ring-offset-2 focus-visible:ring-offset-dq-charcoal",
    "transition-colors duration-150",
  ].join(" ");
  return <input {...props} className={`${base} ${props.className ?? ""}`} />;
}

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
        "bg-dq-charcoalDeep hover:bg-white/14 border border-white/25 text-dq-white",
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

// ─── 비밀번호 입력 폼 ───────────────────────────────────────────
function PasswordGate({
  onUnlock,
}: {
  onUnlock: () => void;
}) {
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!password.trim() || pending) return;
      setError(null);
      setPending(true);
      try {
        const res = await fetch("/api/admin/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: password.trim() }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data.error ?? "인증에 실패했습니다.");
          setPending(false);
          return;
        }
        if (typeof window !== "undefined") {
          sessionStorage.setItem(STORAGE_KEY, "1");
        }
        onUnlock();
      } catch {
        setError("네트워크 오류가 발생했습니다.");
      } finally {
        setPending(false);
      }
    },
    [password, pending, onUnlock]
  );

  return (
    <div className="dq-form-card w-full max-w-[360px] rounded-2xl p-6 flex flex-col gap-5">
      <h1 className="text-sm font-bold tracking-widest text-dq-white uppercase">
        관리자 로그인
      </h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <TextInput
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <PrimaryButton type="submit" disabled={!password.trim()} pending={pending}>
          확인
        </PrimaryButton>
      </form>
      {error && (
        <p className="text-dq-redLight text-xs text-center font-medium">{error}</p>
      )}
    </div>
  );
}

// ─── 관리자 대시보드 (DB 초기화·미사용 룸 정리) ─────────────────────
function AdminDashboard() {
  const [resetPending, setResetPending] = useState(false);
  const [cleanupPending, setCleanupPending] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [cleanupPassword, setCleanupPassword] = useState("");

  const handleResetClick = useCallback(() => {
    setMessage(null);
    setShowConfirm(true);
    setPassword("");
    setConfirmText("");
  }, []);

  const handleResetConfirm = useCallback(async () => {
    if (confirmText !== "초기화" || !password.trim() || resetPending) return;
    setMessage(null);
    setResetPending(true);
    try {
      const res = await fetch("/api/admin/reset-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "DB 초기화에 실패했습니다." });
        setResetPending(false);
        return;
      }
      setMessage({ type: "ok", text: data.message ?? "DB 초기화가 완료되었습니다." });
      setShowConfirm(false);
    } catch {
      setMessage({ type: "error", text: "네트워크 오류가 발생했습니다." });
    } finally {
      setResetPending(false);
    }
  }, [password, confirmText, resetPending]);

  const handleCleanup = useCallback(async () => {
    if (!cleanupPassword.trim() || cleanupPending) return;
    setMessage(null);
    setCleanupPending(true);
    try {
      const res = await fetch("/api/admin/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: cleanupPassword.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "미사용 룸 정리에 실패했습니다." });
        setCleanupPending(false);
        return;
      }
      const detail =
        typeof data.deletedRooms === "number"
          ? ` (방 ${data.deletedRooms}개, 코드 ${data.deletedCodes ?? 0}개 삭제)`
          : "";
      setMessage({
        type: "ok",
        text: (data.message ?? "미사용 룸 정리가 완료되었습니다.") + detail,
      });
    } catch {
      setMessage({ type: "error", text: "네트워크 오류가 발생했습니다." });
    } finally {
      setCleanupPending(false);
    }
  }, [cleanupPassword, cleanupPending]);

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }, []);

  return (
    <div className="dq-form-card w-full max-w-[360px] rounded-2xl p-6 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-sm font-bold tracking-widest text-dq-white uppercase">
          관리자
        </h1>
        <button
          type="button"
          onClick={handleLogout}
          className="text-xs text-dq-white/60 hover:text-dq-white transition-colors"
        >
          로그아웃
        </button>
      </div>

      {!showConfirm ? (
        <>
          <section className="bg-dq-charcoal border border-white/10 rounded-2xl p-4">
            <h2 className="text-xs font-bold tracking-widest text-dq-white/70 uppercase mb-3">
              미사용 룸 정리
            </h2>
            <p className="text-xs text-dq-white/70 mb-3">
              24시간 미갱신 로비·7일 미갱신 종료(ended) 방과 해당 방 코드를 삭제합니다.
            </p>
            <TextInput
              type="password"
              placeholder="관리자 비밀번호"
              value={cleanupPassword}
              onChange={(e) => setCleanupPassword(e.target.value)}
              autoComplete="current-password"
              className="mb-3"
            />
            <SecondaryButton
              type="button"
              onClick={handleCleanup}
              disabled={!cleanupPassword.trim() || cleanupPending}
              pending={cleanupPending}
            >
              미사용 룸 정리 실행
            </SecondaryButton>
          </section>

          <section className="bg-dq-charcoal border border-white/10 rounded-2xl p-4">
            <h2 className="text-xs font-bold tracking-widest text-dq-white/70 uppercase mb-3">
              DB 초기화
            </h2>
            <p className="text-xs text-dq-white/70 mb-4">
              모든 방(rooms)과 방 코드(roomCodes) 데이터를 삭제합니다. 되돌릴 수 없습니다.
            </p>
            <PrimaryButton
              type="button"
              onClick={handleResetClick}
              className="bg-dq-redDark hover:bg-dq-red focus-visible:ring-dq-redLight"
            >
              DB 초기화
            </PrimaryButton>
          </section>
          {message && (
            <p
              className={
                message.type === "ok"
                  ? "text-dq-green text-xs text-center font-medium"
                  : "text-dq-redLight text-xs text-center font-medium"
              }
            >
              {message.text}
            </p>
          )}
        </>
      ) : (
        <section className="bg-dq-charcoal border border-white/10 rounded-2xl p-4 space-y-3">
          <h2 className="text-xs font-bold tracking-widest text-dq-white/70 uppercase">
            확인
          </h2>
          <p className="text-xs text-dq-white/70">
            아래에 <strong className="text-dq-white">초기화</strong>를 입력하고 비밀번호를 넣은 뒤 실행하세요.
          </p>
          <TextInput
            type="password"
            placeholder="관리자 비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <TextInput
            type="text"
            placeholder="초기화"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
          />
          <div className="flex gap-2">
            <SecondaryButton
              type="button"
              onClick={() => setShowConfirm(false)}
              disabled={resetPending}
            >
              취소
            </SecondaryButton>
            <PrimaryButton
              type="button"
              onClick={handleResetConfirm}
              disabled={confirmText !== "초기화" || !password.trim() || resetPending}
              pending={resetPending}
              className="bg-dq-redDark hover:bg-dq-red"
            >
              실행
            </PrimaryButton>
          </div>
        </section>
      )}

      <Link
        href="/"
        className="text-center text-xs text-dq-white/50 hover:text-dq-white transition-colors"
      >
        ← 홈으로
      </Link>
    </div>
  );
}

// ─── 메인 ───────────────────────────────────────────────────────
export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    if (sessionStorage.getItem(STORAGE_KEY) === "1") setUnlocked(true);
  }, []);

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-dq-charcoalDeep px-4 py-6">
      <CardSliderBackground />
      <div className="relative z-10 w-full flex flex-col items-center gap-6">
        {!hydrated ? (
          <div className="dq-form-card w-full max-w-[360px] rounded-2xl p-6 flex justify-center">
            <SpinnerIcon />
          </div>
        ) : unlocked ? (
          <AdminDashboard />
        ) : (
          <PasswordGate onUnlock={() => setUnlocked(true)} />
        )}
      </div>
    </main>
  );
}
