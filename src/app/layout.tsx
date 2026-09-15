import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Harmony Residence | Sistema de Gestão Condominial",
  description: "Portal integrado de gestão, comunicação interna, reservas e ocorrências do condomínio Harmony Residence.",
  icons: {
    icon: "/images/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[#F4F7FB] text-slate-900 antialiased selection:bg-[#00A8E8]/20 selection:text-[#0B2545]">
        {children}
      </body>
    </html>
  );
}
