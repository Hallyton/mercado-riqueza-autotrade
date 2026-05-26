import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getRealTradingGuardAdminStatus } from "@/lib/risk/real-trading-guard-status";

function yesNo(value: boolean): string {
  return value ? "Sim" : "Não";
}

function StatusBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-medium text-gold">
      {children}
    </span>
  );
}

function InfoCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

export default async function AdminRealTradingGuardPage() {
  const status = getRealTradingGuardAdminStatus();
  const allowlistConfigured = status.allowedLicenseCount > 0;

  return (
    <div className="space-y-8">
      <Card className="border-gold/20 bg-gold/5 p-6">
        <CardHeader className="p-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusBadge>{status.currentOperationalStatus}</StatusBadge>
            <StatusBadge>{status.defaultPolicy}</StatusBadge>
          </div>
          <CardTitle>Real Trading Guard</CardTitle>
          <CardDescription className="mt-2">
            Visualização operacional somente leitura. Esta tela não altera envs, não
            libera conta real e não cria controles de ativação.
          </CardDescription>
        </CardHeader>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard
          label="ENABLE_REAL_TRADING configurado"
          value={yesNo(status.enableRealTradingConfigured)}
          hint="Valor bruto nunca é exibido."
        />
        <InfoCard
          label="Allowlist configurada"
          value={yesNo(allowlistConfigured)}
          hint="IDs completos nunca são exibidos."
        />
        <InfoCard
          label="Licenças permitidas"
          value={status.allowedLicenseCount}
          hint="Contagem de IDs mascarados."
        />
        <InfoCard
          label="Política padrão"
          value="Bloquear REAL"
          hint="Default deny para conta real."
        />
      </section>

      <Card className="p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle>Status principal</CardTitle>
          <CardDescription>Resumo das travas operacionais atuais.</CardDescription>
        </CardHeader>
        <ul className="space-y-2 text-sm">
          <li>Conta real bloqueada por padrão.</li>
          <li>Produção real não liberada.</li>
          <li>Dispatch automático desativado.</li>
          <li>DEMO permitido conforme regras operacionais existentes.</li>
          <li>REAL exige flag futura e allowlist por licença.</li>
        </ul>
      </Card>

      <Card className="p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle>Diagnóstico conceitual</CardTitle>
          <CardDescription>
            Matriz explicativa da política do guard, sem executar mutações.
          </CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="py-3 pr-4">Cenário</th>
                <th className="py-3 pr-4">Resultado</th>
                <th className="py-3">Observação</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["DEMO", "Permitido", "Segue regras atuais de licença, assinatura e plano."],
                ["REAL sem flag", "Bloqueado", "Política default deny."],
                ["REAL com flag sem allowlist", "Bloqueado", "Flag isolada não libera."],
                [
                  "REAL com flag + allowlist",
                  "Tecnicamente permitido",
                  "Não é liberação operacional; exige gate formal.",
                ],
              ].map(([scenario, result, note]) => (
                <tr key={scenario} className="border-b border-white/5">
                  <td className="py-3 pr-4 font-medium">{scenario}</td>
                  <td className="py-3 pr-4">{result}</td>
                  <td className="py-3 text-muted-foreground">{note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle>Allowlist mascarada</CardTitle>
          <CardDescription>
            Exibe apenas contagem e IDs parcialmente mascarados, sem valores brutos.
          </CardDescription>
        </CardHeader>
        {status.allowedLicenseIdsMasked.length > 0 ? (
          <ul className="space-y-1 font-mono text-xs text-muted-foreground">
            {status.allowedLicenseIdsMasked.map((licenseId) => (
              <li key={licenseId}>{licenseId}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma licença em allowlist.</p>
        )}
      </Card>

      <Card className="border-red-500/30 bg-red-500/10 p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-red-100">Avisos</CardTitle>
          <CardDescription className="text-red-100/80">
            Mensagens de segurança para auditoria operacional.
          </CardDescription>
        </CardHeader>
        <ul className="space-y-2 text-sm text-red-100">
          {status.warningMessages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
