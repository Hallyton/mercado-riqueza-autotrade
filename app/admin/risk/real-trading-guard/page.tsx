import Link from "next/link";
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
  const status = await getRealTradingGuardAdminStatus();
  const manualOrEnvAllowlist =
    status.manualAllowlistConfigured || status.envAllowlistLicenseCount > 0;

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
            Visualização operacional somente leitura para envs. Esta tela não altera
            ENABLE_REAL_TRADING, não libera REAL globalmente e não envia ordens.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-gold/30 bg-gold/5 p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle>Liberação manual controlada</CardTitle>
          <CardDescription>
            Conta real permanece bloqueada por padrão. Para autorizar uma operação
            real, crie uma aprovação específica por licença, conta, símbolo e
            magicNumber. Para novas licenças, não é necessário alterar variáveis no
            Vercel — o controle operacional é a RealTradingApproval APPROVED no banco.
            A aprovação não envia ordem, não ativa dispatch automático e não substitui
            o preflight.
          </CardDescription>
        </CardHeader>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin/real-trading/approvals"
            className="rounded-md border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-medium text-gold hover:bg-gold/20"
          >
            Ver aprovações reais
          </Link>
          <Link
            href="/admin/real-trading/approvals/new"
            className="rounded-md bg-gold px-4 py-2 text-sm font-medium text-black hover:opacity-90"
          >
            Criar aprovação controlada
          </Link>
        </div>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard
          label="ENABLE_REAL_TRADING configurado"
          value={yesNo(status.enableRealTradingConfigured)}
          hint="Master switch — valor bruto nunca é exibido."
        />
        <InfoCard
          label="Allowlist manual ativa"
          value={yesNo(status.manualAllowlistConfigured)}
          hint="Aprovações APPROVED + allowReal no banco."
        />
        <InfoCard
          label="Licenças permitidas (aprovações ativas)"
          value={status.activeManualApprovalCount}
          hint="Contagem de aprovações manuais APPROVED."
        />
        <InfoCard
          label="Allowlist env (opcional)"
          value={status.envAllowlistLicenseCount}
hint="Opcional/emergencial. Se vazia, basta RealTradingApproval APPROVED."
        />
        <InfoCard
          label="Política padrão"
          value="Bloquear REAL"
          hint="Default deny fora do gate completo."
        />
      </section>

      <Card className="p-6">
        <CardHeader className="p-0 pb-4">
          <CardTitle>Status principal</CardTitle>
          <CardDescription>Resumo das travas operacionais atuais.</CardDescription>
        </CardHeader>
        <ul className="space-y-2 text-sm">
          <li>Conta real bloqueada por padrão.</li>
          <li>REAL exige master switch + RealTradingApproval APPROVED.</li>
          <li>
            Allowlist env (REAL_TRADING_ALLOWED_LICENSE_IDS) é opcional — trava
            adicional quando preenchida; aprovação manual no banco é o caminho
            operacional.
          </li>
          <li>Produção real global não liberada por esta tela.</li>
          <li>Dispatch automático desativado.</li>
          <li>DEMO permitido conforme regras existentes.</li>
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
                ["DEMO", "Permitido", "Segue regras atuais de licença e plano."],
                ["REAL sem master switch", "Bloqueado", "ENABLE_REAL_TRADING off."],
                [
                  "REAL com master switch sem approval",
                  "Bloqueado",
                  "Exige RealTradingApproval APPROVED.",
                ],
                [
                  "REAL com approval APPROVED",
                  "Pode seguir para preflight",
                  "Ainda exige snapshot, margem, EA online, SL/TP.",
                ],
                [
                  "REAL + approval + allowlist env vazia",
                  "Permitido no guard",
                  "Sem editar Vercel para cada licença nova.",
                ],
                [
                  "REAL + approval + allowlist env sem a licença",
                  "Bloqueado",
                  "Trava adicional REAL_TRADING_ALLOWED_LICENSE_IDS.",
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
          <CardTitle>Referências mascaradas</CardTitle>
          <CardDescription>
            Aprovações manuais ativas e allowlist env opcional (IDs parciais).
          </CardDescription>
        </CardHeader>
        {manualOrEnvAllowlist ? (
          <ul className="space-y-1 font-mono text-xs text-muted-foreground">
            {status.allowedLicenseIdsMasked.map((entry, index) => (
              <li key={`${entry}-${index}`}>{entry}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nenhuma aprovação manual ativa nem allowlist env configurada.
          </p>
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
