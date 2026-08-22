"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLoja } from "@/lib/loja-context";
import { caminhoLoja } from "@/lib/slug";
import { getClienteLogado } from "@/lib/cliente-db";
import {
  cartTotal,
  removeProdutoFromCart,
  removeServicoFromCart,
  setCartAgendamento,
  setCartCliente,
  setProdutoQtd,
  useCart,
} from "@/lib/cart";
import { buscarClientePorTelefone, getHorariosOcupados } from "@/lib/db";
import { useAsync } from "@/lib/use-async";
import { addDays, addMinutes, generateTimeSlots, toISODate, weekdayOf } from "@/lib/date";
import { formatPhone, isValidEmail, isValidPhone } from "@/lib/format";
import { SLOT_MIN, WEEKDAYS, slotsDe } from "@/lib/types";
import type { BarbeiroPerfil } from "@/lib/types";
import { ETAPAS, LojaStepHeader, type EtapaIndex } from "@/components/LojaStepHeader";

const DIAS_VISIVEIS = 14;
const SEM_PREFERENCIA = "qualquer";

function preco(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { barbearia, barbeiros } = useLoja();
  const cart = useCart(barbearia?.id ?? "");

  const [etapa, setEtapa] = useState<EtapaIndex>(0);
  const [selecaoBarbeiro, setSelecaoBarbeiro] = useState<string>(
    () =>
      (cart.agendamento?.semPreferencia ? SEM_PREFERENCIA : cart.agendamento?.barbeiroId) ??
      cart.barbeiroPreferidoId ??
      SEM_PREFERENCIA,
  );
  const [dia, setDia] = useState(cart.agendamento?.data ?? "");
  const [horaInicio, setHoraInicio] = useState(cart.agendamento?.horaInicio ?? "");
  const [barbeiroResolvido, setBarbeiroResolvido] = useState<BarbeiroPerfil | null>(
    () => barbeiros.find((b) => b.id === cart.agendamento?.barbeiroId) ?? null,
  );
  const [nome, setNome] = useState(cart.cliente?.nome ?? "");
  const [telefone, setTelefone] = useState(cart.cliente?.telefone ?? "");
  const [email, setEmail] = useState(cart.cliente?.email ?? "");
  const [clienteReconhecido, setClienteReconhecido] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Quem está logado não devia digitar de novo o que já cadastrou. Só
  // preenche o que está vazio: se a pessoa começou a escrever outro nome
  // (marcando pro filho, por exemplo), o que ela digitou manda.
  const { dados: clienteLogado } = useAsync(() => getClienteLogado(), []);
  const [preencheu, setPreencheu] = useState(false);
  if (clienteLogado && !preencheu) {
    setNome((atual) => atual || clienteLogado.nome);
    setTelefone((atual) => atual || clienteLogado.telefone);
    setEmail((atual) => atual || clienteLogado.email);
    setPreencheu(true);
  }

  // Os horários ocupados vêm do banco, então mudam quando outra pessoa
  // marca — recarrega sempre que o dia escolhido muda. Precisa ficar antes
  // de qualquer return: hooks não podem ser chamados condicionalmente.
  const { dados: ocupadosPorBarbeiro } = useAsync(
    () => getHorariosOcupados(barbearia!.id, dia),
    [barbearia?.id, dia],
    { pular: !dia || !barbearia },
  );

  if (!barbearia) return null;

  const nServicos = cart.servicos.length;
  const carrinhoVazio = nServicos === 0 && cart.produtos.length === 0;
  const barbeiroEspecifico =
    selecaoBarbeiro === SEM_PREFERENCIA
      ? null
      : (barbeiros.find((b) => b.id === selecaoBarbeiro) ?? null);

  const hoje = toISODate(new Date());
  const agoraHora = new Date().toTimeString().slice(0, 5);
  const diasDisponiveis = Array.from({ length: DIAS_VISIVEIS }, (_, i) => addDays(hoje, i)).filter(
    (d) => barbearia.diasFuncionamento.includes(weekdayOf(d)),
  );
  const todosHorarios = generateTimeSlots(barbearia.horarioAbertura, barbearia.horarioFechamento);
  const candidatos = barbeiroEspecifico ? [barbeiroEspecifico] : barbeiros;

  // Quantos blocos de 30 min a visita inteira ocupa (soma das durações).
  const blocosNecessarios = cart.servicos.reduce((sum, s) => sum + slotsDe(s.duracaoMin), 0);
  const duracaoTotal = cart.servicos.reduce((sum, s) => sum + s.duracaoMin, 0);

  function janelaLivre(barbeiroId: string, idx: number): boolean {
    if (idx + blocosNecessarios > todosHorarios.length) return false;
    const janela = todosHorarios.slice(idx, idx + blocosNecessarios);
    const ocupados = ocupadosPorBarbeiro?.[barbeiroId] ?? [];
    return janela.every((slot) => !ocupados.includes(slot));
  }

  // Todos os horários do dia com o estado de cada um: livre (verde) ou não
  // (vermelho). Mostrar os ocupados também deixa claro que o dia tem
  // movimento, em vez de simplesmente sumir com eles.
  type Slot = {
    hora: string;
    livre: boolean;
    passou: boolean;
    barbeiro: BarbeiroPerfil | null;
  };

  const slots: Slot[] = dia
    ? todosHorarios.map((h, idx) => {
        const passou = dia === hoje && h <= agoraHora;
        const disponivel = passou ? undefined : candidatos.find((b) => janelaLivre(b.id, idx));
        return {
          hora: h,
          livre: Boolean(disponivel),
          passou,
          barbeiro: disponivel ?? null,
        };
      })
    : [];

  const livres = slots.filter((s) => s.livre);

  const idxSelecionado = todosHorarios.indexOf(horaInicio);
  const horaFim =
    idxSelecionado >= 0 ? addMinutes(horaInicio, blocosNecessarios * SLOT_MIN) : "";

  const diaLabel = (d: string) => WEEKDAYS.find((w) => w.id === weekdayOf(d))?.label ?? "";
  const dataLonga = (d: string) => `${diaLabel(d)}, ${d.slice(8, 10)}/${d.slice(5, 7)}`;

  async function handleTelefoneChange(v: string) {
    const formatted = formatPhone(v);
    setTelefone(formatted);
    if (isValidPhone(formatted) && barbearia) {
      const encontrado = await buscarClientePorTelefone(barbearia.id, formatted);
      if (encontrado) {
        setNome((atual) => atual || encontrado.nome);
        setEmail((atual) => atual || encontrado.email || "");
        setClienteReconhecido(true);
        return;
      }
    }
    setClienteReconhecido(false);
  }

  /** Valida a etapa atual; devolve a mensagem de erro ou null se pode seguir. */
  function validar(e: EtapaIndex): string | null {
    if (e === 0 && nServicos === 0) {
      return "Adicione ao menos um serviço para agendar sua visita.";
    }
    if (e === 2 && (!dia || !horaInicio || !barbeiroResolvido)) {
      return "Escolha o dia e o horário.";
    }
    if (e === 3) {
      if (nome.trim().length < 2) return "Informe seu nome.";
      if (!isValidPhone(telefone)) return "Informe um telefone válido, com DDD.";
      if (!isValidEmail(email)) return "Informe um e-mail válido.";
    }
    return null;
  }

  function avancar() {
    if (!barbearia) return;
    const problema = validar(etapa);
    if (problema) {
      setErro(problema);
      return;
    }
    setErro(null);

    // Salva o que a etapa coletou antes de seguir, pra sobreviver a um refresh.
    if (etapa === 2 && barbeiroResolvido) {
      setCartAgendamento(barbearia.id, {
        barbeiroId: barbeiroResolvido.id,
        barbeiroNome: barbeiroResolvido.nome,
        data: dia,
        horaInicio,
        semPreferencia: selecaoBarbeiro === SEM_PREFERENCIA,
      });
    }
    if (etapa === 3) {
      setCartCliente(barbearia.id, { nome: nome.trim(), telefone, email: email.trim() });
    }

    if (etapa === 4) {
      router.push(`${caminhoLoja(barbearia)}/pagamento`);
      return;
    }
    setEtapa((e) => (e + 1) as EtapaIndex);
    window.scrollTo({ top: 0 });
  }

  function voltar() {
    if (!barbearia) return;
    setErro(null);
    if (etapa === 0) {
      router.push(`${caminhoLoja(barbearia)}`);
      return;
    }
    setEtapa((e) => (e - 1) as EtapaIndex);
    window.scrollTo({ top: 0 });
  }

  if (carrinhoVazio) {
    return (
      <>
        <LojaStepHeader
          barbeariaNome={barbearia.nome}
          etapa={0}
          onVoltar={() => router.push(`${caminhoLoja(barbearia)}`)}
        />
        <div className="mx-auto max-w-md px-6 py-24 text-center">
          <p className="font-display text-xl font-semibold text-bone">Seu carrinho está vazio</p>
          <p className="mt-2 font-body text-sm text-bone-dim">
            Volte pro catálogo e escolha os serviços da sua visita.
          </p>
          <Link
            href={`${caminhoLoja(barbearia)}`}
            className="mt-8 inline-block rounded-full bg-bone px-7 py-3.5 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
          >
            Ver serviços
          </Link>
        </div>
      </>
    );
  }

  const podeAvancar = validar(etapa) === null;

  return (
    <>
      <LojaStepHeader barbeariaNome={barbearia.nome} etapa={etapa} onVoltar={voltar} />

      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-10 pb-32">
        {/* ── 0 · ITENS ───────────────────────────────── */}
        {etapa === 0 && (
          <section>
            <h1 className="font-display text-2xl font-bold text-bone">Seus itens</h1>
            <p className="mt-1.5 font-body text-sm text-bone-dim">
              Confira o que você escolheu antes de seguir.
            </p>

            {nServicos > 0 && (
              <div className="mt-7">
                <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-muted">
                  Serviços
                </p>
                <div className="mt-3 space-y-2.5">
                  {cart.servicos.map((s) => (
                    <div
                      key={s.servicoId}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-ink-elev px-4 py-3.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-body text-sm font-medium text-bone">{s.nome}</p>
                        <p className="font-body text-xs text-muted">{s.duracaoMin} min</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="font-accent text-sm text-gold-bright">{preco(s.preco)}</span>
                        <button
                          onClick={() => removeServicoFromCart(barbearia.id, s.servicoId)}
                          aria-label={`Remover ${s.nome}`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-ink-elev-2 hover:text-bone"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cart.produtos.length > 0 && (
              <div className="mt-7">
                <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-muted">
                  Produtos
                </p>
                <div className="mt-3 space-y-2.5">
                  {cart.produtos.map((p) => (
                    <div
                      key={p.produtoId}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-ink-elev px-4 py-3.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-body text-sm font-medium text-bone">{p.nome}</p>
                        <p className="font-body text-xs text-muted">{preco(p.preco)} cada</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <div className="flex items-center gap-1 rounded-lg border border-line-strong px-1 py-0.5">
                          <button
                            onClick={() => setProdutoQtd(barbearia.id, p.produtoId, p.quantidade - 1)}
                            aria-label={`Menos ${p.nome}`}
                            className="flex h-6 w-6 items-center justify-center rounded text-bone-dim hover:bg-ink-elev-2"
                          >
                            −
                          </button>
                          <span className="min-w-5 text-center font-accent text-sm text-bone">
                            {p.quantidade}
                          </span>
                          <button
                            onClick={() => setProdutoQtd(barbearia.id, p.produtoId, p.quantidade + 1)}
                            disabled={p.quantidade >= p.estoque}
                            aria-label={`Mais ${p.nome}`}
                            className="flex h-6 w-6 items-center justify-center rounded text-bone-dim hover:bg-ink-elev-2 disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => removeProdutoFromCart(barbearia.id, p.produtoId)}
                          aria-label={`Remover ${p.nome}`}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted transition-colors hover:bg-ink-elev-2 hover:text-bone"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {nServicos === 0 && (
              <p className="mt-6 rounded-xl border border-gold-bright/40 bg-gold-bright/10 px-4 py-3 font-body text-xs text-gold-bright">
                Você só tem produtos no carrinho. Adicione ao menos um serviço pra marcar o
                horário da retirada.
              </p>
            )}

            <Link
              href={`${caminhoLoja(barbearia)}`}
              className="mt-6 inline-block font-body text-sm text-bone-dim underline underline-offset-4 hover:text-bone"
            >
              Adicionar mais itens
            </Link>
          </section>
        )}

        {/* ── 1 · PROFISSIONAL ────────────────────────── */}
        {etapa === 1 && (
          <section>
            <h1 className="font-display text-2xl font-bold text-bone">Com quem você quer cortar?</h1>
            <p className="mt-1.5 font-body text-sm text-bone-dim">
              Escolha um profissional ou deixe que a gente encaixa no primeiro horário livre.
            </p>

            <div className="mt-7 space-y-2.5">
              <button
                onClick={() => {
                  setSelecaoBarbeiro(SEM_PREFERENCIA);
                  setHoraInicio("");
                  setBarbeiroResolvido(null);
                }}
                className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${
                  selecaoBarbeiro === SEM_PREFERENCIA
                    ? "border-bone bg-ink-elev"
                    : "border-line bg-ink-elev hover:border-line-strong"
                }`}
              >
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink-elev-2 font-display text-lg text-bone-dim">
                  ★
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-body text-sm font-semibold text-bone">
                    Sem preferência
                  </span>
                  <span className="block font-body text-xs text-muted">
                    Mais opções de horário — encaixamos com quem estiver livre
                  </span>
                </span>
                {selecaoBarbeiro === SEM_PREFERENCIA && (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bone font-body text-xs text-ink">
                    ✓
                  </span>
                )}
              </button>

              {barbeiros.map((b) => {
                const ativo = selecaoBarbeiro === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => {
                      setSelecaoBarbeiro(b.id);
                      setHoraInicio("");
                      setBarbeiroResolvido(null);
                    }}
                    className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-colors ${
                      ativo ? "border-bone bg-ink-elev" : "border-line bg-ink-elev hover:border-line-strong"
                    }`}
                  >
                    {b.foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.foto}
                        alt={b.nome}
                        className="h-14 w-14 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink-elev-2 font-display text-lg text-bone-dim">
                        {b.nome.charAt(0)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block font-body text-sm font-semibold text-bone">
                        {b.nome}
                      </span>
                      <span className="block font-body text-xs text-muted">{b.especialidade}</span>
                    </span>
                    {ativo && (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-bone font-body text-xs text-ink">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ── 2 · HORÁRIO ─────────────────────────────── */}
        {etapa === 2 && (
          <section>
            <h1 className="font-display text-2xl font-bold text-bone">Quando fica bom?</h1>
            <p className="mt-1.5 font-body text-sm text-bone-dim">
              {barbeiroEspecifico
                ? `Agenda de ${barbeiroEspecifico.nome}`
                : "Horários de toda a equipe"}{" "}
              — sua visita leva cerca de {duracaoTotal} min.
            </p>

            <div className="mt-7">
              <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-muted">Dia</p>
              <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
                {diasDisponiveis.map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setDia(d);
                      setHoraInicio("");
                      setBarbeiroResolvido(null);
                    }}
                    className={`shrink-0 rounded-xl border px-4 py-3 text-center transition-colors ${
                      dia === d
                        ? "border-bone bg-bone text-ink"
                        : "border-line bg-ink-elev text-bone-dim hover:border-line-strong"
                    }`}
                  >
                    <span className="block font-body text-[10px] uppercase tracking-wide">
                      {diaLabel(d)}
                    </span>
                    <span className="mt-0.5 block font-accent text-sm">
                      {d.slice(8, 10)}/{d.slice(5, 7)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {dia && (
              <div className="mt-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="font-accent text-[11px] uppercase tracking-[0.18em] text-muted">
                    Horário
                  </p>
                  <div className="flex items-center gap-4 font-body text-[11px]">
                    <span className="flex items-center gap-1.5 text-ok">
                      <span className="h-2.5 w-2.5 rounded-full border border-ok-line bg-ok-soft" />
                      Livre
                    </span>
                    <span className="flex items-center gap-1.5 text-off">
                      <span className="h-2.5 w-2.5 rounded-full border border-off-line bg-off-soft" />
                      Ocupado
                    </span>
                  </div>
                </div>

                {livres.length === 0 ? (
                  <p className="mt-3 rounded-2xl border border-dashed border-line-strong px-4 py-8 text-center font-body text-sm text-bone-dim">
                    Nenhum horário livre com espaço pros {duracaoTotal} min da sua visita nesse
                    dia. Tente outro dia
                    {barbeiroEspecifico ? " ou deixe sem preferência de profissional." : "."}
                  </p>
                ) : (
                  <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {slots.map((slot) => {
                      const escolhido = horaInicio === slot.hora;
                      return (
                        <button
                          key={slot.hora}
                          onClick={() => {
                            setHoraInicio(slot.hora);
                            setBarbeiroResolvido(slot.barbeiro);
                          }}
                          disabled={!slot.livre}
                          title={
                            slot.livre
                              ? `Livre — ${slot.barbeiro?.nome}`
                              : slot.passou
                                ? "Horário já passou"
                                : "Ocupado"
                          }
                          className={`rounded-xl border py-2.5 font-accent text-sm transition-colors ${
                            escolhido
                              ? "border-bone bg-bone text-ink"
                              : slot.livre
                                ? "border-ok-line bg-ok-soft text-ok hover:bg-ok/15"
                                : "cursor-not-allowed border-off-line bg-off-soft text-off/70 line-through"
                          }`}
                        >
                          {slot.hora}
                        </button>
                      );
                    })}
                  </div>
                )}

                {horaInicio && barbeiroResolvido && (
                  <p className="mt-4 rounded-xl border border-line bg-ink-elev px-4 py-3 font-body text-sm text-bone-dim">
                    <span className="text-bone">{dataLonga(dia)}</span>, das{" "}
                    <span className="font-accent text-gold-bright">{horaInicio}</span> às{" "}
                    <span className="font-accent text-gold-bright">{horaFim}</span>, com{" "}
                    <span className="text-bone">{barbeiroResolvido.nome}</span>.
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── 3 · DADOS ───────────────────────────────── */}
        {etapa === 3 && (
          <section>
            <h1 className="font-display text-2xl font-bold text-bone">Seus dados</h1>
            <p className="mt-1.5 font-body text-sm text-bone-dim">
              Comece pelo telefone — se você já veio aqui, o resto se preenche sozinho.
            </p>

            <div className="mt-7 space-y-4">
              <label className="block">
                <span className="mb-1.5 block font-body text-xs font-medium text-bone-dim">
                  Telefone
                </span>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={15}
                  value={telefone}
                  onChange={(e) => handleTelefoneChange(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full rounded-xl border border-line-strong bg-ink-elev px-4 py-3 font-body text-sm text-bone outline-none transition-colors focus:border-bone"
                />
                {clienteReconhecido && (
                  <span className="mt-2 flex items-center gap-1.5 font-body text-xs text-cyan-bright">
                    <span aria-hidden>✓</span> Que bom te ver de novo! Confira seus dados abaixo.
                  </span>
                )}
              </label>

              <label className="block">
                <span className="mb-1.5 block font-body text-xs font-medium text-bone-dim">
                  Nome
                </span>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full rounded-xl border border-line-strong bg-ink-elev px-4 py-3 font-body text-sm text-bone outline-none transition-colors focus:border-bone"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block font-body text-xs font-medium text-bone-dim">
                  E-mail
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                  className="w-full rounded-xl border border-line-strong bg-ink-elev px-4 py-3 font-body text-sm text-bone outline-none transition-colors focus:border-bone"
                />
                <span className="mt-1.5 block font-body text-[11px] text-muted">
                  Usamos só pra mandar a confirmação do agendamento.
                </span>
              </label>
            </div>
          </section>
        )}

        {/* ── 4 · RESUMO ──────────────────────────────── */}
        {etapa === 4 && (
          <section>
            <h1 className="font-display text-2xl font-bold text-bone">Confira tudo</h1>
            <p className="mt-1.5 font-body text-sm text-bone-dim">
              Se estiver certo, é só seguir pro pagamento.
            </p>

            <div className="mt-7 overflow-hidden rounded-2xl border border-line bg-ink-elev">
              {[
                {
                  titulo: "Quando",
                  etapaAlvo: 2 as EtapaIndex,
                  conteudo: (
                    <>
                      <p className="font-body text-sm text-bone">{dataLonga(dia)}</p>
                      <p className="font-accent text-sm text-gold-bright">
                        {horaInicio} às {horaFim}
                      </p>
                    </>
                  ),
                },
                {
                  titulo: "Com quem",
                  etapaAlvo: 1 as EtapaIndex,
                  conteudo: (
                    <>
                      <p className="font-body text-sm text-bone">{barbeiroResolvido?.nome}</p>
                      {selecaoBarbeiro === SEM_PREFERENCIA && (
                        <p className="font-body text-xs text-muted">
                          Você não teve preferência — encaixamos com quem estava livre
                        </p>
                      )}
                    </>
                  ),
                },
                {
                  titulo: "Seus dados",
                  etapaAlvo: 3 as EtapaIndex,
                  conteudo: (
                    <>
                      <p className="font-body text-sm text-bone">{nome}</p>
                      <p className="font-body text-xs text-muted">
                        {telefone} · {email}
                      </p>
                    </>
                  ),
                },
              ].map((bloco) => (
                <div
                  key={bloco.titulo}
                  className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="font-accent text-[10px] uppercase tracking-[0.18em] text-muted">
                      {bloco.titulo}
                    </p>
                    <div className="mt-1.5">{bloco.conteudo}</div>
                  </div>
                  <button
                    onClick={() => setEtapa(bloco.etapaAlvo)}
                    className="shrink-0 font-body text-xs text-bone-dim underline underline-offset-4 hover:text-bone"
                  >
                    alterar
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-ink-elev">
              <div className="flex items-center justify-between border-b border-line px-5 py-3">
                <p className="font-accent text-[10px] uppercase tracking-[0.18em] text-muted">
                  Itens
                </p>
                <button
                  onClick={() => setEtapa(0)}
                  className="font-body text-xs text-bone-dim underline underline-offset-4 hover:text-bone"
                >
                  alterar
                </button>
              </div>
              <div className="space-y-2 px-5 py-4">
                {cart.servicos.map((s) => (
                  <div key={s.servicoId} className="flex justify-between font-body text-sm">
                    <span className="text-bone-dim">{s.nome}</span>
                    <span className="text-bone">{preco(s.preco)}</span>
                  </div>
                ))}
                {cart.produtos.map((p) => (
                  <div key={p.produtoId} className="flex justify-between font-body text-sm">
                    <span className="text-bone-dim">
                      {p.nome} × {p.quantidade}
                    </span>
                    <span className="text-bone">{preco(p.preco * p.quantidade)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-line px-5 py-4">
                <span className="font-body text-sm font-semibold text-bone">Total</span>
                <span className="font-accent text-xl text-gold-bright">
                  {preco(cartTotal(cart))}
                </span>
              </div>
            </div>

            {cart.produtos.length > 0 && (
              <p className="mt-4 font-body text-xs text-muted">
                Os produtos ficam separados e você retira no balcão no dia da visita.
              </p>
            )}
          </section>
        )}

        {erro && (
          <p className="mt-6 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 font-body text-xs text-rose-700">
            {erro}
          </p>
        )}
      </div>

      {/* AÇÃO FIXA */}
      <div className="sticky bottom-0 z-30 border-t border-line bg-ink/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <p className="font-accent text-[10px] uppercase tracking-[0.18em] text-muted">Total</p>
            <p className="font-accent text-lg text-bone">{preco(cartTotal(cart))}</p>
          </div>
          <button
            onClick={avancar}
            disabled={!podeAvancar}
            className="shrink-0 rounded-full bg-bone px-8 py-3.5 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-35"
          >
            {etapa === 4 ? "Ir para pagamento" : `Continuar · ${ETAPAS[etapa + 1]}`}
          </button>
        </div>
      </div>
    </>
  );
}
