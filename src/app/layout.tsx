import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_KR } from "next/font/google";
import { RegisterSw } from "@/shared/pwa/register-sw";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const notoSansKR = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-noto-sans-kr",
  display: "swap",
});

export const metadata: Metadata = {
  title: "뚱퀀스",
  description: "5줄을 완성하는 온라인 보드게임",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "뚱퀀스",
  },
};

/** PWA: 주소창/상태바 색상 (DQ Charcoal Deep) */
export const viewport: Viewport = {
  themeColor: "#111318",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${inter.variable} ${notoSansKR.variable}`}>
      <body className="font-sans bg-white dark:bg-dq-charcoalDeep text-gray-900 dark:text-dq-white antialiased">
        <RegisterSw />
        {children}
      </body>
    </html>
  );
}
