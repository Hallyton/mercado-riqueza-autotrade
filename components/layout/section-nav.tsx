"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function SectionNav({
  items,
}: {
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();

  return (
    <aside className="space-y-1">
      {items.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" &&
            item.href !== "/admin" &&
            pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-gold/15 text-gold"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </aside>
  );
}
