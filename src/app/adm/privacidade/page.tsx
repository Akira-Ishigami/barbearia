"use client";

import Link from "next/link";
import { Cabecalho, Secao, Selo } from "@/components/adm/ui";

/**
 * Estação 07 — o que a plataforma não vê.
 *
 * Esta tela não puxa dado nenhum: ela existe pra deixar escrito, em
 * português e num lugar que se pode mostrar a alguém, o que esta área
 * enxerga e o que ela deliberadamente deixa de enxergar.
 *
 * Serve pra três coisas: pro dono lembrar da régua quando pedir a próxima
 * funcionalidade, pra quem entrar no suporte saber o limite antes de
 * procurar, e pra responder a barbearia que perguntar "vocês veem quanto
 * eu faturo?" — a resposta é não, e dá pra mostrar onde está escrito.
 */

const PODE = [
  ["Assinatura", "Status, plano, data do teste e até quando está paga"],
  ["Integrações", "Se conectou Mercado Pago ou Pix, e quando a autorização expira"],
  ["Saúde da conta", "Quantos serviços, produtos, pessoas na equipe e pedidos"],
  ["Uso", "Se está recebendo agendamento e quando foi o último"],
  ["Contato", "Telefone e endereço — os mesmos que estão na página pública dela"],
];

const NAO_PODE = [
  ["Faturamento", "Quanto uma barbearia ganhou, no dia, no mês ou no total"],
  ["Valor de venda", "Quanto custou qualquer pedido, serviço ou produto"],
  ["Quem agendou", "Nome, telefone ou e-mail de quem marcou horário lá"],
  ["A agenda dela", "Quem foi atendido, por quem e quando"],
  ["Equipe dela", "Nome e e-mail de dono e barbeiros"],
  ["Chave Pix", "Nem a chave, nem mascarada, nem o nome do beneficiário"],
];

export default function AdmPrivacidadePage() {
  return (
    <div>
      <Cabecalho
        secao="Estação 07"
        titulo="O que não vemos"
        linha="A régua que vale em todas as telas desta área. Está escrita aqui pra poder ser cobrada."
      />

      <Secao titulo="A regra">
        <blockquote className="max-w-2xl border-l-2 border-cyan py-2 pl-5">
          <p className="font-display text-2xl leading-snug text-bone">
            Somar todas as barbearias é o negócio da Navalha.
            <br />
            Abrir uma e ler a vida dela não é.
          </p>
        </blockquote>

        <p className="mt-6 max-w-2xl font-body text-sm leading-relaxed text-bone-dim">
          O teste é curto: se o dado serve pra <strong className="text-bone">cobrar</strong>,
          pra <strong className="text-bone">dar suporte</strong> ou pra saber se o{" "}
          <strong className="text-bone">produto está funcionando</strong>, pode aparecer. Se
          serve pra saber quanto a barbearia ganha ou quem passa por lá, não.
        </p>
      </Secao>

      <Secao titulo="Na prática" atraso={60}>
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <div className="flex items-baseline gap-2 border-b border-line pb-2">
              <Selo tom="ok">aparece</Selo>
              <span className="font-body text-xs text-muted">o que a plataforma lê</span>
            </div>
            {PODE.map(([titulo, texto]) => (
              <div key={titulo} className="border-b border-line py-3">
                <p className="font-body text-sm font-medium text-bone">{titulo}</p>
                <p className="mt-0.5 font-body text-xs leading-relaxed text-muted">{texto}</p>
              </div>
            ))}
          </div>

          <div>
            <div className="flex items-baseline gap-2 border-b border-line pb-2">
              <Selo tom="off">não aparece</Selo>
              <span className="font-body text-xs text-muted">nem para o administrador</span>
            </div>
            {NAO_PODE.map(([titulo, texto]) => (
              <div key={titulo} className="border-b border-line py-3">
                <p className="font-body text-sm font-medium text-bone">{titulo}</p>
                <p className="mt-0.5 font-body text-xs leading-relaxed text-muted">{texto}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 max-w-2xl font-body text-xs leading-relaxed text-muted">
          Isso não é só a tela escondendo: as consultas do servidor não pedem esses campos
          ao banco. O dinheiro de venda nem sai da tabela.
        </p>
      </Secao>

      <Secao titulo="Dado pessoal de quem agenda" atraso={120}>
        <div className="max-w-2xl space-y-4 font-body text-sm leading-relaxed text-bone-dim">
          <p>
            Nome, e-mail e telefone de quem marca horário são dado pessoal, e essa pessoa não
            é cliente da Navalha — é cliente da barbearia. A plataforma guarda porque sem
            isso não existe agendamento, mas guardar não é o mesmo que poder olhar quando
            quiser.
          </p>

          <div className="border-t border-line-strong pt-4">
            <p className="font-body text-sm font-medium text-bone">
              Por isso, na estação 04:
            </p>
            <ul className="mt-2 space-y-1.5">
              <li>Não existe listagem — abrir a tela não mostra pessoa nenhuma.</li>
              <li>
                A busca exige o e-mail completo ou o telefone. Pedaço não devolve nada, senão
                viraria um jeito de baixar a base aos poucos.
              </li>
              <li>
                O que volta vem mascarado: <span className="font-accent">Akira M.</span>,{" "}
                <span className="font-accent">ak•••@gmail.com</span>,{" "}
                <span className="font-accent">(11) ••••-7777</span>.
              </li>
              <li>Em qual barbearia a pessoa foi atendida nunca é dito.</li>
              <li>Toda busca fica no registro, com quem procurou.</li>
            </ul>
          </div>

          <div className="border-t border-line-strong pt-4">
            <p className="font-body text-sm font-medium text-bone">
              Quando a pessoa pede pra sair
            </p>
            <p className="mt-2">
              O administrador apaga o cadastro dela na estação 04, pela busca. A conta e os
              dados somem de verdade. Os pedidos ficam com a barbearia, sem ligação com
              ninguém — nota é registro dela, e deixa de apontar pra uma pessoa
              identificada.
            </p>
          </div>
        </div>
      </Secao>

      <Secao titulo="Quem pode o quê" atraso={180}>
        <div className="max-w-2xl space-y-3 font-body text-sm leading-relaxed text-bone-dim">
          <p>
            Suporte e administração têm alcances diferentes, e a diferença está na{" "}
            <Link href="/adm/equipe" className="text-cyan underline underline-offset-2">
              estação 06
            </Link>
            . Tudo que os dois fazem — inclusive procurar um cliente — fica registrado na{" "}
            <Link href="/adm/registro" className="text-cyan underline underline-offset-2">
              estação 05
            </Link>
            , com e-mail e hora.
          </p>
          <p>
            Acesso amplo sem trilha visível não se sustenta. Se um dia alguém perguntar quem
            viu o quê, a resposta tem que estar num lugar que dá pra abrir.
          </p>
        </div>

        <p className="mt-8 font-body text-xs text-muted">
          A régua também vive no código, em{" "}
          <span className="font-accent text-bone-dim">src/lib/privacidade.ts</span> — pra ser
          lida por quem for mexer, não só por quem for usar.
        </p>
      </Secao>
    </div>
  );
}
