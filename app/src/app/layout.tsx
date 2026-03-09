import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CodexAtlas",
  description:
    "AI-assisted research platform for ancient religious manuscripts",
  manifest: "/manifest.json",
  openGraph: {
    title: "CodexAtlas",
    description:
      "Discover, analyze, translate, and compare ancient religious manuscripts with radical transparency.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a365d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
