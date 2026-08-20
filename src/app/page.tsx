import Link from "next/link";
import { PLANS, TRIAL_DAYS } from "@/lib/plans";

function Icon({
  path,
  className = "h-4 w-4",
}: {
  path: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d={path} />
    </svg>
  );
}

const ICONS = {
  check: "M20 6 9 17l-5-5",
  clock: "M12 7v5l3.5 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  users:
    "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  scissors:
    "M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.5 8.5l11 11M20 4 8.5 15.5",
  map: "M9 20l-6-3V4l6 3 6-3 6 3v13l-6-3-6 3Zm0-13v13m6-16v13",
  globe:
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
  card: "M2 8h20M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2ZM6 15h4",
};

const STEPS = [
  {
    n: "01",
    title: "Assine o plano",
    desc: "Escolha Básico ou Pro e finalize o pagamento pelo Mercado Pago.",
  },
  {
    n: "02",
    title: "Configure a barbearia",
    desc: "Horário de funcionamento, serviços, preços, fotos, produtos e equipe.",
  },
  {
    n: "03",
    title: "Compartilhe o link",
    desc: "Mande a página pra seus clientes e acompanhe a agenda pelo painel.",
  },
];

const SCREENS = [
  {
    tag: "Dono da barbearia",
    title: "Painel da Barbearia",
    accent: "gold" as const,
    icon: ICONS.scissors,
    items: [
      "Agenda da semana com todos os horários",
      "Confirma ou recusa quem paga no local",
      "Serviços por categoria, com preço e foto",
      "Equipe de barbeiros, cada um com seu acesso",
      "Produtos à venda com controle de estoque",
    ],
  },
  {
    tag: "Barbeiro da equipe",
    title: "Painel do Barbeiro",
    accent: "cyan" as const,
    icon: ICONS.users,
    items: [
      "Agenda pessoal da semana, hora a hora",
      "Aviso na hora quando cai agendamento novo",
      "Confirma o cliente que paga no balcão",
      "Vê só os próprios horários, sem bagunça",
    ],
  },
  {
    tag: "Cliente final",
    title: "Página Web Pública",
    accent: "gold" as const,
    icon: ICONS.globe,
    items: [
      "Agenda sozinho, sem trocar mensagem",
      "Vê serviços, produtos e preços",
      "Paga online pelo Mercado Pago",
      "Funciona em qualquer celular ou computador",
    ],
  },
];

const FAQ = [
  {
    q: "Preciso saber programar ou ter site próprio?",
    a: "Não. Você assina, configura sua barbearia pelo painel e sua página já fica no ar — pronta pra mandar pro cliente.",
  },
  {
    q: "Cada barbeiro tem a própria agenda?",
    a: "No plano Pro, sim — cada barbeiro entra com seu próprio acesso e vê só os horários dele. No Básico o painel é único.",
  },
  {
    q: "O pagamento dos clientes cai direto pra mim?",
    a: "Sim. A cobrança é feita pelo Mercado Pago conectado à sua própria conta — o dinheiro não passa pela Navalha.",
  },
  {
    q: "Dá pra trocar de plano depois?",
    a: "Sim. Você pode migrar do Básico pro Pro (ou voltar) quando quiser — a cobrança é ajustada no próximo ciclo.",
  },
];

