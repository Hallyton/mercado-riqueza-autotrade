import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-gold/40 bg-gold/10"
        aria-hidden
      >
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 text-gold"
          fill="currentColor"
        >
          <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.2l5.5 3.4v6.8L12 18.8 6.5 14.4V7.6L12 4.2z" />
          <path d="M12 8v8M9 11h6" stroke="currentColor" strokeWidth="1.5" fill="none" />
        </svg>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold">
          Mercado da Riqueza
        </p>
        <p className="text-sm font-semibold text-foreground">AutoTrade</p>
      </div>
    </div>
  );
}
