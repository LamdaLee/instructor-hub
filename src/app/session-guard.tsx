"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { redirectToLogin } from "@/lib/client";
export default function SessionGuard() {
  const path = usePathname();
  useEffect(() => {
    if (["/admin/login", "/login", "/signup"].includes(path)) return;
    const controller = new AbortController();
    let checking = false;
    const check = async () => {
      if (checking || document.visibilityState === "hidden") return;
      checking = true;
      try {
        const res = await fetch("/api/me", { cache: "no-store", signal: controller.signal });
        const r = await res.json();
        if (r.code === "session_expired") redirectToLogin();
      } catch { /* 통신 오류만으로 로그아웃하지 않는다. */ }
      finally { checking = false; }
    };
    void check();
    const timer = setInterval(check, 60000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      controller.abort(); clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, [path]);
  return null;
}
