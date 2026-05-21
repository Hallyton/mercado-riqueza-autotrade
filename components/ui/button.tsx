import { cn } from "@/lib/utils";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
  isLoading?: boolean;
};

export function Button({
  className,
  variant = "primary",
  isLoading,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" &&
          "bg-gold text-black hover:bg-gold-light shadow-lg shadow-gold/20",
        variant === "ghost" &&
          "text-muted-foreground hover:bg-white/5 hover:text-foreground",
        variant === "outline" &&
          "border border-gold/40 text-gold hover:border-gold hover:bg-gold/10",
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? "Aguarde…" : children}
    </button>
  );
}
