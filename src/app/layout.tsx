import type { Metadata } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// Texto corrido.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

// Títulos (h1/h2 e a classe font-display).
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display-face",
});

export const metadata: Metadata = {
  title: "Harmony Residence | Sistema de Gestão Condominial",
  description: "Portal integrado de gestão, comunicação interna, reservas e ocorrências do condomínio Harmony Residence.",
  icons: {
    icon: "/images/logo-64.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${jakarta.variable} ${bricolage.variable}`}>
      <body className="min-h-screen bg-neutral-bg text-slate-900 antialiased selection:bg-accent/30 selection:text-primary">
        {children}
      </body>
    </html>
  );
}
