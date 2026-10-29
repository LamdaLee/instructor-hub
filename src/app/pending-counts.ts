"use client";
import { useEffect, useState } from "react";
import { readResponse } from "@/lib/client";
export function usePendingCounts(enabled: boolean, revision = 0) {
  const [counts, setCounts] = useState({ requests: 0, signups: 0 });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const refresh = async () => {
      if (document.visibilityState === "hidden") return;
      try {
        const r = await readResponse(await fetch("/api/org?action=counts", { cache: "no-store", signal: controller.signal }));
        if (!controller.signal.aborted) setCounts({ requests: r.requests, signups: r.signups });
      } catch { /* 목록은 계속 사용할 수 있으며 만료 처리는 공통 응답 처리기를 따른다. */ }
    };
    void refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [enabled, revision]);
  return counts;
}
