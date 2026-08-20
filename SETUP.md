# Colocando no ar (Vercel + Supabase + Mercado Pago)

Ordem importa: a Vercel primeiro, porque o Mercado Pago pede a URL do site.

---

## 1. Vercel — já está no ar ✅

- Repositório: [github.com/Akira-Ishigami/barbearia](https://github.com/Akira-Ishigami/barbearia)
- Projeto Vercel: **navalha**
- **URL de produção: https://navalha-virid.vercel.app**

Cada `git push` na branch `main` gera um deploy novo automaticamente.

> A URL de produção **não muda** a cada deploy — é ela que vai no Mercado Pago.
> As URLs de preview (de cada branch) mudam, e não servem pro cadastro.

O primeiro deploy funciona sem nenhuma variável: o site sobe, e o que depende de
banco/pagamento devolve um aviso em vez de quebrar.

---

## 2. Supabase

1. [supabase.com](https://supabase.com) → **New project**
2. **SQL Editor** → cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) → **Run**
3. **Project Settings → API**, copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **segredo**

> A `service_role` ignora todas as regras de segurança do banco. Ela só pode
> existir nas variáveis do servidor. Nunca num nome que comece com `NEXT_PUBLIC_`.

---

## 3. Mercado Pago

Em [mercadopago.com.br/developers/panel/app](https://www.mercadopago.com.br/developers/panel/app),
crie (ou abra) sua aplicação.

### 3.1 Marketplace — pra cada barbearia receber na conta dela

Na aplicação, marque que ela usa **Checkout Pro** e ative o modelo de
**marketplace**. Depois:

- **URLs de redirecionamento (OAuth)** → cadastre exatamente:
  ```
  https://navalha-virid.vercel.app/api/mp/callback
  ```
- Copie **Client ID** → `MP_CLIENT_ID`
- Copie **Client Secret** → `MP_CLIENT_SECRET` ⚠️ **segredo**
- `MP_REDIRECT_URI` = a mesma URL de cima

### 3.2 Conta da Navalha — pra receber a assinatura das barbearias

Em **Credenciais de produção**:

- **Public Key** → `NEXT_PUBLIC_MP_PUBLIC_KEY`
- **Access Token** → `MP_ACCESS_TOKEN` ⚠️ **segredo**

### 3.3 Webhook — é o que confirma o pagamento

Na aplicação → **Webhooks / Notificações**:

- URL:
  ```
  https://navalha-virid.vercel.app/api/mp/webhook
  ```
- Evento: **Pagamentos** (`payment`)
- Ao salvar, o MP mostra uma **chave secreta** → `MP_WEBHOOK_SECRET` ⚠️ **segredo**

> Sem `MP_WEBHOOK_SECRET` o webhook recusa tudo com 401, de propósito: sem
> conferir a assinatura, qualquer pessoa poderia mandar um "pagamento aprovado"
> falso e conseguir horário de graça.

---

## 4. Variáveis na Vercel

**Settings → Environment Variables**, para *Production*, *Preview* e *Development*:

| Variável | Segredo? | Onde achar |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | não | a URL da Vercel, sem barra no fim |
| `NEXT_PUBLIC_SUPABASE_URL` | não | Supabase → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | não | Supabase → API |
| `SUPABASE_SERVICE_ROLE_KEY` | **sim** | Supabase → API |
| `MP_CLIENT_ID` | não | MP → sua aplicação |
| `MP_CLIENT_SECRET` | **sim** | MP → sua aplicação |
| `MP_REDIRECT_URI` | não | `.../api/mp/callback` |
| `MP_ACCESS_TOKEN` | **sim** | MP → credenciais de produção |
| `NEXT_PUBLIC_MP_PUBLIC_KEY` | não | MP → credenciais de produção |
| `MP_WEBHOOK_SECRET` | **sim** | MP → webhooks |
| `MP_TAXA_PERCENTUAL` | não | `0` se a barbearia recebe tudo |

Depois de salvar, **Deployments → ⋯ → Redeploy** (variável nova só entra em deploy novo).

Pra rodar local: copie `.env.example` para `.env.local` e preencha. O `.env.local`
já está no `.gitignore`.

---

## 5. Conferir se funcionou

1. `/painel/pagamentos` → **Conectar minha conta** → deve abrir a tela do Mercado Pago
2. Autorize → volta pro painel com `?mp=conectado`
3. Agende pela página pública escolhendo pagamento online → deve abrir o Checkout Pro
4. Pague (use uma [conta de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/your-integrations/test/accounts) antes de usar dinheiro real)
5. No Supabase, a linha em `pedidos` deve virar `status_pagamento = 'pago'`, e os
   `agendamentos` do pedido, `confirmado` — isso é o webhook trabalhando

---

## O que ainda falta

O pagamento e a conexão com o Mercado Pago estão prontos, mas **o resto do app
ainda lê e grava no `localStorage`** (`src/lib/mock-db.ts`). Isso significa que:

- o agendamento que o cliente faz no celular dele **não aparece** no painel da
  barbearia — cada navegador tem os próprios dados
- as rotas de API já gravam no Supabase, então hoje as duas fontes convivem sem
  conversar

O próximo passo é migrar as telas de `mock-db.ts` para o Supabase, usando o
esquema que já está em `supabase/schema.sql`. Até lá, dá pra deployar e testar a
conexão do Mercado Pago, mas não pra operar de verdade.

## Segurança

- Se algum segredo vazar (chat, print, commit), **renove na hora** no painel
  correspondente. Renovar invalida o antigo.
- `MP_ACCESS_TOKEN` permite criar e estornar cobranças na sua conta.
- `MP_CLIENT_SECRET` permite se passar pela sua aplicação no OAuth.
- `SUPABASE_SERVICE_ROLE_KEY` dá acesso total ao banco, ignorando as regras.
