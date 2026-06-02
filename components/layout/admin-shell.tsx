import { BrandLogo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { SectionNav } from "@/components/layout/section-nav";

const NAV = [
  { href: "/admin", label: "Centro de operações" },
  { href: "/admin/users", label: "Usuários" },
  { href: "/admin/clientes", label: "Clientes e licenças" },
  { href: "/admin/master-signals", label: "Sinais mestre" },
  { href: "/admin/instrucoes", label: "Instruções (teste)" },
  { href: "/admin/risk/real-trading-guard", label: "Risco / Real Guard" },
  { href: "/admin/real-trading/approvals", label: "Conta real / Aprovações" },
  { href: "/admin/real-trading/snapshots", label: "Conta real / Snapshots" },
  { href: "/admin/real-trading/preflights", label: "Conta real / Preflights" },
  { href: "/admin/real-trading/instructions", label: "Conta real / Instruções reais" },
  { href: "/admin/real-trading/protection", label: "Conta real / Proteção SL/TP" },
];

export function AdminShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <BrandLogo />
          <div className="flex items-center gap-4">
            <span className="hidden rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-gold sm:inline">
              Administrador
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 lg:grid-cols-[220px_1fr] sm:px-6">
        <SectionNav items={NAV} />
        <main>
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
