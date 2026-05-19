import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import NextTopLoader from "nextjs-toploader";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Relife Recruit OS",
  description: "ระบบบริหารการรับสมัครงาน",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className="h-full">
      <body className={`${inter.className} min-h-full bg-slate-50 antialiased`}>
        <NextTopLoader color="#2563eb" showSpinner={false} height={2} />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
