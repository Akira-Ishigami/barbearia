-- ============================================================
-- Navalha — migração: suporte/admin, comissão e Pix direto
--
-- Como rodar: painel do Supabase → SQL Editor → cole tudo → Run.
-- É seguro rodar mais de uma vez.
--
-- Já está incluído no supabase/schema.sql; este arquivo existe só pra
-- quem já tem o banco montado e quer aplicar só o que mudou.
-- ============================================================

-- ============================================================
-- Equipe da plataforma (Navalha): admin e suporte
--
-- Não é a equipe de uma barbearia — é quem cuida do sistema. Por isso
-- fica fora de `usuarios`, que sempre pertence a uma barbearia.
--
-- A chave é o e-mail, não o auth_user_id: assim dá pra liberar alguém
-- antes de essa pessoa criar a conta. O vínculo com o Supabase Auth é
-- feito na hora de autenticar, comparando o e-mail do token.
-- ============================================================
create table if not exists plataforma_equipe (
  email      text primary key,
  nome       text not null default '',
  -- 'admin'   → vê tudo e mexe em assinatura, plano e equipe
  -- 'suporte' → vê tudo pra ajudar, mas não mexe em dinheiro
  nivel      text not null default 'suporte',
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  ultimo_acesso timestamptz
);

alter table plataforma_equipe enable row level security;
-- Sem policy de propósito: como em mp_contas, só o service role (rotas de
-- API) enxerga. Se o navegador pudesse ler, qualquer um saberia quem é
-- admin — e pior, um dono conseguiria se adicionar.

-- O dono da plataforma. `on conflict` garante que rodar de novo não duplica
-- nem rebaixa o nível.
insert into plataforma_equipe (email, nome, nivel)
values ('akira.vha@gmail.com', 'Akira', 'admin')
on conflict (email) do update set nivel = 'admin', ativo = true;

-- Registro do que o suporte fez. Sem isso não dá pra saber quem estendeu
-- o trial de quem — e acesso de suporte sem trilha é problema esperando.
create table if not exists plataforma_log (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  acao         text not null,
  barbearia_id uuid references barbearias(id) on delete set null,
  detalhe      text not null default '',
  criado_em    timestamptz not null default now()
);
create index if not exists plataforma_log_idx on plataforma_log (criado_em desc);
alter table plataforma_log enable row level security;

-- ============================================================
-- Comissão por barbeiro
--
-- Quase toda barbearia paga o profissional por porcentagem do que ele
-- produziu, e o percentual do serviço costuma ser diferente do percentual
-- do produto vendido (corte 50%, pomada 10%). Por isso são dois campos.
-- ============================================================

-- Percentual sugerido pra quem entrar na equipe daqui pra frente.
alter table barbearias add column if not exists comissao_padrao numeric(5,2) not null default 0;

alter table barbeiros add column if not exists comissao_percentual numeric(5,2) not null default 0;
alter table barbeiros add column if not exists comissao_produtos_percentual numeric(5,2) not null default 0;

-- Fechamentos de comissão: o que já foi pago, pra não pagar duas vezes.
create table if not exists comissao_fechamentos (
  id            uuid primary key default gen_random_uuid(),
  barbearia_id  uuid not null references barbearias(id) on delete cascade,
  barbeiro_id   uuid not null references barbeiros(id) on delete cascade,
  periodo_de    date not null,
  periodo_ate   date not null,
  base_servicos numeric(10,2) not null default 0,
  base_produtos numeric(10,2) not null default 0,
  valor         numeric(10,2) not null,
  observacao    text not null default '',
  pago_em       timestamptz not null default now(),
  criado_por    uuid references usuarios(id) on delete set null
);

create index if not exists comissao_fechamentos_idx
  on comissao_fechamentos (barbearia_id, periodo_de desc);

-- Um mesmo período não pode ser fechado duas vezes pro mesmo barbeiro.
create unique index if not exists comissao_fechamento_unico
  on comissao_fechamentos (barbeiro_id, periodo_de, periodo_ate);

alter table comissao_fechamentos enable row level security;

drop policy if exists "equipe usa comissao_fechamentos" on comissao_fechamentos;
create policy "equipe usa comissao_fechamentos" on comissao_fechamentos
  for all
  using (barbearia_id = public.minha_barbearia())
  with check (barbearia_id = public.minha_barbearia());

-- ============================================================
-- Pix direto (barbearia que não usa Mercado Pago)
--
-- Mesma regra do mp_contas: fica em tabela própria e SEM policy, porque a
-- chave costuma ser CPF ou telefone do dono. `barbearias` tem leitura
-- pública — se a chave morasse lá, o CPF dele estaria aberto na internet.
-- O navegador só recebe o código Pix já montado, nunca a chave crua.
-- ============================================================
create table if not exists pix_contas (
  barbearia_id  uuid primary key references barbearias(id) on delete cascade,
  tipo          text not null,                    -- cpf|cnpj|email|telefone|aleatoria
  chave         text not null,
  -- Nome e cidade entram no código Pix e aparecem no app do banco de quem
  -- paga. O padrão do Banco Central limita a 25 e 15 caracteres.
  beneficiario  text not null,
  cidade        text not null default 'SAO PAULO',
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);

alter table pix_contas enable row level security;
-- Sem policy: só o service role.

-- Pix direto não tem webhook — quem confirma que o dinheiro caiu é o dono,
-- olhando o extrato. Estes campos guardam esse aceite manual.
alter table pedidos add column if not exists pix_txid text;
alter table pedidos add column if not exists confirmado_por uuid references usuarios(id) on delete set null;
create index if not exists pedidos_txid_idx on pedidos (pix_txid);
