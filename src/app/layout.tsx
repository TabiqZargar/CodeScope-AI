import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const coderSansMono = localFont({
  src: "./fonts/CoderSansMono-Regular.otf",
  variable: "--font-coder-sans-mono",
  display: "swap",
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
      className={`${geistSans.variable} ${geistMono.variable} ${coderSansMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-canvas text-ink-primary">
        {children}
      </body>
    </html>
  );
}
