"use client";

import { useState } from "react";
import { useSession } from "@/lib/use-session";

/**
 * Tutorial de cada tela do painel, com print de verdade e passo a passo.
 *
 * Nasceu de uma dúvida concreta: "a comissão não está funcionando" — quando
 * na real faltava configurar o percentual, que fica escondido dentro do
 * "Editar" de cada barbeiro. Por isso cada seção mostra ONDE clicar, não só
 * o que a tela faz.
 */

interface Secao {
  id: string;
  titulo: string;
  resumo: string;
  imagem: string;
  alt: string;
  passos: string[];
  aviso?: string;
}

const SECOES: Secao[] = [
  {
    id: "comissao",
    titulo: "Configurar a comissão do barbeiro",
    resumo:
      "O percentual de cada barbeiro fica escondido dentro do \"Editar\" — é o ponto que mais gera dúvida.",
    imagem: "/tutorial/barbeiros-editar.png",
    alt: "Modal de editar barbeiro, com o campo de comissão sobre serviço em destaque",
    passos: [
      "Vá em Barbeiros, no menu da esquerda.",
      "Clique em \"Editar\" no barbeiro que você quer configurar.",
      "No campo \"Comissão sobre serviço\", digite o percentual (ex.: 30 para 30%).",
      "Clique em Salvar.",
    ],
    aviso:
      "A comissão incide só sobre serviço, nunca sobre produto — o estoque é da barbearia. Deixe em 0 se a pessoa recebe por diária ou salário fixo.",
  },
  {
    id: "agenda",
    titulo: "Confirmar e concluir um agendamento",
    resumo:
      "Um horário passa por dois estágios: confirmado (reservado) e concluído (atendido de verdade) — e é só o segundo que conta pra comissão.",
    imagem: "/tutorial/agenda.png",
    alt: "Agenda da semana mostrando os horários marcados",
    passos: [
      "Agendamento pago no local ou por Mercado Pago já entra confirmado sozinho.",
      "Pix direto entra como pendente — confirme só depois de ver o Pix cair no seu extrato.",
      "No dia do atendimento, marque como \"Concluído\" — é isso que faz a comissão e a baixa de produto valerem de verdade.",
    ],
    aviso:
      "Enquanto está só \"confirmado\", a comissão aparece como previsto, não como valor a pagar — assim uma falta não vira comissão paga à toa.",
  },
  {
    id: "comissoes",
    titulo: "Ver quanto pagar pra equipe",
    resumo: "Fecha o período, mostra quanto cada barbeiro produziu e quanto sai da gaveta.",
    imagem: "/tutorial/comissoes.png",
    alt: "Tela de comissões mostrando o valor a pagar por barbeiro",
    passos: [
      "Escolha o período (7, 15 ou 30 dias, ou datas específicas).",
      "Clique no nome do barbeiro pra abrir o detalhe: quanto ele produziu e quanto é a comissão.",
      "Depois de pagar por fora (Pix, dinheiro), clique em \"Registrar como paga\" — isso só marca que já foi pago, não move dinheiro nenhum.",
    ],
  },
  {
    id: "caixa",
    titulo: "Ver o que foi vendido",
    resumo: "Serviços prestados, produtos vendidos e o que já caiu na conta vs. o que ainda é pra cobrar no balcão.",
    imagem: "/tutorial/caixa.png",
    alt: "Tela de caixa mostrando o resumo do dia",
    passos: [
      "Escolha o período no topo da tela.",
      "\"Recebido\" é o que já está garantido; \"a receber\" é o que ainda depende do balcão ou de um Pix pendente.",
    ],
  },
  {
    id: "servicos",
    titulo: "Cadastrar os serviços",
    resumo: "O catálogo que aparece na sua página pública, com preço e duração.",
    imagem: "/tutorial/servicos.png",
    alt: "Lista de serviços cadastrados",
    passos: [
      "Preencha nome, categoria, preço e duração.",
      "A duração decide quantos blocos de horário o serviço ocupa na agenda — vale caprichar nela.",
      "Desative em vez de excluir um serviço que você parou de oferecer: assim o histórico de quem já marcou continua íntegro.",
    ],
  },
  {
    id: "produtos",
    titulo: "Cadastrar produtos (Pro)",
    resumo: "Produtos que aparecem na loja pública, com controle de estoque.",
    imagem: "/tutorial/produtos.png",
    alt: "Lista de produtos cadastrados",
    passos: [
      "Preencha nome, categoria, preço e o estoque inicial.",
      "O estoque só desconta de verdade quando o pedido é confirmado — nunca no momento em que o cliente só coloca no carrinho.",
    ],
  },
  {
    id: "estoque",
    titulo: "Controlar entradas e saídas (Pro)",
    resumo: "Toda movimentação de produto fica registrada — reposição, venda avulsa no balcão, perda.",
    imagem: "/tutorial/estoque.png",
    alt: "Tela de controle de estoque",
    passos: [
      "Escolha o produto, se é entrada ou saída, a quantidade e o motivo.",
      "Produto com estoque baixo (5 ou menos) aparece em amarelo; zerado, em vermelho.",
    ],
  },
  {
    id: "pagamentos",
    titulo: "Conectar Mercado Pago ou Pix",
    resumo: "Escolha como sua barbearia recebe: Mercado Pago (automático) e/ou Pix na sua própria chave.",
    imagem: "/tutorial/pagamentos.png",
    alt: "Tela de configuração de pagamentos",
    passos: [
      "Pra Mercado Pago: clique em conectar e faça login com a conta da barbearia — o dinheiro cai direto nela, a Navalha nunca fica no meio.",
      "Pra Pix: cadastre sua chave, nome e cidade. Sem webhook, a confirmação é manual: você olha o extrato e confirma o agendamento.",
    ],
  },
  {
    id: "localizacao",
    titulo: "Endereço e horário de funcionamento",
    resumo: "O que aparece na sua página pública: endereço, mapa, dias e horário — inclusive exceções por dia.",
    imagem: "/tutorial/localizacao.png",
    alt: "Tela de localização e horário de funcionamento",
    passos: [
      "Digite o CEP pra preencher o endereço sozinho.",
      "Marque os dias que funciona; se um dia tiver horário diferente (sábado que fecha mais cedo, por exemplo), configure a exceção dele.",
    ],
  },
  {
    id: "relatorios",
    titulo: "Relatórios (Pro)",
    resumo: "Faturamento e estoque, por período, pra fechar o mês.",
    imagem: "/tutorial/relatorios.png",
    alt: "Tela de relatórios",
    passos: ["Escolha o período e o tipo de relatório que quer ver."],
  },
  {
    id: "suporte",
    titulo: "Falar com a Navalha",
    resumo: "Uma conversa só, contínua — dono e barbeiro escrevem na mesma linha.",
    imagem: "/tutorial/suporte.png",
    alt: "Tela de chat de suporte",
    passos: [
      "Escreva sua dúvida ou mande uma foto.",
      "O suporte responde por aqui — não precisa ficar recarregando a página, atualiza sozinho.",
    ],
  },
];

