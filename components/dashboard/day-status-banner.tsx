import {
  DAY_STATUS_LABELS,
  dayStatusBadgeClass,
} from "@/lib/dashboard/day-status";
import type { DayOperationalStatus } from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

export function DayStatusBanner({
  status,
  message,
}: {
  status: DayOperationalStatus;
  message: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border px-6 py-5 shadow-lg shadow-black/20",
        dayStatusBadgeClass(status)
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">
        Status do dia
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight">
        {DAY_STATUS_LABELS[status]}
      </p>
      <p className="mt-2 max-w-2xl text-sm opacity-90">{message}</p>
    </div>
  );
}
