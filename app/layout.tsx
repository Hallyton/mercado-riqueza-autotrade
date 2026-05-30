import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mercado da Riqueza AutoTrade",
  description:
    "Automação operacional MT5 com tecnologia proprietária do Mercado da Riqueza.",
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
