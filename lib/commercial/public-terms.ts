/** Rota pública dos termos comerciais/beta. */
export const COMMERCIAL_TERMS_PATH = "/termos/autotrade";

export const COMMERCIAL_TERMS_TITLE =
  "Termos de Uso Comercial/Beta — Mercado da Riqueza AutoTrade";

export const COMMERCIAL_TERMS_VERSION_NOTICE =
  "Este documento é uma versão comercial/beta e pode ser substituído por contrato formal.";

export const COMMERCIAL_TERMS_SECTIONS = [
  {
    title: "Natureza do produto",
    body: "O Mercado da Riqueza AutoTrade é uma solução tecnológica de automação operacional para MetaTrader. A assinatura dá acesso ao uso do robô e da licença conforme o plano contratado.",
  },
  {
    title: "Tecnologia proprietária",
    body: "O robô opera com tecnologia proprietária e parâmetros protegidos do Mercado da Riqueza. O cliente acompanha status, licença, assinatura, device, robô, magicNumber, snapshots, execução e proteção pelo portal — sem acesso à lógica interna da estratégia, filtros, horários, stops, alvos ou regras operacionais detalhadas.",
  },
  {
    title: "Sem promessa de resultado",
    body: "Não há promessa de rentabilidade, lucro garantido ou resultado futuro. Resultados passados, simulações, testes ou ambiente demo não garantem desempenho futuro.",
  },
  {
    title: "Riscos de mercado",
    body: "Operações no mercado financeiro envolvem risco de perda parcial ou total do capital. O cliente declara ciência desses riscos ao aceitar estes termos.",
  },
  {
    title: "Conta real e aprovação operacional",
    body: "Conta real depende de aprovação administrativa e operacional. Pagamento em dia não libera operação real automaticamente. Operação real exige licença ativa, device ativo, margem disponível, aprovação manual, preflight aprovado, Real Trading Guard, dispatch manual quando aplicável e confirmação das proteções obrigatórias.",
  },
  {
    title: "Obrigações do cliente",
    body: "O cliente deve manter sua conta MT5 e corretora em conformidade com as orientações operacionais e requisitos de margem informados pela plataforma.",
  },
  {
    title: "Suspensão e uso indevido",
    body: "O Mercado da Riqueza pode suspender licença, device ou operação em caso de risco, falha, divergência, inadimplência ou uso indevido, conforme políticas internas documentadas.",
  },
  {
    title: "Propriedade intelectual",
    body: "A estratégia, parâmetros, filtros, lógica, gatilhos, horários, stops, alvos e regras internas são propriedade intelectual protegida. É vedado tentar acessar, copiar, reverter ou divulgar elementos internos do robô.",
  },
  {
    title: "Aceite eletrônico",
    body: "O aceite eletrônico no cadastro ou solicitação de assinatura registra concordância com estes termos e com os avisos de risco associados.",
  },
] as const;

/** Textos institucionais — interfaces públicas (sem “caixa preta”). */
export const PUBLIC_PLANOS_COPY = {
  subtitle:
    "Automação operacional com tecnologia proprietária do Mercado da Riqueza. Você acompanha assinatura, licença, robô, status do EA, conta autorizada, magicNumber, execuções e controles de risco pelo portal — enquanto a lógica interna, parâmetros e regras operacionais permanecem protegidos.",
  complement:
    "O plano inicial permite 1 robô ativo por cliente, com assinatura mensal de R$ 300,00. A estrutura está preparada para expansão futura até 4 robôs, sempre mediante aprovação administrativa.",
  riskBlock:
    "Operações no mercado financeiro envolvem risco. Não há promessa de rentabilidade, lucro garantido ou resultado futuro. Conta real depende de aprovação operacional, margem disponível, device ativo, preflight aprovado e confirmação das proteções obrigatórias.",
} as const;

export const PUBLIC_PORTAL_ROBOT_COPY =
  "O robô utiliza tecnologia proprietária do Mercado da Riqueza. O cliente acompanha status, licença, device, magicNumber e eventos operacionais permitidos, sem acesso à lógica interna da estratégia.";

export const SIGNUP_ACCEPTANCE_LABELS = {
  terms:
    "Li e aceito os Termos de Uso Comercial/Beta.",
  risk: "Estou ciente dos riscos de mercado, incluindo possibilidade de perda parcial ou total do capital.",
  noReturn:
    "Estou ciente de que não há promessa de rentabilidade, lucro garantido ou resultado futuro.",
  realApproval:
    "Entendo que operação em conta real depende de aprovação administrativa, validações operacionais e controles de risco. Pagamento em dia não libera conta real automaticamente.",
  proprietary:
    "Aceito que a tecnologia do robô utiliza lógica proprietária e parâmetros protegidos, sem acesso à estratégia interna.",
} as const;

/** Frases proibidas em copy pública comercial principal. */
export const FORBIDDEN_PUBLIC_COMMERCIAL_PHRASES = [
  "caixa preta",
  "lucro garantido",
  "renda garantida",
  "rentabilidade garantida",
] as const;
