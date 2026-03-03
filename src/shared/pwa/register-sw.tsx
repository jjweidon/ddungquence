"use client";

import { useEffect } from "react";

/**
 * PWA: 서비스 워커 등록.
 * Chrome 등에서 "앱 설치" 조건(manifest + SW) 충족용. 레이아웃에서 한 번만 마운트.
 */
export function RegisterSw() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {});
  }, []);
  return null;
}
