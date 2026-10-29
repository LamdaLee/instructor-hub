import SessionGuard from "./session-guard";
import { Suspense } from "react";
import type { Metadata } from "next";
import "./globals.css";
import "./portal.css";
export const metadata: Metadata = {
  title: "LG전자 K-뉴딜 아카데미",
  description: "지역·트랙별 시간표, 강사 정보와 교재 자료실",
  robots: { index: false, follow: false },
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body><Suspense><SessionGuard /></Suspense>{children}</body>
    </html>
  );
}
