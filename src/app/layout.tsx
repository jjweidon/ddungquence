import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DdungQuence",
  description: "뚱퀀스 - 보드게임 시퀀스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
