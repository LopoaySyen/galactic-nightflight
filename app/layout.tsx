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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        {/* Keep icon links on the requesting origin. vinext resolves metadata.icons
            against metadataBase, which would send custom-domain visitors elsewhere. */}
        <link rel="icon" href="/favicon.ico?v=nightflight-2" type="image/x-icon" sizes="16x16 32x32 48x48 192x192" />
        <link rel="icon" href="/brand/favicon-nightflight-32.png?v=nightflight-2" type="image/png" sizes="32x32" />
        <link rel="icon" href="/brand/favicon-nightflight-16.png?v=nightflight-2" type="image/png" sizes="16x16" />
        <link rel="shortcut icon" href="/favicon.ico?v=nightflight-2" />
        <link rel="apple-touch-icon" href="/brand/favicon-nightflight-192.png?v=nightflight-2" sizes="192x192" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
