export type PlanId = "basico" | "pro";

export interface Plan {
  id: PlanId;
  name: string;
  /** Como aparece na tela. O valor cobrado sai de `valor`. */
  price: string;
  /** Valor mensal em reais, usado na cobrança do Mercado Pago. */
  valor: number;
  tagline: string;
  features: string[];
  highlight: boolean;
  /** Os dois planos têm o mesmo período grátis. */
  temTrial: boolean;
}

/**
 * Um mês grátis nos dois planos.
 *
 * Sete dias não davam pra barbearia cadastrar serviço, subir foto, montar a
 * equipe e ainda ver o sistema rodando num ciclo real de agenda — ela
 * decidia sem nunca ter usado de verdade. E o Pro cobrado desde o primeiro
 * dia empurrava todo mundo pro Básico, que é justamente o plano onde não
 * dá pra experimentar equipe, estoque e loja.
 */
export const TRIAL_DAYS = 30;

export const PLANS: Plan[] = [
  {
    id: "basico",
    temTrial: true,
    name: "Básico",
    price: "159,99",
    valor: 159.99,
    tagline: "Pra sair do caderno e da agenda manual.",
    features: [
      "Agenda da semana com horários dos clientes",
      "Confirmação de agendamento pago no local",
      "Horário de funcionamento configurável",
      "Cadastro de serviços por categoria, com foto",
      "Página pública com endereço e mapa",
      "Pagamento online via Mercado Pago ou Pix na sua chave",
    ],
    highlight: false,
  },
  {
    id: "pro",
    temTrial: true,
    name: "Pro",
    price: "259,95",
    valor: 259.95,
    tagline: "Pra equipe inteira, com loja e estoque de verdade.",
    features: [
      "Tudo do plano Básico",
      "Sistema de controle de estoque (entradas, saídas e alerta de estoque baixo)",
      "Loja de produtos integrada na página pública",
      "Painel individual para cada barbeiro, com login próprio",
      "Barbeiros ilimitados na equipe",
      "Comissão por barbeiro, com percentual próprio sobre o serviço",
      "Relatórios de faturamento e relatório mensal de estoque",
      "Suporte prioritário",
    ],
    highlight: true,
  },
];

export function getPlan(id: string | null | undefined): Plan {
  return PLANS.find((p) => p.id === id) ?? PLANS[0];
}
