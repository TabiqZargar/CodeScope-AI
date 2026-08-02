import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AtmosphericShader } from "@/components/landing/atmospheric-shader";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CodeScope AI",
  description:
    "Visualize JavaScript execution line by line. Paste code, step through it, and watch variables change.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-[#06070a] text-[#e3e2e7]">
        <AtmosphericShader />
        {children}
      </body>
    </html>
  );
}
