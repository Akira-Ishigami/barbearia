"use client";

import { getAgendamentos, getBarbearia, getBarbeiros, getProdutos } from "@/lib/db";
import { toISODate } from "@/lib/date";
import { useSession } from "@/lib/use-session";
import { useAsync } from "@/lib/use-async";
import { BotaoUpgrade } from "@/components/BotaoUpgrade";

const ESTOQUE_BAIXO = 5;
const MES_ATUAL = new Date().toLocaleDateString("pt-BR", {
  month: "long",
  year: "numeric",
});

export default function RelatoriosPage() {
  const session = useSession();
  const dono = session?.role === "dono";

  const { dados } = useAsync(
    async () => {
      const id = session!.barbeariaId;
      const [barbearia, barbeiros, agendamentos, produtos] = await Promise.all([
        getBarbearia(id),
        getBarbeiros(id),
        getAgendamentos(id),
        getProdutos(id),
      ]);
      return { barbearia, barbeiros, agendamentos, produtos };
    },
    [session?.barbeariaId],
    { pular: !dono },
  );

  const barbearia = dados?.barbearia;

  if (!session || !dono) return null;

  if (barbearia?.plano !== "pro") {
    return (
      <div>
        <p className="font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">
          Relatórios
        </p>
        <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
          Relatórios de agendamentos e faturamento
        </h1>
        <div className="mt-8 rounded-2xl border border-gold-bright/30 bg-gold-bright/5 p-8 text-center">
          <p className="font-display text-lg font-semibold text-bone">
            Exclusivo do plano Pro
          </p>
          <p className="mx-auto mt-2 max-w-md font-body text-sm text-bone-dim">
            Acompanhe faturamento por barbeiro, taxa de conclusão e o
            histórico completo de agendamentos fazendo upgrade pro Pro.
          </p>
          <BotaoUpgrade />
        </div>
      </div>
    );
  }

  const barbeiros = dados?.barbeiros ?? [];
  const hoje = toISODate(new Date());
  const agendamentos = (dados?.agendamentos ?? []).filter((a) => a.data === hoje);

  const total = agendamentos.length;
  const concluidos = agendamentos.filter((a) => a.status === "concluido").length;
  const cancelados = agendamentos.filter((a) => a.status === "cancelado").length;
  const pendentes = agendamentos.filter((a) => a.status === "pendente").length;
  // Pendente ainda não foi pago/confirmado, então não conta como faturamento.
  const faturamento = agendamentos
    .filter((a) => a.status === "confirmado" || a.status === "concluido")
    .reduce((sum, a) => sum + a.preco, 0);
  const taxaConclusao = total > 0 ? Math.round((concluidos / total) * 100) : 0;

  const porBarbeiro = barbeiros
    .map((b) => {
      const dele = agendamentos.filter(
        (a) =>
          a.barbeiroId === b.id &&
          (a.status === "confirmado" || a.status === "concluido"),
      );
      return {
        nome: b.nome,
        total: dele.reduce((sum, a) => sum + a.preco, 0),
        qtd: dele.length,
      };
    })
    .filter((b) => b.qtd > 0)
    .sort((a, b) => b.total - a.total);

  const maiorFaturamento = Math.max(1, ...porBarbeiro.map((b) => b.total));

  const produtos = dados?.produtos ?? [];
  const valorEmEstoque = produtos.reduce((sum, p) => sum + p.preco * p.estoque, 0);
  const unidadesEmEstoque = produtos.reduce((sum, p) => sum + p.estoque, 0);
  const semEstoque = produtos.filter((p) => p.estoque === 0).length;
  const estoqueBaixo = produtos.filter((p) => p.estoque > 0 && p.estoque <= ESTOQUE_BAIXO).length;

  return (
    <div>
      <p className="font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">
        Relatórios
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold text-bone">
        Agendamentos e faturamento
      </h1>
      <p className="mt-1 font-body text-sm text-bone-dim">
        Resumo de hoje, com base nos agendamentos registrados.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-5">
        {[
          ["Faturamento", `R$ ${faturamento.toFixed(2).replace(".", ",")}`],
          ["Agendamentos", String(total)],
          ["Concluídos", String(concluidos)],
          ["Aguardando confirmação", String(pendentes)],
          ["Taxa de conclusão", `${taxaConclusao}%`],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-ink-elev/60 p-5">
            <p className="font-body text-xs text-muted">{label}</p>
            <p className="mt-1 font-accent text-2xl text-bone">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-2xl border border-line bg-ink-elev/60 p-6">
        <p className="font-display text-lg font-semibold text-bone">
          Faturamento por barbeiro
        </p>
        <div className="mt-5 space-y-4">
          {porBarbeiro.length === 0 && (
            <p className="font-body text-sm text-bone-dim">
              Sem agendamentos concluídos ou confirmados ainda.
            </p>
          )}
          {porBarbeiro.map((b) => (
            <div key={b.nome}>
              <div className="flex items-center justify-between font-body text-sm">
                <span className="text-bone">{b.nome}</span>
                <span className="text-gold-bright">
                  R$ {b.total.toFixed(2).replace(".", ",")} · {b.qtd} atend.
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-bone/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-gold to-gold-bright"
                  style={{ width: `${(b.total / maiorFaturamento) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {cancelados > 0 && (
        <p className="mt-4 font-body text-xs text-muted">
          {cancelados} agendamento(s) cancelado(s) hoje, não incluído(s) no
          faturamento.
        </p>
      )}

      <div className="mt-10">
        <p className="font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">
          Relatório mensal de estoque
        </p>
        <h2 className="mt-1 font-display text-xl font-semibold capitalize text-bone">
          {MES_ATUAL}
        </h2>

        <div className="mt-4 grid gap-4 sm:grid-cols-4">
          {[
            ["Valor em estoque", `R$ ${valorEmEstoque.toFixed(2).replace(".", ",")}`],
            ["Unidades em estoque", String(unidadesEmEstoque)],
            ["Estoque baixo", String(estoqueBaixo)],
            ["Sem estoque", String(semEstoque)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-line bg-ink-elev/60 p-5">
              <p className="font-body text-xs text-muted">{label}</p>
              <p className="mt-1 font-accent text-2xl text-bone">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-line bg-ink-elev/60">
          {produtos.length === 0 ? (
            <p className="px-5 py-8 text-center font-body text-sm text-bone-dim">
              Nenhum produto cadastrado ainda.
            </p>
          ) : (
            // min-w garante que as 4 colunas não se espremam a ponto de
            // ficar ilegível no celular — nesse caso a tabela rola de lado.
            <table className="w-full min-w-[34rem] text-left">
              <thead>
                <tr className="border-b border-line font-body text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-medium">Produto</th>
                  <th className="px-5 py-3 font-medium">Categoria</th>
                  <th className="px-5 py-3 font-medium">Estoque</th>
                  <th className="px-5 py-3 font-medium">Valor em estoque</th>
                </tr>
              </thead>
              <tbody>
                {produtos.map((p) => (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-5 py-3 font-body text-sm text-bone">{p.nome}</td>
                    <td className="px-5 py-3 font-body text-sm text-bone-dim">{p.categoria}</td>
                    <td
                      className={`px-5 py-3 font-accent text-sm ${
                        p.estoque === 0
                          ? "text-off"
                          : p.estoque <= ESTOQUE_BAIXO
                            ? "text-warn"
                            : "text-bone"
                      }`}
                    >
                      {p.estoque}
                    </td>
                    <td className="px-5 py-3 font-accent text-sm text-gold-bright">
                      R$ {(p.preco * p.estoque).toFixed(2).replace(".", ",")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