export default function Home() {
  return (
    <div className="grain flex flex-1 flex-col overflow-x-clip">
      {/* NAV */}
      <header className="sticky top-0 z-50 border-b border-line-strong/60 bg-[#0a0e16]/85 backdrop-blur-xl">
        <div className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-gold/40 bg-gradient-to-br from-gold/20 to-cyan/10 text-gold-bright shadow-[0_0_18px_-4px_rgba(255,207,107,0.5)] transition-transform group-hover:scale-105">
              <Icon path={ICONS.scissors} className="h-4 w-4" />
            </span>
            <span className="font-display text-xl font-semibold tracking-tight text-bone">
              Navalha
            </span>
          </Link>

          <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full border border-line-strong/50 bg-white/[0.03] px-1.5 py-1.5 font-body text-sm text-bone-dim md:flex">
            {[
              ["#sistema", "O sistema"],
              ["#planos", "Planos"],
              ["#faq", "Perguntas"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="rounded-full px-4 py-1.5 transition-colors hover:bg-white/5 hover:text-gold-bright"
              >
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="hidden font-body text-sm text-bone-dim transition-colors hover:text-cyan-bright md:block"
            >
              Entrar
            </Link>
            <a
              href="#planos"
              className="rounded-full bg-gradient-to-r from-gold to-gold-bright px-5 py-2.5 font-body text-sm font-semibold text-ink shadow-[0_0_20px_-6px_rgba(255,207,107,0.7)] transition-transform hover:scale-[1.03]"
            >
              Teste grátis
            </a>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
      </header>

      {/* HERO */}
      <section className="grid-field relative overflow-hidden border-b border-line px-6 pb-28 pt-20 md:pt-28">
        <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-cyan/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-20 md:grid-cols-[1.05fr_0.95fr]">
          <div className="animate-rise">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line-strong px-4 py-1.5 font-body text-xs uppercase tracking-[0.2em] text-gold-bright">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-cyan-bright" />
              Sistema de agendamento inteligente
            </div>
            <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-bone sm:text-6xl lg:text-[4.1rem]">
              Sua barbearia,
              <br />
              rodando em <span className="text-gold-bright">tempo real</span>.
            </h1>
            <p className="mt-6 max-w-lg font-body text-lg leading-relaxed text-bone-dim">
              Um painel pra você, um painel pra cada barbeiro e uma página
              pública pro cliente agendar e pagar sozinho — tudo conectado,
              sem troca de mensagem no meio.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a
                href="#planos"
                className="rounded-full bg-gold px-7 py-3.5 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.03] hover:bg-gold-bright"
              >
                Testar grátis por 15 dias
              </a>
              <a
                href="#sistema"
                className="rounded-full border border-line-strong px-7 py-3.5 font-body text-sm font-semibold text-bone transition-colors hover:border-cyan-bright hover:text-cyan-bright"
              >
                Ver o sistema
              </a>
            </div>
          </div>

          {/* 3D dashboard preview */}
          <div className="relative mx-auto w-full max-w-sm [perspective:1400px]">
            <div className="animate-float-tilt">
              <div className="glass-panel relative overflow-hidden rounded-3xl shadow-2xl shadow-black/70">
                {/* window chrome */}
                <div className="flex items-center gap-1.5 border-b border-line px-5 py-3">
                  <span className="h-2 w-2 rounded-full bg-line-strong" />
                  <span className="h-2 w-2 rounded-full bg-line-strong" />
                  <span className="h-2 w-2 rounded-full bg-line-strong" />
                  <span className="ml-3 font-accent text-[10px] text-muted">
                    painel.navalha.app
                  </span>
                </div>

                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display text-lg font-semibold text-bone">
                        Barbearia do Zé
                      </p>
                      <p className="font-body text-xs text-muted">
                        Vila Madalena · São Paulo
                      </p>
                    </div>
                    <span className="flex items-center gap-1.5 rounded-full bg-cyan/10 px-3 py-1 font-body text-xs font-semibold text-cyan-bright">
                      <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-cyan-bright" />
                      Aberto
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-line px-3.5 py-2.5 font-body text-xs text-bone-dim">
                    <Icon path={ICONS.clock} className="h-3.5 w-3.5 text-gold-bright" />
                    Seg–Sáb · 09h às 20h
                  </div>

                  <div className="mt-4 flex gap-2">
                    {["Zé", "Nando", "Kaká"].map((b, i) => (
                      <span
                        key={b}
                        className={`flex-1 rounded-lg border px-2 py-2 text-center font-body text-xs ${
                          i === 0
                            ? "border-gold-bright/50 bg-gold-bright/10 text-gold-bright"
                            : "border-line text-bone-dim"
                        }`}
                      >
                        {b}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 space-y-2.5">
                    {[
                      ["Corte degradê", "R$ 45"],
                      ["Barba desenhada", "R$ 35"],
                    ].map(([svc, price]) => (
                      <div
                        key={svc}
                        className="flex items-center justify-between rounded-xl border border-line px-4 py-3"
                      >
                        <span className="font-body text-sm text-bone">{svc}</span>
                        <span className="font-accent text-sm text-gold-bright">
                          {price}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-2">
                    {["09:00", "10:30", "14:00", "16:30"].map((t, i) => (
                      <div
                        key={t}
                        className={`rounded-lg border px-2 py-2 text-center font-accent text-[11px] ${
                          i === 2
                            ? "border-cyan-bright bg-cyan-bright/10 text-cyan-bright"
                            : "border-line text-bone-dim"
                        }`}
                      >
                        {t}
                      </div>
                    ))}
                  </div>

                  <button className="mt-5 w-full rounded-xl bg-gold py-3 font-body text-sm font-semibold text-ink">
                    Confirmar agendamento
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="scan-divider" />
      <div className="overflow-hidden border-b border-line bg-[#0e1220] py-4">
        <div className="animate-marquee flex w-max gap-10 whitespace-nowrap">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-10">
              {[
                "AGENDA EM TEMPO REAL",
                "PAINEL DO BARBEIRO",
                "PÁGINA PÚBLICA",
                "HORÁRIO DE FUNCIONAMENTO",
                "PAGAMENTO PELO MERCADO PAGO",
                "MULTI-BARBEIRO",
              ].map((t) => (
                <span
                  key={t}
                  className="font-accent text-sm tracking-wide text-bone-dim"
                >
                  {t} <span className="text-cyan-bright">◆</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* SYSTEM SCREENS */}
      <section id="sistema" className="border-b border-line bg-[#0a1414] px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-xl">
            <p className="font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">
              O sistema
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-bone sm:text-5xl">
              Três telas, um só fluxo.
            </h2>
            <p className="mt-4 font-body text-bone-dim">
              Cada pessoa vê exatamente o que precisa — o dono comanda a
              barbearia, o barbeiro acompanha a própria agenda, e o cliente
              resolve tudo sozinho.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {SCREENS.map((s) => {
              const isGold = s.accent === "gold";
              return (
                <div
                  key={s.title}
                  className={`group relative overflow-hidden rounded-2xl border p-7 transition-colors ${
                    isGold
                      ? "border-line hover:border-gold-bright/40"
                      : "border-line hover:border-cyan-bright/40"
                  } bg-ink-elev/60`}
                >
                  <div
                    className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl transition-opacity opacity-0 group-hover:opacity-100 ${
                      isGold ? "bg-gold/15" : "bg-cyan/15"
                    }`}
                  />
                  <div className="relative flex items-center justify-between">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                        isGold
                          ? "border-gold/30 bg-gold/10 text-gold-bright"
                          : "border-cyan/30 bg-cyan/10 text-cyan-bright"
                      }`}
                    >
                      <Icon path={s.icon} className="h-5 w-5" />
                    </span>
                    <span className="font-accent text-[10px] uppercase tracking-widest text-muted">
                      {s.tag}
                    </span>
                  </div>
                  <h3 className="relative mt-5 font-display text-xl font-semibold text-bone">
                    {s.title}
                  </h3>
                  <ul className="relative mt-4 space-y-2.5">
                    {s.items.map((it) => (
                      <li
                        key={it}
                        className="flex items-start gap-2.5 font-body text-sm text-bone-dim"
                      >
                        <Icon
                          path={ICONS.check}
                          className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                            isGold ? "text-gold-bright" : "text-cyan-bright"
                          }`}
                        />
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* steps */}
          <div className="mt-24 grid gap-10 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative">
                <span className="text-outline font-accent text-6xl">{s.n}</span>
                <h4 className="mt-2 font-display text-xl font-semibold text-bone">
                  {s.title}
                </h4>
                <p className="mt-2 font-body text-sm leading-relaxed text-bone-dim">
                  {s.desc}
                </p>
                {i < STEPS.length - 1 && (
                  <div className="absolute -right-5 top-6 hidden font-accent text-xl text-cyan-bright/60 md:block">
                    →
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="planos" className="grid-field relative border-b border-line bg-[#150f08] px-6 py-24">
        <div className="relative mx-auto max-w-6xl">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-bright/30 bg-cyan/10 px-4 py-1.5 font-body text-xs font-semibold text-cyan-bright">
              <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-cyan-bright" />
              {TRIAL_DAYS} dias grátis em qualquer plano
            </span>
            <p className="mt-5 font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">
              Planos
            </p>
            <h2 className="mt-3 font-display text-4xl font-bold tracking-tight text-bone sm:text-5xl">
              Preço justo pra quem tá começando ou já vive lotado.
            </h2>
            <p className="mx-auto mt-4 max-w-xl font-body text-bone-dim">
              Sem taxa por agendamento, sem contrato de fidelidade. Teste
              {" "}{TRIAL_DAYS} dias de graça e cancele quando quiser.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-2">
            {PLANS.map((plan) => (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-3xl border p-8 md:p-10 ${
                  plan.highlight
                    ? "glass-panel border-gold-bright/40 shadow-[0_0_60px_-15px_rgba(255,207,107,0.25)]"
                    : "border-line bg-ink-elev/40"
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3.5 left-8 rounded-full bg-gold-bright px-4 py-1 font-body text-xs font-bold uppercase tracking-wide text-ink">
                    Mais escolhido
                  </span>
                )}
                <h3 className="font-display text-2xl font-semibold text-bone">
                  {plan.name}
                </h3>
                <p className="mt-1 font-body text-sm text-bone-dim">
                  {plan.tagline}
                </p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="font-accent text-base text-gold-bright">
                    R$
                  </span>
                  <span className="font-accent text-5xl leading-none text-bone">
                    {plan.price}
                  </span>
                  <span className="font-body text-sm text-muted">/mês</span>
                </div>

                <ul className="mt-8 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-3 font-body text-sm text-bone-dim"
                    >
                      <Icon
                        path={ICONS.check}
                        className="mt-0.5 h-4 w-4 shrink-0 text-gold-bright"
                      />
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href={`/cadastro?plano=${plan.id}`}
                  className={`mt-10 block rounded-full py-3.5 text-center font-body text-sm font-semibold transition-transform hover:scale-[1.02] ${
                    plan.highlight
                      ? "bg-gold-bright text-ink"
                      : "border border-line-strong text-bone hover:border-gold-bright hover:text-gold-bright"
                  }`}
                >
                  Começar grátis por {TRIAL_DAYS} dias
                </Link>
                <p className="mt-3 text-center font-body text-xs text-muted">
                  Depois, R$ {plan.price}/mês. Cancele quando quiser.
                </p>
              </div>
            ))}
          </div>

          <p className="mt-8 flex items-center justify-center gap-2 text-center font-body text-xs text-muted">
            <Icon path={ICONS.card} className="h-3.5 w-3.5" />
            Pagamento processado pelo Mercado Pago. Sem cobrança durante o
            período de teste.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-b border-line bg-[#120c17] px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <p className="text-center font-accent text-xs uppercase tracking-[0.2em] text-gold-bright">
            Dúvidas
          </p>
          <h2 className="mt-3 text-center font-display text-4xl font-bold tracking-tight text-bone">
            Perguntas frequentes
          </h2>

          <div className="mt-12 divide-y divide-line border-y border-line">
            {FAQ.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between font-display text-lg font-medium text-bone">
                  {item.q}
                  <span className="ml-4 shrink-0 font-accent text-xl text-gold-bright transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl font-body text-sm leading-relaxed text-bone-dim">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden bg-[#0c0a06] px-6 py-24">
        <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[36rem] -translate-x-1/2 rounded-full bg-gold/10 blur-3xl" />
        <div className="relative mx-auto max-w-3xl text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight text-bone sm:text-5xl">
            Pronto pra tirar sua barbearia
            <br />
            do caderno?
          </h2>
          <p className="mx-auto mt-4 max-w-md font-body text-bone-dim">
            Em poucos minutos sua página está no ar, pronta pra receber
            agendamento e pagamento.
          </p>
          <a
            href="#planos"
            className="mt-8 inline-block rounded-full bg-gold px-8 py-4 font-body text-sm font-semibold text-ink transition-transform hover:scale-[1.03] hover:bg-gold-bright"
          >
            Começar agora
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-line px-6 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 font-body text-sm text-muted md:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md border border-gold/40 bg-gold/10 text-gold-bright">
              <Icon path={ICONS.scissors} className="h-3 w-3" />
            </span>
            <span className="font-display text-base text-bone-dim">
              Navalha
            </span>
          </div>
          <p>© 2026 Navalha. Sistema de agendamento para barbearias.</p>
        </div>
      </footer>
    </div>
  );
}
