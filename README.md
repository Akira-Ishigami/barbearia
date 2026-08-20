# Navalha

Sistema de agendamento e gestão para barbearias, com página pública para o
cliente final agendar sozinho e controle de estoque no plano Pro.

> **Estado atual:** protótipo funcional com dados mock em `localStorage`.
> Ainda **não** há banco de dados nem integração real de pagamento — o fluxo de
> "pagar agora" apenas marca o agendamento como confirmado.

## Rodando

```bash
npm install
npm run dev
```

Abre em `http://localhost:3000`.

## Contas de demonstração

O banco mock é populado automaticamente no primeiro acesso.

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Dono — plano Pro | `dono@navalha.app` | `barbearia123` |
| Dono — plano Básico | `dono.basico@navalha.app` | `barbearia123` |
| Barbeiro (equipe do Pro) | `barbeiro@navalha.app` | `barbeiro123` |

## Telas

| Rota | O que é |
| --- | --- |
| `/` | Landing com planos, FAQ e apresentação do sistema |
| `/cadastro` | Cadastro da barbearia + conta do dono |
| `/login` | Entrada (redireciona conforme o papel) |
| `/painel` | Visão geral do dono: resumo do dia, pendentes, concluir atendimento |
| `/painel/agenda` | Agenda semanal em grade, filtrável por barbeiro |
| `/painel/servicos` | Catálogo por categoria, com foto |
| `/painel/produtos` | Loja de produtos *(Pro)* |
| `/painel/estoque` | Entradas, saídas e histórico *(Pro)* |
| `/painel/barbeiros` | Equipe, cada um com login próprio |
| `/painel/localizacao` | Endereço, horário e link do mapa |
| `/painel/relatorios` | Faturamento e relatório mensal de estoque *(Pro)* |
| `/barbeiro` | Agenda semanal pessoal do barbeiro |
| `/loja/[id]` | Página pública: serviços, equipe, produtos e agendamento |

## Diferença entre os planos

Ambos os planos têm agenda, serviços, página pública, localização com mapa e
confirmação de pagamento no local.

Exclusivo do **Pro**:

- Controle de estoque (entradas, saídas, alerta de estoque baixo)
- Loja de produtos na página pública
- Barbeiros ilimitados, cada um com painel próprio
- Relatórios de faturamento e de estoque
- Suporte prioritário

## Como o agendamento funciona

1. O cliente escolhe serviço → barbeiro → dia → horário na página pública.
   Horários já ocupados não aparecem.
2. **Pagar agora** → agendamento já entra como `confirmado`.
3. **Pagar no local** → entra como `pendente`; a barbearia precisa aceitar pelo
   painel (com aviso sonoro e selo de pendentes em qualquer tela).
4. Ao concluir o atendimento, o dono pode registrar produtos vendidos — a baixa
   no estoque é automática.

## Stack

- Next.js 16 (App Router, Turbopack) + TypeScript
- Tailwind CSS v4
- Fontes: Sora (display), Plus Jakarta Sans (texto), JetBrains Mono (números)
- Persistência mock em `localStorage` (`src/lib/mock-db.ts`)

O mock tem versionamento de schema: ao mudar o formato dos dados, o
`SCHEMA_VERSION` é incrementado e os dados antigos do navegador são descartados.

## Próximos passos

- [ ] Supabase no lugar do `localStorage`
- [ ] Mercado Pago (checkout e split para a conta da barbearia)
- [ ] Deploy na Vercel
- [ ] Bloqueio de horários (folga, almoço)
- [ ] Histórico de clientes
