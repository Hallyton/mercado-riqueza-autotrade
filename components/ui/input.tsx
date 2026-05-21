import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-lg border border-white/10 bg-black/40 px-4 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-gold/50 focus:outline-none focus:ring-2 focus:ring-gold/20",
        className
      )}
      {...props}
    />
  );
}

export function Label({
  className,
  children,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1.5 block text-sm font-medium text-muted-foreground", className)}
      {...props}
    >
      {children}
    </label>
  );
}
