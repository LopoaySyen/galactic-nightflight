import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://galactic-sky-physics.blush-eel-3740.chatgpt.site",
  ),
  title: "银河夜航",
  description:
    "同一片银河，不同的星空。银河夜航让你从银河中的不同位置出发，调整时间、晨昏与大气，探索异地的夜空。",
  openGraph: {
    title: "银河夜航",
    description: "如果站在银河另一处的星球上，抬头会看到什么？选择位置、时间与大气，看看那里的星空。",
    type: "website",
    images: [
      {
        url: "/brand/nightflight-sky.webp",
        width: 1672,
        height: 941,
        alt: "银河夜航：首页星空艺术示意。",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "银河夜航",
    description: "如果站在银河另一处的星球上，抬头会看到什么？选择位置、时间与大气，看看那里的星空。",
    images: ["/brand/nightflight-sky.webp"],
  },
  icons: {
    icon: [{url:"/brand/favicon-nightflight.ico",sizes:"any"},{url:"/brand/favicon-nightflight-32.png",type:"image/png",sizes:"32x32"},{url:"/brand/favicon-nightflight-16.png",type:"image/png",sizes:"16x16"}],
    shortcut: "/brand/favicon-nightflight.ico",
    apple: "/brand/favicon-nightflight-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
