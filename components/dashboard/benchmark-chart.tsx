import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { BenchmarkPoint } from "@/lib/dashboard/types";
import { formatPct } from "@/lib/format";

export function BenchmarkChart({ points }: { points: BenchmarkPoint[] }) {
  if (points.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Comparação com Ibovespa</CardTitle>
          <CardDescription>Retorno % no período</CardDescription>
        </CardHeader>
        <p className="text-sm text-muted-foreground">
          Benchmark será exibido quando houver série de equity e dados do
          índice cadastrados.
        </p>
      </Card>
    );
  }

  const width = 640;
  const height = 220;
  const pad = 28;
  const all = points.flatMap((p) => [p.portfolioPct, p.ibovPct]);
  const min = Math.min(...all, 0);
  const max = Math.max(...all, 0);
  const range = max - min || 1;

  const toCoords = (key: "portfolioPct" | "ibovPct") =>
    points
      .map((p, i) => {
        const x = pad + (i / (points.length - 1)) * (width - pad * 2);
        const y =
          height -
          pad -
          ((p[key] - min) / range) * (height - pad * 2);
        return `${x},${y}`;
      })
      .join(" ");

  const last = points[points.length - 1];

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <CardTitle>Comparação com Ibovespa</CardTitle>
          <CardDescription>Retorno percentual acumulado</CardDescription>
        </div>
        <div className="flex gap-6 text-sm">
          <span className="text-gold">
            Carteira {formatPct(last.portfolioPct)}
          </span>
          <span className="text-muted-foreground">
            Ibovespa {formatPct(last.ibovPct)}
          </span>
        </div>
      </CardHeader>
      <div className="mb-3 flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-6 bg-gold" /> Sua evolução
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block h-0.5 w-6 bg-zinc-500" /> Ibovespa
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full max-h-[240px]"
        role="img"
        aria-label="Comparação com Ibovespa"
      >
        <line
          x1={pad}
          x2={width - pad}
          y1={height - pad - ((0 - min) / range) * (height - pad * 2)}
          y2={height - pad - ((0 - min) / range) * (height - pad * 2)}
          stroke="rgb(255 255 255 / 0.12)"
          strokeDasharray="4 4"
        />
        <polyline
          points={toCoords("ibovPct")}
          fill="none"
          stroke="#71717a"
          strokeWidth="2"
        />
        <polyline
          points={toCoords("portfolioPct")}
          fill="none"
          stroke="#c9a227"
          strokeWidth="2.5"
        />
      </svg>
    </Card>
  );
}
