import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mercado da Riqueza AutoTrade",
  description: "Automação MT5 em modelo gerenciado — caixa preta.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">{children}</body>
    </html>
  );
}
