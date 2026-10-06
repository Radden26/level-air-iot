import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Monitoring Level Air — Tangki 1",
  description: "Dashboard monitoring level air 1 tangki - Modbus RTU RS485 + ESP32 + Firebase",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark">
      <body className="min-h-screen bg-[#070b19] text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
