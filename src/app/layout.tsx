import type { Metadata } from "next";
import {
  Sora,
  JetBrains_Mono,
  Plus_Jakarta_Sans,
  Unbounded,
  Instrument_Serif,
} from "next/font/google";
import "./globals.css";

const sora = Sora({
  variable: "--font-display",
  subsets: ["latin"],
});

// Só usada na área do cliente (/loja) — dá a ela uma identidade própria,
// mais geométrica, sem mexer no painel nem na home.
const unbounded = Unbounded({
  variable: "--font-loja-display",
  subsets: ["latin"],
});

// Só na área da plataforma (/adm). Serifa num painel administrativo é
// escolha incomum de propósito: é o que faz aquela área não se confundir
// com o painel da barbearia nem com a loja, sem precisar de aviso na tela.
const instrument = Instrument_Serif({
  variable: "--font-adm-display",
  subsets: ["latin"],
  weight: "400",
});

const mono = JetBrains_Mono({
  variable: "--font-accent",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Navalha — Sistema de agendamento para barbearias",
  description:
    "Agenda online, página própria, catálogo de serviços e produtos, e pagamento via Mercado Pago. Tudo o que sua barbearia precisa pra parar de agendar por mensagem.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${sora.variable} ${mono.variable} ${jakarta.variable} ${unbounded.variable} ${instrument.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-ink text-bone">{children}</body>
    </html>
  );
}
