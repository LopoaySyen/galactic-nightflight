import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://galactic-sky-physics.blush-eel-3740.chatgpt.site",
  ),
  title: "银河夜航",
  description:
    "在静谧的星空中启程。银河夜航以实测星表和三维模型，让你自由选择观察位置、时间与感光方式。",
  openGraph: {
    title: "银河夜航",
    description: "观察实测亮星、银河模型、系外天体与行星大气共同生成的动态内部视点天幕。",
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
    description: "观察实测亮星、银河模型、系外天体与行星大气共同生成的动态内部视点天幕。",
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