export default function AjudaPage() {
  const session = useSession();
  const [aberta, setAberta] = useState<string>(SECOES[0].id);

  if (!session) return null;

  return (
    <div>
      <p className="font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">Ajuda</p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
        Como usar cada tela
      </h1>
      <p className="mt-1 max-w-lg font-body text-sm text-bone-dim">
        Print de verdade do sistema, com o passo a passo de onde clicar.
      </p>

      {/* ---------- Índice ---------- */}
      <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
        {SECOES.map((s) => (
          <button
            key={s.id}
            onClick={() => setAberta(s.id)}
            className={`shrink-0 rounded-full border px-4 py-2 font-body text-sm font-semibold transition-colors ${
              aberta === s.id
                ? "border-gold-bright bg-gold-bright/10 text-gold-bright"
                : "border-line-strong text-bone-dim hover:border-gold-bright/40 hover:text-bone"
            }`}
          >
            {s.titulo}
          </button>
        ))}
      </div>

      {/* ---------- Seções ---------- */}
      <div className="mt-8 space-y-10">
        {SECOES.filter((s) => s.id === aberta).map((s) => (
          <section key={s.id} className="rounded-2xl border border-line bg-ink-elev/60 p-6">
            <h2 className="font-display text-xl font-semibold text-bone">{s.titulo}</h2>
            <p className="mt-1.5 max-w-2xl font-body text-sm text-bone-dim">{s.resumo}</p>

            <div className="mt-5 overflow-hidden rounded-xl border border-line-strong bg-ink">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.imagem} alt={s.alt} className="w-full" />
            </div>

            <ol className="mt-5 space-y-2.5">
              {s.passos.map((p, i) => (
                <li key={i} className="flex gap-3 font-body text-sm text-bone-dim">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-bright/15 font-accent text-[11px] font-bold text-gold-bright">
                    {i + 1}
                  </span>
                  <span className="text-bone">{p}</span>
                </li>
              ))}
            </ol>

            {s.aviso && (
              <p className="mt-4 rounded-lg border border-gold-bright/30 bg-gold-bright/10 px-3.5 py-2.5 font-body text-xs text-gold-bright">
                {s.aviso}
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
