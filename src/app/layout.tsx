import type { Metadata, Viewport } from "next";
import { caveat } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "NotBak - Ekip Yönetim Sistemi",
  description: "Görev takibi ve ekip notları",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body className={`antialiased ${caveat.variable}`} suppressHydrationWarning>{children}</body>
    </html>
  );
}
