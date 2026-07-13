import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meu raio-x financeiro",
  description: "Painel financeiro pessoal com Supabase.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
