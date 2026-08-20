"use client";

import Link from "next/link";
import { useState } from "react";
import { useLoja } from "@/lib/loja-context";
import {
  addProdutoToCart,
  addServicoToCart,
  removeServicoFromCart,
  setBarbeiroPreferido,
  setProdutoQtd,
  useCart,
} from "@/lib/cart";
import { WEEKDAYS } from "@/lib/types";
import { LojaTopBar } from "@/components/LojaTopBar";
import { ScrollRail } from "@/components/ScrollRail";

const TODOS = "Todos";

function preco(v: number) {
  return `R$ ${v.toFixed(2).replace(".", ",")}`;
}

/** Rótulo pequeno, em caixa alta e espaçado — usado pra ancorar cada bloco. */
function SectionLabel({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 font-accent text-[11px] uppercase tracking-[0.22em] text-cyan-bright">
      <span className="text-muted">{n}</span>
      <span className="h-px w-6 bg-line-strong" />
      {children}
    </p>
  );
}

export default function LojaPublicaPage() {
  const { barbearia, servicos, produtos, barbeiros, isPro } = useLoja();
  const cart = useCart(barbearia?.id ?? "");
  const [filtro, setFiltro] = useState<string>(TODOS);

  if (!barbearia) return null;

  // Combos ganham seção própria — ficam fora da lista de serviços avulsos
  // pra não aparecerem duas vezes.
  const combos = servicos.filter((s) => s.servicosIncluidos && s.servicosIncluidos.length > 1);
  const avulsos = servicos.filter((s) => !combos.includes(s));

  const categoriasServico = [TODOS, ...Array.from(new Set(avulsos.map((s) => s.categoria)))];
  const servicosVisiveis =
    filtro === TODOS ? avulsos : avulsos.filter((s) => s.categoria === filtro);
  const categoriasProduto = Array.from(new Set(produtos.map((p) => p.categoria)));
  const galeria = barbearia.galeria ?? [];

  const nomeServico = (id: string) => servicos.find((s) => s.id === id)?.nome ?? "";
  const precoServico = (id: string) => servicos.find((s) => s.id === id)?.preco ?? 0;
  /** Quanto o combo economiza em relação a comprar os serviços separados. */
  const economiaDoCombo = (s: (typeof servicos)[number]) =>
    (s.servicosIncluidos ?? []).reduce((sum, id) => sum + precoServico(id), 0) - s.preco;
  const noCarrinho = (id: string) => cart.servicos.some((s) => s.servicoId === id);
  const qtdNoCarrinho = (id: string) =>
    cart.produtos.find((p) => p.produtoId === id)?.quantidade ?? 0;

  const diasLabel = barbearia.diasFuncionamento
    .map((d) => WEEKDAYS.find((w) => w.id === d)?.label)
    .join(" · ");

  // Numeração das seções calculada a partir das que realmente aparecem,
  // pra não ficar "01, 03" quando a barbearia não tem combos ou produtos.
  const secoesVisiveis = [
    "servicos",
    combos.length > 0 && "combos",
    isPro && produtos.length > 0 && "produtos",
    barbeiros.length > 0 && "equipe",
    galeria.length > 0 && "galeria",
    "local",
  ].filter((x): x is string => Boolean(x));
  const numSecao = (id: string) => String(secoesVisiveis.indexOf(id) + 1).padStart(2, "0");

  return (
    <>
      <LojaTopBar barbeariaId={barbearia.id} barbeariaNome={barbearia.nome} />

      {/* ── HERO ─────────────────────────────────────────── */}
      <header className="relative">
        <div className="relative h-[64vh] min-h-[26rem] w-full overflow-hidden">
          {barbearia.foto ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={barbearia.foto}
                alt={barbearia.nome}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/25" />
            </>
          ) : (
            <div className="absolute inset-0 bg-bone" />
          )}

          <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
            <p className="animate-rise font-accent text-[11px] uppercase tracking-[0.3em] text-white/70">
              {barbearia.endereco.split("—").pop()?.trim() || "Barbearia"}
            </p>
            <h1
              className="animate-rise mt-4 max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl"
              style={{ animationDelay: "80ms" }}
            >
              {barbearia.nome}
            </h1>
            {barbearia.sobre && (
              <p
                className="animate-rise mt-5 max-w-lg font-body text-sm leading-relaxed text-white/80"
                style={{ animationDelay: "160ms" }}
              >
                {barbearia.sobre}
              </p>
            )}
            <a
              href="#servicos"
              className="animate-rise mt-9 rounded-full bg-white px-8 py-4 font-body text-sm font-semibold text-[#111214] transition-transform hover:scale-[1.03]"
              style={{ animationDelay: "240ms" }}
            >
              Montar meu horário
            </a>
          </div>
        </div>

        {/* barra de informações que invade a foto */}
        <div className="relative z-10 mx-auto -mt-12 max-w-4xl px-6">
          <div className="grid divide-y divide-line rounded-2xl border border-line bg-ink-elev shadow-[0_18px_50px_-24px_rgba(17,18,20,0.4)] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {[
              ["Funcionamento", diasLabel],
              ["Horário", `${barbearia.horarioAbertura} — ${barbearia.horarioFechamento}`],
              ["Contato", barbearia.telefone],
            ].map(([label, value]) => (
              <div key={label} className="px-5 py-4 text-center">
                <p className="font-accent text-[10px] uppercase tracking-[0.2em] text-muted">
                  {label}
                </p>
                <p className="mt-1.5 font-body text-sm font-medium text-bone">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ── SERVIÇOS ─────────────────────────────────────── */}
      <section id="servicos" className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <SectionLabel n={numSecao("servicos")}>Serviços</SectionLabel>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-bone">
            O que você vai fazer hoje?
          </h2>
          <p className="mt-2 font-body text-sm text-bone-dim">
            Toque para adicionar. Dá pra juntar mais de um na mesma visita.
          </p>

          {categoriasServico.length > 2 && (
            <div className="mt-7 flex flex-wrap gap-2">
              {categoriasServico.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFiltro(cat)}
                  className={`rounded-full border px-4 py-2 font-body text-xs font-medium transition-colors ${
                    filtro === cat
                      ? "border-bone bg-bone text-ink"
                      : "border-line-strong text-bone-dim hover:border-bone/40 hover:text-bone"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <div className="mt-7">
            <ScrollRail ariaLabel="Serviços">
              {servicosVisiveis.map((s) => {
                const dentro = noCarrinho(s.id);
                return (
                  <article
                    key={s.id}
                    className={`w-56 shrink-0 snap-start overflow-hidden rounded-2xl border bg-ink-elev transition-[transform,box-shadow] hover:-translate-y-1 hover:shadow-[0_16px_40px_-20px_rgba(17,18,20,0.45)] sm:w-60 ${
                      dentro ? "border-gold-bright" : "border-line"
                    }`}
                  >
                    <div className="relative aspect-square overflow-hidden bg-ink-elev-2">
                      {s.foto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.foto} alt={s.nome} className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center font-display text-4xl text-muted">
                          {s.nome.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="absolute left-3 top-3 rounded-full bg-ink-elev/90 px-2.5 py-1 font-accent text-[10px] uppercase tracking-wider text-bone-dim backdrop-blur">
                        {s.categoria}
                      </span>
                    </div>

                    <div className="p-4">
                      <p className="truncate font-body text-sm font-semibold text-bone">{s.nome}</p>
                      <div className="mt-1 flex items-baseline justify-between">
                        <span className="font-body text-xs text-muted">{s.duracaoMin} min</span>
                        <span className="font-accent text-sm text-gold-bright">{preco(s.preco)}</span>
                      </div>
                      <button
                        onClick={() =>
                          dentro
                            ? removeServicoFromCart(barbearia.id, s.id)
                            : addServicoToCart(barbearia.id, s)
                        }
                        className={`mt-3.5 w-full rounded-xl py-2.5 font-body text-xs font-semibold transition-colors ${
                          dentro
                            ? "border border-gold-bright bg-gold-bright/10 text-gold-bright"
                            : "bg-bone text-ink hover:bg-bone-dim"
                        }`}
                      >
                        {dentro ? "Adicionado ✓" : "Adicionar"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </ScrollRail>
          </div>
        </div>
      </section>

      {/* ── COMBOS ───────────────────────────────────────── */}
      {combos.length > 0 && (
        <section id="combos" className="border-t border-line bg-ink-elev-2/50 px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <SectionLabel n={numSecao("combos")}>Combos</SectionLabel>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-bone">
              Junte serviços e pague menos
            </h2>
            <p className="mt-2 max-w-md font-body text-sm text-bone-dim">
              Pacotes prontos com dois ou mais serviços, tudo na mesma visita e por um preço
              menor do que separado.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {combos.map((c) => {
                const dentro = noCarrinho(c.id);
                const economia = economiaDoCombo(c);
                const partes = c.servicosIncluidos ?? [];
                return (
                  <article
                    key={c.id}
                    className={`flex flex-col overflow-hidden rounded-2xl border bg-ink-elev transition-[transform,box-shadow] hover:-translate-y-1 hover:shadow-[0_16px_40px_-20px_rgba(17,18,20,0.45)] ${
                      dentro ? "border-gold-bright" : "border-line"
                    }`}
                  >
                    <div className="flex gap-4 p-5">
                      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-ink-elev-2">
                        {c.foto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.foto} alt={c.nome} className="h-full w-full object-cover" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center font-display text-3xl text-muted">
                            {c.nome.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-display text-lg font-semibold leading-tight text-bone">
                            {c.nome}
                          </p>
                          {economia > 0 && (
                            <span className="shrink-0 rounded-full bg-ok-soft px-2.5 py-1 font-body text-[10px] font-bold text-ok">
                              −{preco(economia)}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 font-body text-xs text-muted">{c.duracaoMin} min</p>

                        <ul className="mt-2.5 space-y-1">
                          {partes.map((id) => (
                            <li
                              key={id}
                              className="flex items-center gap-1.5 font-body text-xs text-bone-dim"
                            >
                              <span className="text-ok" aria-hidden>
                                ✓
                              </span>
                              {nomeServico(id)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3 border-t border-line px-5 py-4">
                      <div>
                        {economia > 0 && (
                          <span className="font-body text-xs text-muted line-through">
                            {preco(c.preco + economia)}
                          </span>
                        )}
                        <p className="font-accent text-lg text-gold-bright">{preco(c.preco)}</p>
                      </div>
                      <button
                        onClick={() =>
                          dentro
                            ? removeServicoFromCart(barbearia.id, c.id)
                            : addServicoToCart(barbearia.id, c)
                        }
                        className={`rounded-xl px-5 py-2.5 font-body text-xs font-semibold transition-colors ${
                          dentro
                            ? "border border-gold-bright bg-gold-bright/10 text-gold-bright"
                            : "bg-bone text-ink hover:bg-bone-dim"
                        }`}
                      >
                        {dentro ? "Adicionado ✓" : "Adicionar combo"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── PRODUTOS (Pro) ───────────────────────────────── */}
      {isPro && produtos.length > 0 && (
        <section className="border-t border-line px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <SectionLabel n={numSecao("produtos")}>Produtos</SectionLabel>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-bone">
              Leve pra casa
            </h2>
            <p className="mt-2 font-body text-sm text-bone-dim">
              Compre junto e retire no balcão no dia do seu horário.
            </p>

            <div className="mt-10 space-y-12">
              {categoriasProduto.map((cat) => (
                <div key={cat}>
                  <div className="mb-4 flex items-baseline justify-between">
                    <h3 className="font-display text-lg font-semibold text-bone">{cat}</h3>
                    <span className="font-accent text-[11px] text-muted">
                      {produtos.filter((p) => p.categoria === cat).length} itens
                    </span>
                  </div>
                  <ScrollRail ariaLabel={`Produtos — ${cat}`}>
                    {produtos
                      .filter((p) => p.categoria === cat)
                      .map((p) => {
                        const qtd = qtdNoCarrinho(p.id);
                        const esgotado = p.estoque === 0;
                        return (
                          <article
                            key={p.id}
                            className={`w-56 shrink-0 snap-start overflow-hidden rounded-2xl border bg-ink-elev transition-[transform,box-shadow] sm:w-60 ${
                              esgotado
                                ? "border-line opacity-55"
                                : "hover:-translate-y-1 hover:shadow-[0_16px_40px_-20px_rgba(17,18,20,0.45)]"
                            } ${qtd > 0 ? "border-gold-bright" : "border-line"}`}
                          >
                            <div className="relative aspect-square overflow-hidden bg-ink-elev-2">
                              {p.foto ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={p.foto}
                                  alt={p.nome}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="flex h-full w-full items-center justify-center font-display text-4xl text-muted">
                                  {p.nome.charAt(0).toUpperCase()}
                                </span>
                              )}
                              {!esgotado && p.estoque <= 5 && (
                                <span className="absolute left-3 top-3 rounded-full bg-gold-bright px-2.5 py-1 font-accent text-[10px] uppercase tracking-wider text-white">
                                  Últimas {p.estoque}
                                </span>
                              )}
                            </div>

                            <div className="p-4">
                              <p className="truncate font-body text-sm font-semibold text-bone">
                                {p.nome}
                              </p>
                              <div className="mt-1 flex items-baseline justify-between">
                                <span className="font-body text-xs text-muted">
                                  {esgotado ? "Esgotado" : "Retirada no balcão"}
                                </span>
                                <span className="font-accent text-sm text-gold-bright">
                                  {preco(p.preco)}
                                </span>
                              </div>

                              {esgotado ? (
                                <p className="mt-3.5 w-full rounded-xl border border-line py-2.5 text-center font-body text-xs text-muted">
                                  Indisponível
                                </p>
                              ) : qtd > 0 ? (
                                <div className="mt-3.5 flex items-center justify-between rounded-xl border border-gold-bright bg-gold-bright/10 px-2 py-1.5">
                                  <button
                                    onClick={() => setProdutoQtd(barbearia.id, p.id, qtd - 1)}
                                    aria-label={`Menos ${p.nome}`}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-gold-bright hover:bg-gold-bright/15"
                                  >
                                    −
                                  </button>
                                  <span className="font-accent text-sm text-gold-bright">{qtd}</span>
                                  <button
                                    onClick={() => setProdutoQtd(barbearia.id, p.id, qtd + 1)}
                                    disabled={qtd >= p.estoque}
                                    aria-label={`Mais ${p.nome}`}
                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-gold-bright hover:bg-gold-bright/15 disabled:opacity-30"
                                  >
                                    +
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => addProdutoToCart(barbearia.id, p)}
                                  className="mt-3.5 w-full rounded-xl bg-bone py-2.5 font-body text-xs font-semibold text-ink transition-colors hover:bg-bone-dim"
                                >
                                  Adicionar
                                </button>
                              )}
                            </div>
                          </article>
                        );
                      })}
                  </ScrollRail>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── EQUIPE ───────────────────────────────────────── */}
      {barbeiros.length > 0 && (
        <section className="border-t border-line bg-ink-elev-2/50 px-6 py-20">
          <div className="mx-auto max-w-5xl">
            <SectionLabel n={numSecao("equipe")}>Equipe</SectionLabel>
            <h2 className="mt-4 max-w-lg font-display text-3xl font-bold tracking-tight text-bone sm:text-4xl">
              Quem vai cuidar do seu corte
            </h2>
            <p className="mt-3 max-w-md font-body text-sm text-bone-dim">
              Escolha um profissional e a agenda dele abre no próximo passo. Sem preferência? A
              gente encaixa com quem estiver livre mais cedo.
            </p>

            <div className="mt-10">
              <ScrollRail ariaLabel="Equipe">
                {barbeiros.map((b) => {
                  const escolhido = cart.barbeiroPreferidoId === b.id;
                  return (
                    <button
                      key={b.id}
                      onClick={() =>
                        setBarbeiroPreferido(barbearia.id, escolhido ? undefined : b.id)
                      }
                      className={`group relative w-64 shrink-0 snap-start overflow-hidden rounded-3xl border text-left transition-[transform,box-shadow] hover:-translate-y-1 sm:w-72 ${
                        escolhido
                          ? "border-gold-bright shadow-[0_20px_50px_-24px_rgba(143,88,4,0.6)]"
                          : "border-line hover:shadow-[0_16px_40px_-20px_rgba(17,18,20,0.4)]"
                      }`}
                    >
                      <div className="relative aspect-[4/5] overflow-hidden bg-ink-elev-2">
                        {b.foto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={b.foto}
                            alt={b.nome}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center font-display text-5xl text-muted">
                            {b.nome.charAt(0)}
                          </span>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

                        {escolhido && (
                          <span className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-gold-bright font-body text-sm font-bold text-white">
                            ✓
                          </span>
                        )}

                        <div className="absolute inset-x-0 bottom-0 p-5">
                          <p className="font-display text-xl font-semibold text-white">{b.nome}</p>
                          <p className="mt-0.5 font-body text-xs text-white/75">
                            {b.especialidade}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`px-5 py-3.5 text-center font-body text-xs font-semibold transition-colors ${
                          escolhido ? "bg-gold-bright text-white" : "bg-ink-elev text-bone-dim"
                        }`}
                      >
                        {escolhido ? "Escolhido para o seu horário" : "Cortar com " + b.nome.split(" ")[0]}
                      </div>
                    </button>
                  );
                })}
              </ScrollRail>
            </div>
          </div>
        </section>
      )}

      {/* ── GALERIA ──────────────────────────────────────── */}
      {galeria.length > 0 && (
        <section className="border-t border-line px-6 py-16">
          <div className="mx-auto max-w-5xl">
            <SectionLabel n={numSecao("galeria")}>O espaço</SectionLabel>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-bone">
              Por dentro da barbearia
            </h2>

            <div className="mt-8">
              <ScrollRail ariaLabel="Fotos da barbearia">
                {galeria.map((src, i) => (
                  <div
                    key={i}
                    className="aspect-[4/3] w-72 shrink-0 snap-start overflow-hidden rounded-2xl border border-line bg-ink-elev-2 sm:w-96"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt={`${barbearia.nome} — foto ${i + 1}`}
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.03]"
                    />
                  </div>
                ))}
              </ScrollRail>
            </div>
          </div>
        </section>
      )}

      {/* ── LOCALIZAÇÃO ──────────────────────────────────── */}
      <section className="border-t border-line px-6 py-16">
        <div className="mx-auto grid max-w-5xl gap-10 sm:grid-cols-2">
          <div>
            <SectionLabel n={numSecao("local")}>Onde estamos</SectionLabel>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-bone">
              Como chegar
            </h2>
            <p className="mt-4 font-body text-sm leading-relaxed text-bone-dim">
              {barbearia.endereco}
            </p>
            {barbearia.linkMaps && (
              <a
                href={barbearia.linkMaps}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-block rounded-full border border-line-strong px-6 py-3 font-body text-sm font-semibold text-bone transition-colors hover:border-bone hover:bg-bone hover:text-ink"
              >
                Abrir no Google Maps ↗
              </a>
            )}
          </div>

          <div className="rounded-2xl border border-line bg-ink-elev p-6">
            <p className="font-accent text-[10px] uppercase tracking-[0.2em] text-muted">
              Horário de funcionamento
            </p>
            <ul className="mt-4 space-y-2.5">
              {WEEKDAYS.map((d) => {
                const aberto = barbearia.diasFuncionamento.includes(d.id);
                return (
                  <li
                    key={d.id}
                    className="flex items-center justify-between border-b border-line pb-2.5 font-body text-sm last:border-0"
                  >
                    <span className={aberto ? "text-bone" : "text-muted"}>{d.label}</span>
                    <span
                      className={`font-accent text-xs ${aberto ? "text-gold-bright" : "text-muted"}`}
                    >
                      {aberto
                        ? `${barbearia.horarioAbertura} — ${barbearia.horarioFechamento}`
                        : "Fechado"}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <p className="mt-14 text-center font-body text-[11px] text-muted">
          Página feita com{" "}
          <Link href="/" className="text-gold-bright hover:underline">
            Navalha
          </Link>
        </p>
      </section>
    </>
  );
}
