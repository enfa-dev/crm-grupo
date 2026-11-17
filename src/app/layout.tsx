import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CRM do Grupo",
  description: "Gestão central das empresas do grupo",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
