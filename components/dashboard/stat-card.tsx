import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  className,
  valueClassName,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-card/90 p-5 shadow-lg shadow-black/30",
        className
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl",
          valueClassName
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
