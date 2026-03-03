import type { MetadataRoute } from "next";

/**
 * PWA Web App Manifest.
 * 홈 화면에 추가 시 앱처럼 실행(standalone), 디자인 토큰 반영.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "뚱퀀스",
    short_name: "뚱퀀스",
    description: "5줄을 완성하는 온라인 보드게임",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#111318",
    theme_color: "#111318",
    categories: ["games", "entertainment"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
