import Link from "next/link";
import { BrandLogo } from "@/components/brand/logo";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  nav,
  title,
  subtitle,
  badge,
}: {
  children: React.ReactNode;
  nav: { href: string; label: string; active?: boolean }[];
  title: string;
  subtitle?: string;
  badge?: string;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <BrandLogo />
          <div className="flex items-center gap-4">
            {badge && (
              <span className="hidden rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-gold sm:inline">
                {badge}
              </span>
            )}
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 lg:grid-cols-[220px_1fr] sm:px-6">
        <aside className="space-y-1">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                item.active
                  ? "bg-gold/15 text-gold"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </aside>

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
