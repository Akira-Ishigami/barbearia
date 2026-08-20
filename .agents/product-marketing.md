# Product Marketing Context

*Last updated: 2026-08-19*

> Rascunho V1, feito a partir da conversa inicial (projeto ainda sem código). Revisar e corrigir antes de usar em copy final.

## Product Overview
**One-liner:** Sistema completo de agendamento online para barbearias, com pagamento integrado via Mercado Pago.
**What it does:** Plataforma SaaS que dá a cada barbearia uma página própria para divulgar serviços, produtos e localização, com agenda online para os clientes marcarem horário e pagarem (opcionalmente) na hora. O dono da barbearia gerencia tudo por um painel: serviços, preços, fotos, produtos à venda e agendamentos.
**Product category:** Software de agendamento (booking) vertical para barbearias/salões.
**Product type:** SaaS por assinatura, multi-tenant (cada barbearia tem sua própria "loja"/página pública).
**Business model:** Assinatura mensal em dois planos — Básico R$ 259,99 e Top/Premium R$ 309,98 — pagos via Mercado Pago.

## Target Audience
**Target companies:** Barbearias independentes e pequenas redes, majoritariamente no Brasil.
**Decision-makers:** Dono(a) da barbearia / barbeiro responsável pelo negócio.
**Primary use case:** Substituir agenda manual (caderno, WhatsApp, ligação) por um sistema online que o cliente final acessa para marcar horário sozinho, ver preços e serviços, e pagar antecipado.
**Jobs to be done:**
- Ter uma "vitrine" online profissional da barbearia (serviços, produtos, fotos, localização) sem precisar de site próprio.
- Reduzir não comparecimento e trabalho manual de agendar via mensagem.
- Receber pagamento online (sinal ou pagamento completo) direto na conta Mercado Pago da barbearia.

**Use cases:**
- Barbearia envia o link da sua página para clientes agendarem sozinhos.
- Cliente escolhe serviço, vê preço/foto, escolhe horário disponível e paga.
- Barbearia atualiza catálogo de serviços e produtos (com fotos) e vê agenda em tempo real.

## Personas
(B2C na ponta do cliente final, mas venda é B2B para a barbearia — persona única de comprador por ora)

| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Dono de barbearia | Ocupar a agenda, parecer profissional, receber pagamento garantido | Perde tempo confirmando horário por WhatsApp, tem faltas, não tem site | Agenda online + pagamento integrado + página própria, pronto em minutos |

## Problems & Pain Points
**Core problem:** Agendamento manual (WhatsApp/telefone/caderno) é lento, gera confusão de horário e falta de clientes que marcam e não aparecem.
**Why alternatives fall short:**
- Agenda de papel não tem lembrete, não mostra disponibilidade real, não recebe pagamento.
- Sistemas genéricos de agendamento não são pensados para barbearia (sem catálogo de serviço com foto, sem loja de produtos).
**What it costs them:** Tempo respondendo mensagem, horários vagos por falta, sem pagamento garantido antecipado.
**Emotional tension:** Parecer "amador" sem presença digital própria; insegurança de não saber se cliente vai aparecer.

## Competitive Landscape
**Direct:** Sistemas de agendamento para salão/barbearia genéricos — falta identidade visual própria e venda de produtos integrada.
**Secondary:** Agenda via WhatsApp/Google Agenda — falta automação, pagamento e página pública apresentável.
**Indirect:** Fazer site próprio do zero — caro e demorado para o dono de barbearia.

## Differentiation
**Key differentiators:**
- Página pública pronta (marca, fotos, serviços, produtos, localização) — funciona como "site" da barbearia.
- Pagamento direto na conta Mercado Pago da própria barbearia (não passa pela plataforma).
- Setup rápido: assina, cadastra a barbearia, já está no ar.

**How we do it differently:** Foco 100% vertical em barbearia (não é sistema genérico de agendamento adaptado).
**Why that's better:** Menos configuração, catálogo e fluxo já pensados para o negócio de barbearia.
**Why customers choose us:** Rapidez para ter presença online profissional + cobrança resolvida.

## Objections
| Objection | Response |
|-----------|----------|
| "Já uso WhatsApp, não preciso disso" | O sistema reduz o trabalho manual e evita falta ao dar pagamento antecipado. |
| "É caro pra minha barbearia pequena" | Diferença de plano permite começar simples (Básico) e crescer para o Top. |
| "Não sei mexer em sistema" | Cadastro e painel são pensados para ser simples, sem precisar de conhecimento técnico. |

**Anti-persona:** Negócios que não trabalham com agendamento por horário marcado (ex: fila livre sem hora marcada) ou que não querem presença digital.

## Switching Dynamics
**Push:** Cansaço de organizar agenda manualmente e perder cliente por falta de resposta rápida.
**Pull:** Página profissional pronta + pagamento resolvido, sem precisar contratar site.
**Habit:** Já estão acostumados a usar WhatsApp/caderno.
**Anxiety:** Medo de sistema ser complicado ou de perder controle do dinheiro (por isso pagamento vai direto pro Mercado Pago da barbearia, não intermediado).

## Customer Language
**How they describe the problem:** *(a validar com clientes reais)*
**How they describe us:** *(a validar)*
**Words to use:** agenda online, sua barbearia, seus clientes marcam sozinhos, receba pelo Mercado Pago, sem complicação.
**Words to avoid:** jargão técnico ("multi-tenant", "SaaS", "dashboard" sem explicação).
**Glossary:**
| Term | Meaning |
|------|---------|
| Página da barbearia | Site público gerado automaticamente para cada barbearia cadastrada |
| Painel | Área logada onde o dono gerencia serviços, produtos e agenda |
| Confirmação por WhatsApp | Mensagem automática enviada ao cliente via Evolution API quando o pagamento do agendamento é confirmado. Exclusivo do plano Pro (se sair do papel). **Bloqueado**: usuário não tem instância da Evolution API hoje, então não pode ser construído nem oferecido de verdade agora. Retirado da landing por esse motivo (2026-08-19). Revisar se/quando o usuário tiver a Evolution rodando. |

## Brand Voice
**Tone:** Moderno, profissional, direto — transmite confiança para quem nunca teve site.
**Style:** Claro, visual, pouco texto, foco em benefício prático.
**Personality:** Moderno, confiável, ágil, acessível, profissional.

## Proof Points
**Metrics:** *(ainda não há — produto novo)*
**Customers:** *(nenhum ainda)*
**Testimonials:** *(nenhum ainda)*
**Value themes:**
| Theme | Proof |
|-------|-------|
| Presença profissional rápida | Página pronta com fotos, serviços, produtos e localização |
| Pagamento sem atrito | Integração direta com Mercado Pago da barbearia |

## Goals
**Primary business goal:** Converter visitantes da landing page em assinantes de um dos dois planos.
**Key conversion action:** Clicar em "assinar" / ir para pagamento (Mercado Pago) e completar cadastro da barbearia.
**Current metrics:** N/A — pré-lançamento.

## Plans (referência rápida para copy)
- **Básico — R$ 259,99/mês:** agenda online, cadastro de serviços com preço, página pública básica, cadastro de barbearia.
- **Top — R$ 309,98/mês:** tudo do Básico + fotos de serviços/produtos, loja de produtos, localização/mapa, pagamento online via Mercado Pago integrado, personalização visual da página.

*(Diferenciação exata dos planos é uma decisão de produto — ajustar aqui conforme o dono decidir o que entra em cada plano.)*
