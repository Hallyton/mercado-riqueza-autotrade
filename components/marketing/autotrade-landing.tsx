import Image from "next/image";
import Link from "next/link";
import {
  AUTOTRADE_LANDING_LINKS,
  buildAutotradeWhatsAppEvaluationUrl,
} from "@/lib/commercial/autotrade-landing";

const LOGO_PATH = "/brand/mercado-da-riqueza-logo.png";

export function AutotradeLandingPage() {
  const year = new Date().getFullYear();
  const whatsappUrl = buildAutotradeWhatsAppEvaluationUrl();

  return (
    <>
      <div className="noise" aria-hidden />
      <div className="page">
        <header className="topbar">
          <div className="container nav">
            <a href="#top" className="brand" aria-label="Mercado da Riqueza">
              <div className="brand-logo">
                <Image
                  src={LOGO_PATH}
                  alt="Mercado da Riqueza"
                  width={58}
                  height={58}
                  priority
                />
              </div>
              <div className="brand-text">
                <strong>Mercado da Riqueza</strong>
                <small>AutoTrade · MR Fibo D1 Guard</small>
              </div>
            </a>

            <nav className="nav-links" aria-label="Seções">
              <a href="#produto">Produto</a>
              <a href="#capital">Capital mínimo</a>
              <a href="#risco">Risco</a>
              <a href="#operacoes">Operações</a>
              <a href="#avaliacao">Avaliação</a>
            </nav>

            <a className="btn btn-white" href="#avaliacao">
              Solicitar avaliação
            </a>
          </div>
        </header>

        <main id="top">
          <section className="hero">
            <div className="container hero-grid">
              <div>
                <div className="kicker">AutoTrade · Mini Dólar · B3</div>
                <h1>Robô com risco travado antes da operação acontecer.</h1>
                <p className="hero-copy">
                  O <strong>MR Fibo D1 Guard</strong> é o produto AutoTrade do Mercado da
                  Riqueza para operar Mini Dólar com EA, configuração centralizada no site,
                  stop técnico, stop financeiro diário, monitoramento em tempo real e
                  comandos administrativos de segurança.
                </p>
                <div className="hero-actions">
                  <a className="btn btn-white" href="#capital">
                    Ver capital mínimo
                  </a>
                  <a className="btn btn-dark" href="#risco">
                    Entender as travas
                  </a>
                </div>
              </div>

              <aside className="hero-visual" aria-label="Visual MR Fibo D1 Guard">
                <div className="visual-content">
                  <div className="visual-top">
                    <span>Measure</span>
                    <span>Analyze</span>
                    <span>Implement</span>
                    <span>More</span>
                  </div>
                  <div className="visual-title">
                    <h2>MR Fibo D1 Guard</h2>
                    <p>
                      Estratégia automatizada com autorização pela plataforma, controle de
                      risco diário e gestão operacional pelo EA.
                    </p>
                  </div>
                  <div className="visual-bottom">
                    <span>License</span>
                    <span>Risk</span>
                    <span>Execution</span>
                  </div>
                </div>
              </aside>
            </div>
          </section>

          <section id="produto" className="section">
            <div className="container">
              <div className="section-head">
                <div className="section-label">Produto</div>
                <h2>Uma operação automática, mas nunca sem controle.</h2>
                <p>
                  O cliente não altera a estratégia. A equipe Mercado da Riqueza configura,
                  aprova e monitora. O EA executa somente quando a plataforma confirma que a
                  licença, a conta, o risco e o ambiente estão aptos.
                </p>
              </div>
              <div className="cards-3">
                <article className="card">
                  <small>01 · Estratégia</small>
                  <h3>Fibo D1 Guard</h3>
                  <p>
                    Estratégia baseada em referências do dia anterior, com entrada, stop,
                    parciais, breakeven, trailing, reversão e zeragem dentro da lógica do EA.
                  </p>
                </article>
                <article className="card">
                  <small>02 · Plataforma</small>
                  <h3>Autorização pelo site</h3>
                  <p>
                    O site valida licença ativa, conta vinculada, limite operacional, stop
                    financeiro diário, configuração publicada e comunicação do EA.
                  </p>
                </article>
                <article className="card">
                  <small>03 · Operação</small>
                  <h3>Centro de controle</h3>
                  <p>
                    A equipe acompanha posição aberta, ordens pendentes, resultado
                    diário/mensal e pode pausar ou encerrar operações quando necessário.
                  </p>
                </article>
              </div>
            </div>
          </section>

          <section id="capital" className="section">
            <div className="container">
              <div className="highlight-card">
                <div className="section-label">Mapa de risco</div>
                <h2>Capital mínimo para início da avaliação.</h2>
                <p>
                  A avaliação considera a estrutura mínima do plano operacional com 5
                  contratos no Mini Dólar, stop técnico de 7 pontos e reserva para suportar
                  uma sequência inicial de stops sem encerrar o projeto.
                </p>
                <div className="capital-grid">
                  <div className="capital-box">
                    <span>Volume base</span>
                    <strong>5 contratos</strong>
                  </div>
                  <div className="capital-box">
                    <span>Stop técnico</span>
                    <strong>7 pontos</strong>
                  </div>
                  <div className="capital-box">
                    <span>Margem WDO estimada</span>
                    <strong>R$ 140</strong>
                  </div>
                  <div className="capital-box">
                    <span>Margem para 5 contratos</span>
                    <strong>R$ 700</strong>
                  </div>
                  <div className="capital-box">
                    <span>Reserva de 3 stops</span>
                    <strong>R$ 1.200</strong>
                  </div>
                  <div className="capital-box">
                    <span>Saldo mínimo operacional</span>
                    <strong>R$ 1.900</strong>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="full-bleed">
              <div className="wide-risk">
                <h2 className="big-statement">
                  O stop já precisa estar pago antes da operação acontecer.
                </h2>
                <div className="pill-list">
                  <div className="pill">
                    <span>Risco técnico</span>
                    <strong>7 pontos × 5 contratos = R$ 350</strong>
                  </div>
                  <div className="pill">
                    <span>Risco gerencial recomendado</span>
                    <strong>R$ 400 por stop</strong>
                  </div>
                  <div className="pill">
                    <span>Colchão para 3 stops</span>
                    <strong>R$ 1.200</strong>
                  </div>
                  <div className="pill">
                    <span>Margem mínima considerada</span>
                    <strong>R$ 140 × 5 = R$ 700</strong>
                  </div>
                  <div className="pill">
                    <span>Saldo mínimo operacional</span>
                    <strong>R$ 1.900</strong>
                  </div>
                  <div className="pill">
                    <span>Saldo ideal com folga</span>
                    <strong>R$ 2.500</strong>
                  </div>
                  <div className="pill">
                    <span>Terceiro stop</span>
                    <strong>Pausa técnica, não vingança operacional</strong>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="risco" className="section">
            <div className="container">
              <div className="section-head center">
                <div className="section-label">Gestão de risco</div>
                <h2>Travas em camadas, antes e durante a operação.</h2>
                <p>
                  O risco é controlado em várias etapas: limite da licença, configuração da
                  estratégia, stop financeiro diário, relatório de PnL enviado pelo EA e
                  comandos administrativos pelo site.
                </p>
              </div>
              <div className="data-row">
                <article className="card">
                  <small>Licença</small>
                  <span className="big-number">01</span>
                  <h3>Cliente elegível</h3>
                  <p>
                    O EA só opera se o cliente estiver com licença ativa, conta vinculada,
                    estratégia habilitada e limite operacional aprovado.
                  </p>
                </article>
                <article className="card">
                  <small>Daily Risk</small>
                  <span className="big-number">02</span>
                  <h3>Stop financeiro diário</h3>
                  <p>
                    Além do stop em pontos, a plataforma valida se a perda diária restante
                    comporta o risco da próxima operação.
                  </p>
                </article>
                <article className="card">
                  <small>Operações</small>
                  <span className="big-number">03</span>
                  <h3>Controle remoto</h3>
                  <p>
                    A equipe pode pausar novas entradas, cancelar ordens pendentes, encerrar
                    posições abertas ou solicitar snapshot imediato.
                  </p>
                </article>
              </div>
            </div>
          </section>

          <section id="operacoes" className="section">
            <div className="container">
              <div className="section-head">
                <div className="section-label">Centro de operações</div>
                <h2>Acompanhe o EA como uma mesa operacional.</h2>
                <p>
                  O site mostra se o EA está online, se existe posição aberta, ordens
                  pendentes, resultado do dia, resultado do mês e limite financeiro alocado
                  para cada cliente.
                </p>
              </div>
              <div className="table-wrap">
                <table className="operation-table">
                  <thead>
                    <tr>
                      <th>Monitoramento</th>
                      <th>O que aparece</th>
                      <th>Decisão operacional</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <span className="tag">EA</span>
                      </td>
                      <td>
                        Online/offline, heartbeat, versão, configuração carregada e último
                        erro.
                      </td>
                      <td>
                        Confirmar se o robô está apto antes de aceitar novas entradas.
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <span className="tag">Posição</span>
                      </td>
                      <td>
                        Lado, quantidade, preço médio, preço atual e PnL aberto.
                      </td>
                      <td>
                        Saber se o cliente está em operação e qual é a exposição atual.
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <span className="tag">Ordens</span>
                      </td>
                      <td>
                        Ordens pendentes, takes, stops e ordens ainda não executadas.
                      </td>
                      <td>
                        Cancelar pendentes quando necessário sem confundir com fechamento de
                        posição.
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <span className="tag">Resultado</span>
                      </td>
                      <td>
                        Resultado do dia, resultado do mês, PnL aberto e realizado.
                      </td>
                      <td>
                        Acompanhar evolução por cliente e limitar novas operações quando
                        necessário.
                      </td>
                    </tr>
                    <tr>
                      <td>
                        <span className="tag">Limite</span>
                      </td>
                      <td>
                        MaxContracts, limite diário, usado, restante e risco estimado.
                      </td>
                      <td>
                        Evitar que o robô opere acima do limite aprovado pela gestão.
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="container">
              <div className="section-head">
                <div className="section-label">Comandos</div>
                <h2>Intervenção segura pelo site.</h2>
                <p>
                  Quando o mercado exigir decisão humana, a equipe pode agir pelo painel sem
                  acessar manualmente cada VPS.
                </p>
              </div>
              <div className="cards-3">
                {[
                  ["Pausa", "Pausar novas entradas", "Bloqueia novas operações sem abandonar a gestão de uma posição que já esteja aberta."],
                  ["Ordens", "Cancelar pendentes", "Cancela ordens que ainda não foram executadas, sem fechar posição automaticamente."],
                  ["Posição", "Encerrar posição", "Solicita ao EA o fechamento da posição aberta, com resposta e auditoria do comando."],
                  ["Controle", "Encerrar tudo e pausar", "Fecha posição, cancela pendentes e impede novas entradas até liberação administrativa."],
                  ["Status", "Atualizar snapshot", "Solicita ao EA uma atualização imediata de posição, PnL, pendentes e estado operacional."],
                  ["Retomada", "Retomar operações", "Libera a estratégia para voltar a operar quando todos os gates de risco estiverem válidos."],
                ].map(([small, title, body]) => (
                  <article className="card" key={title}>
                    <small>{small}</small>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="section">
            <div className="container cards-2">
              <div className="card">
                <small>Para quem é</small>
                <h3>Perfil adequado</h3>
                <ul className="list">
                  <li>Cliente que entende que Mini Dólar envolve risco real.</li>
                  <li>Cliente que aceita limite financeiro diário e pausa técnica.</li>
                  <li>Cliente que deseja automação com acompanhamento profissional.</li>
                  <li>Cliente que não quer alterar a lógica interna da estratégia.</li>
                </ul>
              </div>
              <div className="card">
                <small>Para quem não é</small>
                <h3>Perfil inadequado</h3>
                <ul className="list">
                  <li>Quem busca promessa de lucro fixo ou garantia de resultado.</li>
                  <li>Quem quer operar sem reserva para stops.</li>
                  <li>Quem não aceita slippage, rejeição de ordens ou falha de conexão.</li>
                  <li>Quem não aceita parar após limite de risco atingido.</li>
                </ul>
              </div>
            </div>
          </section>

          <section id="avaliacao" className="section">
            <div className="container">
              <div className="cta-box">
                <div className="section-label">Avaliação</div>
                <h2>Comece pela análise operacional.</h2>
                <p>
                  Para iniciar a avaliação do MR Fibo D1 Guard, recomendamos saldo mínimo
                  operacional de <strong>R$ 1.900</strong> e saldo ideal com folga de{" "}
                  <strong>R$ 2.500</strong>, considerando a estrutura-base de 5 contratos,
                  stop de 7 pontos, margem estimada e reserva para 3 stops.
                </p>
                <div className="cta-actions">
                  {whatsappUrl ? (
                    <a
                      className="btn btn-white"
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Solicitar avaliação
                    </a>
                  ) : (
                    <Link className="btn btn-white" href={AUTOTRADE_LANDING_LINKS.cadastro}>
                      Solicitar avaliação
                    </Link>
                  )}
                  <Link className="btn btn-dark" href={AUTOTRADE_LANDING_LINKS.cadastro}>
                    Iniciar cadastro
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="container">
              <div className="section-head center">
                <div className="section-label">FAQ</div>
                <h2>Perguntas importantes antes de operar.</h2>
              </div>
              <div className="faq">
                {[
                  [
                    "O produto garante lucro?",
                    "Não. O produto não garante lucro, rentabilidade ou recuperação de perdas. Ele oferece automação, processo, gestão de risco e monitoramento, mas operações em renda variável podem gerar perdas.",
                  ],
                  [
                    "Por que exigimos capital mínimo?",
                    "Porque a operação precisa nascer com margem e reserva de risco. A estratégia-base considera 5 contratos, stop de 7 pontos, margem estimada e colchão operacional para suportar uma sequência inicial de stops.",
                  ],
                  [
                    "O que acontece no terceiro stop?",
                    "A regra gerencial considera pausa técnica e revisão obrigatória. O terceiro stop não é convite para aumentar mão ou buscar vingança operacional.",
                  ],
                  [
                    "O cliente configura a estratégia?",
                    "Não. O modelo é caixa preta. Os parâmetros são administrados pelo Mercado da Riqueza para preservar a consistência da estratégia e o controle operacional.",
                  ],
                  [
                    "O EA pode falhar mesmo com o cliente elegível?",
                    "Sim. Pode haver falha de conexão, rejeição de corretora, mercado fechado, preço inválido, instabilidade da VPS ou erro do MetaTrader. Por isso o Centro de Operações acompanha status, snapshots, comandos e erros.",
                  ],
                ].map(([question, answer]) => (
                  <details key={question}>
                    <summary>{question}</summary>
                    <p>{answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </section>
        </main>

        <div className="disclaimer">
          <div className="container">
            <strong>Aviso de risco:</strong> operações em contratos futuros, Mini Dólar,
            renda variável e derivativos envolvem risco elevado e podem gerar perdas
            financeiras. As informações desta página são comerciais e operacionais, não
            constituem promessa de rentabilidade, recomendação individual de investimento ou
            garantia de resultado. Resultados passados, simulações, backtests ou automações
            não asseguram resultados futuros. O uso do AutoTrade depende de licença ativa,
            aceite de risco, conta compatível, margem, conexão, VPS, MetaTrader, corretora e
            autorização operacional da plataforma.
          </div>
        </div>

        <footer className="footer">
          <div className="container footer-row">
            <div>© {year} Mercado da Riqueza AutoTrade.</div>
            <div>
              <Link href={AUTOTRADE_LANDING_LINKS.termos}>Termos</Link>
              {" · "}
              <Link href={AUTOTRADE_LANDING_LINKS.planos}>Planos</Link>
              {" · "}
              <a href="#top">Voltar ao topo</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
