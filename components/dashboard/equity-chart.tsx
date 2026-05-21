import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EquityPoint } from "@/lib/dashboard/types";
import { formatBrl } from "@/lib/format";

export function EquityChart({ points }: { points: EquityPoint[] }) {
  if (points.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Evolução patrimonial</CardTitle>
          <CardDescription>
            Dados aparecem após sincronizações do EA
          </CardDescription>
        </CardHeader>
        <p className="text-sm text-muted-foreground">
          Ainda não há histórico suficiente de equity.
        </p>
      </Card>
    );
  }

  const width = 640;
  const height = 220;
  const pad = 24;
  const values = points.map((p) => p.equity);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2);
    const y =
      height - pad - ((p.equity - min) / range) * (height - pad * 2);
    return { x, y, ...p };
  });

  const line = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const area = `${coords[0].x},${height - pad} ${line} ${coords[coords.length - 1].x},${height - pad}`;

  const last = points[points.length - 1];
  const first = points[0];
  const change =
    first.equity > 0
      ? ((last.equity - first.equity) / first.equity) * 100
      : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-4">
        <div>
          <CardTitle>Evolução patrimonial</CardTitle>
          <CardDescription>Equity da conta autorizada</CardDescription>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gold">{formatBrl(last.equity)}</p>
          <p
            className={
              change >= 0 ? "text-sm text-emerald-400" : "text-sm text-red-400"
            }
          >
            {change >= 0 ? "+" : ""}
            {change.toFixed(2)}% no período
          </p>
        </div>
      </CardHeader>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full max-h-[240px]"
        role="img"
        aria-label="Gráfico de evolução patrimonial"
      >
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(201 162 39 / 0.35)" />
            <stop offset="100%" stopColor="rgb(201 162 39 / 0)" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <line
              key={t}
              x1={pad}
              x2={width - pad}
              y1={height - pad - t * (height - pad * 2)}
              y2={height - pad - t * (height - pad * 2)}
              stroke="rgb(255 255 255 / 0.06)"
              strokeWidth="1"
            />
          ))}
        <polygon points={area} fill="url(#equityFill)" />
        <polyline
          points={line}
          fill="none"
          stroke="#c9a227"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          cx={coords[coords.length - 1].x}
          cy={coords[coords.length - 1].y}
          r="4"
          fill="#e4c65b"
        />
      </svg>
    </Card>
  );
}
