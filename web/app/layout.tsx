import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "ContAuditAI — Pre-Auditoría Fiscal SAT México",
  description: "Anticipa al SAT antes de que te llame. ContAuditAI cruza tus CFDIs, SPEI y lista EFOS/EDOS en tiempo real para darte un Risk Score fiscal y alertas accionables antes de cualquier revisión.",
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: "ContAuditAI — Pre-Auditoría Fiscal SAT México",
    description: "Motor de reconciliación CFDI 4.0 con alertas fiscales, Risk Score y Vault de Materialidad.",
    locale: "es_MX",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
