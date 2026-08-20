"use client";

import Link from "next/link";
import { use, useState } from "react";
import {
  criarAgendamento,
  getBarbeariaById,
  getBarbeiros,
  getHorariosOcupados,
  getProdutos,
  getServicos,
} from "@/lib/mock-db";
import {
  addDays,
  generateTimeSlots,
  toISODate,
  weekdayOf,
} from "@/lib/date";
import { formatPhone, isValidPhone } from "@/lib/format";
import { WEEKDAYS } from "@/lib/types";
import type {
  Barbearia,
  BarbeiroPerfil,
  Produto,
  Servico,
} from "@/lib/types";

const DIAS_VISIVEIS = 14;

export default function LojaPublicaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [loaded, setLoaded] = useState(false);
  const [barbearia, setBarbearia] = useState<Barbearia | undefined>(undefined);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [barbeiros, setBarbeiros] = useState<BarbeiroPerfil[]>([]);

  // fluxo de agendamento
  const [servico, setServico] = useState<Servico | null>(null);
  const [barbeiro, setBarbeiro] = useState<BarbeiroPerfil | null>(null);
  const [data, setData] = useState<string>("");
  const [hora, setHora] = useState<string>("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [confirmado, setConfirmado] = useState<{
    pago: boolean;
    hora: string;
    data: string;
  } | null>(null);

  if (!loaded && typeof window !== "undefined") {
    const b = getBarbeariaById(id);
    setBarbearia(b);
    if (b) {
      setServicos(getServicos(b.id).filter((s) => s.ativo));
      setProdutos(getProdutos(b.id).filter((p) => p.ativo));
      setBarbeiros(getBarbeiros(b.id).filter((x) => x.ativo));
    }
    setLoaded(true);
  }

  if (loaded && !barbearia) {
    return (
      <div className="grain grid-field relative flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="font-display text-3xl font-semibold text-bone">
          Barbearia não encontrada
        </h1>
        <Link
          href="/"
          className="mt-8 rounded-full border border-line-strong px-6 py-3 font-body text-sm font-semibold text-bone hover:border-gold-bright hover:text-gold-bright"
        >
          Voltar pra home
        </Link>
      </div>
    );
  }

  if (!barbearia) {
    return <div className="flex flex-1 bg-ink" />;
  }

  const isPro = barbearia.plano === "pro";
  const hoje = toISODate(new Date());

  // Próximos dias em que a barbearia abre
  const diasDisponiveis = Array.from({ length: DIAS_VISIVEIS }, (_, i) =>
    addDays(hoje, i),
  ).filter((d) => barbearia.diasFuncionamento.includes(weekdayOf(d)));

  const todosHorarios = generateTimeSlots(
    barbearia.horarioAbertura,
    barbearia.horarioFechamento,
  );
  const ocupados = barbeiro && data ? getHorariosOcupados(barbeiro.id, data) : [];
  const agoraHora = new Date().toTimeString().slice(0, 5);
  const horariosLivres = todosHorarios.filter(
    (h) => !ocupados.includes(h) && !(data === hoje && h <= agoraHora),
  );

  const categorias = Array.from(new Set(servicos.map((s) => s.categoria)));
  const categoriasProduto = Array.from(new Set(produtos.map((p) => p.categoria)));

  function agendar(formaPagamento: "online" | "local") {
    setErro(null);
    if (!servico || !barbeiro || !data || !hora) {
      setErro("Escolha o serviço, o barbeiro, o dia e o horário.");
      return;
    }
    if (nome.trim().length < 2) {
      setErro("Informe seu nome.");
      return;
    }
    if (!isValidPhone(telefone)) {
      setErro("Informe um telefone válido, com DDD.");
      return;
    }

    const result = criarAgendamento({
      barbeariaId: barbearia!.id,
      barbeiroId: barbeiro.id,
      clienteNome: nome.trim(),
      clienteTelefone: telefone,
      servicoNome: servico.nome,
      preco: servico.preco,
      data,
      hora,
      formaPagamento,
    });

    if (!result.ok) {
      setErro(result.error);
      setHora("");
      return;
    }

    setConfirmado({ pago: formaPagamento === "online", hora, data });
    setServico(null);
    setBarbeiro(null);
    setData("");
    setHora("");
    setNome("");
    setTelefone("");
  }

  const diaLabel = (d: string) =>
    WEEKDAYS.find((w) => w.id === weekdayOf(d))?.label ?? "";

  return (
    <div className="grain flex flex-1 flex-col bg-ink">
      {/* HERO */}
      <header className="grid-field relative overflow-hidden border-b border-line px-6 py-16 text-center">
        <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[40rem] -translate-x-1/2 rounded-full bg-gold/10 blur-[100px]" />
        <div className="relative mx-auto max-w-2xl">
          <p className="font-accent text-xs uppercase tracking-[0.25em] text-gold-bright">
            Barbearia
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-bone sm:text-5xl">
            {barbearia.nome}
          </h1>
          <p className="mt-4 font-body text-sm text-bone-dim">
            {barbearia.endereco}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 font-body text-xs text-muted">
            <span>
              {barbearia.diasFuncionamento
                .map((d) => WEEKDAYS.find((w) => w.id === d)?.label)
                .join(" · ")}
            </span>
            <span className="text-gold-bright">
              {barbearia.horarioAbertura} às {barbearia.horarioFechamento}
            </span>
            <span>{barbearia.telefone}</span>
          </div>
          <a
            href="#agendar"
            className="mt-8 inline-block rounded-full bg-gold-bright px-8 py-3.5 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.03]"
          >
            Agendar horário
          </a>
        </div>
      </header>

      {/* SERVIÇOS */}
      <section className="border-b border-line bg-[#0a1414] px-6 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-display text-2xl font-bold text-bone">Serviços</h2>
          <div className="mt-8 space-y-10">
            {categorias.map((cat) => (
              <div key={cat}>
                <p className="font-accent text-xs uppercase tracking-widest text-cyan-bright">
                  {cat}
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {servicos
                    .filter((s) => s.categoria === cat)
                    .map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-4 rounded-2xl border border-line bg-ink-elev/60 p-4"
                      >
                        {s.foto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={s.foto}
                            alt={s.nome}
                            className="h-14 w-14 shrink-0 rounded-xl object-cover"
                          />
                        ) : (
                          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/5 font-accent text-lg text-bone-dim">
                            {s.nome.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-body text-sm text-bone">
                            {s.nome}
                          </p>
                          <p className="font-body text-xs text-muted">
                            {s.duracaoMin} min
                          </p>
                        </div>
                        <span className="font-accent text-sm text-gold-bright">
                          R$ {s.preco.toFixed(2).replace(".", ",")}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EQUIPE */}
      {barbeiros.length > 0 && (
        <section className="border-b border-line bg-[#100c14] px-6 py-16">
          <div className="mx-auto max-w-4xl">
            <h2 className="font-display text-2xl font-bold text-bone">Equipe</h2>
            <div className="mt-8 flex flex-wrap gap-5">
              {barbeiros.map((b) => (
                <div key={b.id} className="w-32 text-center">
                  {b.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={b.foto}
                      alt={b.nome}
                      className="mx-auto h-20 w-20 rounded-full object-cover"
                    />
                  ) : (
                    <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-gold/30 bg-gold/10 font-accent text-xl text-gold-bright">
                      {b.nome.charAt(0)}
                    </span>
                  )}
                  <p className="mt-3 font-body text-sm text-bone">{b.nome}</p>
                  <p className="font-body text-[11px] text-muted">
                    {b.especialidade}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* PRODUTOS — só no Pro */}
      {isPro && produtos.length > 0 && (
        <section className="border-b border-line bg-[#150f08] px-6 py-16">
          <div className="mx-auto max-w-4xl">
            <h2 className="font-display text-2xl font-bold text-bone">
              Produtos à venda
            </h2>
            <p className="mt-1 font-body text-sm text-bone-dim">
              Retire na barbearia no dia do seu horário.
            </p>
            <div className="mt-8 space-y-10">
              {categoriasProduto.map((cat) => (
                <div key={cat}>
                  <p className="font-accent text-xs uppercase tracking-widest text-cyan-bright">
                    {cat}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {produtos
                      .filter((p) => p.categoria === cat)
                      .map((p) => (
                        <div
                          key={p.id}
                          className={`flex items-center gap-4 rounded-2xl border border-line bg-ink-elev/60 p-4 ${
                            p.estoque === 0 ? "opacity-50" : ""
                          }`}
                        >
                          {p.foto ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={p.foto}
                              alt={p.nome}
                              className="h-14 w-14 shrink-0 rounded-xl object-cover"
                            />
                          ) : (
                            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white/5 font-accent text-lg text-bone-dim">
                              {p.nome.charAt(0).toUpperCase()}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-body text-sm text-bone">
                              {p.nome}
                            </p>
                            <p className="font-body text-xs text-muted">
                              {p.estoque === 0
                                ? "Esgotado"
                                : p.estoque <= 5
                                  ? `Últimas ${p.estoque} unidades`
                                  : "Disponível"}
                            </p>
                          </div>
                          <span className="font-accent text-sm text-gold-bright">
                            R$ {p.preco.toFixed(2).replace(".", ",")}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* AGENDAR */}
      <section id="agendar" className="border-b border-line bg-[#0c0a06] px-6 py-16">
        <div className="mx-auto max-w-2xl">
          <h2 className="font-display text-2xl font-bold text-bone">
            Agendar horário
          </h2>

          {confirmado ? (
            <div className="mt-8 rounded-2xl border border-gold-bright/40 bg-gold-bright/5 p-8 text-center">
              <p className="font-display text-xl font-semibold text-bone">
                {confirmado.pago
                  ? "Agendamento confirmado!"
                  : "Agendamento enviado!"}
              </p>
              <p className="mx-auto mt-3 max-w-sm font-body text-sm text-bone-dim">
                {confirmado.pago
                  ? `Seu horário das ${confirmado.hora} está garantido. Te esperamos!`
                  : `A barbearia vai confirmar seu horário das ${confirmado.hora}. Você paga no balcão no dia.`}
              </p>
              <button
                onClick={() => setConfirmado(null)}
                className="mt-6 rounded-full border border-line-strong px-6 py-2.5 font-body text-sm text-bone-dim hover:border-gold-bright/40 hover:text-gold-bright"
              >
                Fazer outro agendamento
              </button>
            </div>
          ) : (
            <div className="mt-8 space-y-8">
              {/* 1. serviço */}
              <div>
                <p className="font-accent text-xs uppercase tracking-widest text-muted">
                  1 · Escolha o serviço
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {servicos.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setServico(s)}
                      className={`rounded-xl border px-4 py-2.5 text-left font-body text-sm transition-colors ${
                        servico?.id === s.id
                          ? "border-gold-bright bg-gold-bright/10 text-gold-bright"
                          : "border-line text-bone-dim hover:border-line-strong"
                      }`}
                    >
                      {s.nome}
                      <span className="ml-2 font-accent text-xs">
                        R$ {s.preco.toFixed(2).replace(".", ",")}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. barbeiro */}
              {servico && (
                <div>
                  <p className="font-accent text-xs uppercase tracking-widest text-muted">
                    2 · Com quem?
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {barbeiros.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => {
                          setBarbeiro(b);
                          setHora("");
                        }}
                        className={`rounded-xl border px-4 py-2.5 font-body text-sm transition-colors ${
                          barbeiro?.id === b.id
                            ? "border-gold-bright bg-gold-bright/10 text-gold-bright"
                            : "border-line text-bone-dim hover:border-line-strong"
                        }`}
                      >
                        {b.nome}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. dia */}
              {barbeiro && (
                <div>
                  <p className="font-accent text-xs uppercase tracking-widest text-muted">
                    3 · Qual dia?
                  </p>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                    {diasDisponiveis.map((d) => (
                      <button
                        key={d}
                        onClick={() => {
                          setData(d);
                          setHora("");
                        }}
                        className={`shrink-0 rounded-xl border px-4 py-2.5 text-center transition-colors ${
                          data === d
                            ? "border-gold-bright bg-gold-bright/10 text-gold-bright"
                            : "border-line text-bone-dim hover:border-line-strong"
                        }`}
                      >
                        <span className="block font-body text-[10px] uppercase">
                          {diaLabel(d)}
                        </span>
                        <span className="block font-accent text-sm">
                          {d.slice(8, 10)}/{d.slice(5, 7)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. hora */}
              {data && (
                <div>
                  <p className="font-accent text-xs uppercase tracking-widest text-muted">
                    4 · Que horas?
                  </p>
                  {horariosLivres.length === 0 ? (
                    <p className="mt-3 rounded-xl border border-dashed border-line-strong px-4 py-6 text-center font-body text-sm text-bone-dim">
                      Nenhum horário livre nesse dia. Escolha outro.
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {horariosLivres.map((h) => (
                        <button
                          key={h}
                          onClick={() => setHora(h)}
                          className={`rounded-lg border px-3.5 py-2 font-accent text-sm transition-colors ${
                            hora === h
                              ? "border-gold-bright bg-gold-bright/10 text-gold-bright"
                              : "border-line text-bone-dim hover:border-line-strong"
                          }`}
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 5. dados + pagamento */}
              {hora && (
                <div>
                  <p className="font-accent text-xs uppercase tracking-widest text-muted">
                    5 · Seus dados
                  </p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block font-body text-xs text-muted">
                        Nome
                      </span>
                      <input
                        value={nome}
                        onChange={(e) => setNome(e.target.value)}
                        placeholder="Seu nome"
                        className="w-full rounded-xl border border-line-strong bg-white/[0.03] px-4 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block font-body text-xs text-muted">
                        Telefone
                      </span>
                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={15}
                        value={telefone}
                        onChange={(e) => setTelefone(formatPhone(e.target.value))}
                        placeholder="(11) 99999-9999"
                        className="w-full rounded-xl border border-line-strong bg-white/[0.03] px-4 py-2.5 font-body text-sm text-bone outline-none focus:border-gold-bright"
                      />
                    </label>
                  </div>

                  <div className="mt-5 rounded-xl border border-line bg-ink-elev/60 p-4">
                    <div className="flex items-center justify-between font-body text-sm">
                      <span className="text-bone-dim">
                        {servico?.nome} · {barbeiro?.nome}
                      </span>
                      <span className="font-accent text-gold-bright">
                        R$ {servico?.preco.toFixed(2).replace(".", ",")}
                      </span>
                    </div>
                    <p className="mt-1 font-body text-xs text-muted">
                      {data.slice(8, 10)}/{data.slice(5, 7)} às {hora}
                    </p>
                  </div>

                  {erro && (
                    <p className="mt-4 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 font-body text-xs text-rose-300">
                      {erro}
                    </p>
                  )}

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button
                      onClick={() => agendar("online")}
                      className="rounded-xl bg-gold-bright px-5 py-3.5 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.02]"
                    >
                      Pagar agora e confirmar
                    </button>
                    <button
                      onClick={() => agendar("local")}
                      className="rounded-xl border border-line-strong px-5 py-3.5 font-body text-sm font-semibold text-bone-dim transition-colors hover:border-gold-bright/40 hover:text-gold-bright"
                    >
                      Pagar no local
                    </button>
                  </div>
                  <p className="mt-3 text-center font-body text-[11px] text-muted">
                    Pagando agora, seu horário fica garantido na hora. Pagando
                    no local, a barbearia precisa confirmar.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* LOCALIZAÇÃO */}
      <section className="bg-[#0a0a0c] px-6 py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-2xl font-bold text-bone">
            Como chegar
          </h2>
          <p className="mt-3 font-body text-sm text-bone-dim">
            {barbearia.endereco}
          </p>
          {barbearia.linkMaps && (
            <a
              href={barbearia.linkMaps}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-block rounded-full border border-line-strong px-6 py-3 font-body text-sm font-semibold text-bone hover:border-gold-bright hover:text-gold-bright"
            >
              Abrir no Google Maps ↗
            </a>
          )}
          <p className="mt-10 font-body text-[11px] text-muted">
            Página feita com{" "}
            <Link href="/" className="text-gold-bright hover:underline">
              Navalha
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
}
