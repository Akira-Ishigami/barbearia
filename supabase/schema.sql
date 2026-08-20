-- ============================================================
-- Navalha — esquema do banco (Supabase / Postgres)
--
-- Como rodar: painel do Supabase → SQL Editor → cole tudo → Run.
-- É seguro rodar mais de uma vez (tudo usa IF NOT EXISTS).
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- Barbearias ----------
create table if not exists barbearias (
  id                  uuid primary key default gen_random_uuid(),
  nome                text        not null,
  telefone            text        not null default '',
  endereco            text        not null default '',
  dias_funcionamento  text[]      not null default '{seg,ter,qua,qui,sex}',
  horario_abertura    text        not null default '09:00',
  horario_fechamento  text        not null default '20:00',
  plano               text        not null default 'basico',
  link_maps           text,
  foto                text,
  sobre               text,
  galeria             text[]      not null default '{}',
  criada_em           timestamptz not null default now()
);

-- ---------- Conta Mercado Pago de cada barbearia ----------
-- Fica em tabela separada porque é o dado mais sensível do sistema:
-- assim dá pra revogar o acesso do PostgREST só nela (ver RLS no fim).
create table if not exists mp_contas (
  barbearia_id   uuid primary key references barbearias(id) on delete cascade,
  mp_user_id     text        not null,
  apelido        text        not null default '',
  access_token   text        not null,
  refresh_token  text        not null,
  public_key     text        not null default '',
  ambiente       text        not null default 'producao',
  expira_em      timestamptz not null,
  aceita_pix     boolean     not null default true,
  aceita_cartao  boolean     not null default true,
  parcelas_max   int         not null default 3,
  -- % que a Navalha retém por agendamento (0 = barbearia recebe tudo)
  taxa_percentual numeric(5,2) not null default 0,
  conectado_em   timestamptz not null default now()
);

-- ---------- Usuários (dono e barbeiros) ----------
create table if not exists usuarios (
  id            uuid primary key default gen_random_uuid(),
  barbearia_id  uuid not null references barbearias(id) on delete cascade,
  nome          text not null,
  email         text not null unique,
  role          text not null default 'barbeiro',
  auth_user_id  uuid,
  criado_em     timestamptz not null default now()
);

-- ---------- Barbeiros (perfil público) ----------
create table if not exists barbeiros (
  id             uuid primary key default gen_random_uuid(),
  barbearia_id   uuid not null references barbearias(id) on delete cascade,
  usuario_id     uuid references usuarios(id) on delete set null,
  nome           text not null,
  email          text not null default '',
  especialidade  text not null default '',
  foto           text,
  ativo          boolean not null default true
);

-- ---------- Serviços ----------
create table if not exists servicos (
  id                  uuid primary key default gen_random_uuid(),
  barbearia_id        uuid not null references barbearias(id) on delete cascade,
  nome                text not null,
  categoria           text not null default 'Outros',
  preco               numeric(10,2) not null,
  duracao_min         int not null default 30,
  foto                text,
  ativo               boolean not null default true,
  servicos_incluidos  uuid[] not null default '{}'
);

-- ---------- Produtos ----------
create table if not exists produtos (
  id            uuid primary key default gen_random_uuid(),
  barbearia_id  uuid not null references barbearias(id) on delete cascade,
  nome          text not null,
  categoria     text not null default 'Outros',
  preco         numeric(10,2) not null,
  estoque       int not null default 0,
  foto          text,
  ativo         boolean not null default true
);

-- ---------- Pedidos (uma compra do carrinho) ----------
-- O pedido nasce ANTES de o cliente ir pro Mercado Pago; o webhook
-- depois marca como pago. Sem isso o horário não fica preso enquanto
-- a pessoa está pagando.
create table if not exists pedidos (
  id                uuid primary key default gen_random_uuid(),
  barbearia_id      uuid not null references barbearias(id) on delete cascade,
  cliente_nome      text not null,
  cliente_telefone  text not null default '',
  cliente_email     text not null default '',
  total             numeric(10,2) not null,
  forma_pagamento   text not null default 'local',   -- 'online' | 'local'
  status_pagamento  text not null default 'pendente',-- 'pendente' | 'pago' | 'recusado' | 'expirado'
  mp_preference_id  text,
  mp_payment_id     text,
  metodo_pagamento  text,                            -- 'pix' | 'cartao'
  criado_em         timestamptz not null default now(),
  pago_em           timestamptz
);

create index if not exists pedidos_preference_idx on pedidos (mp_preference_id);
create index if not exists pedidos_barbearia_idx  on pedidos (barbearia_id, criado_em desc);

-- ---------- Agendamentos ----------
create table if not exists agendamentos (
  id             uuid primary key default gen_random_uuid(),
  barbearia_id   uuid not null references barbearias(id) on delete cascade,
  barbeiro_id    uuid not null references barbeiros(id) on delete cascade,
  pedido_id      uuid references pedidos(id) on delete cascade,
  servico_nome   text not null,
  preco          numeric(10,2) not null,
  duracao_min    int not null default 30,
  data           date not null,
  hora           text not null,
  status         text not null default 'pendente',
  criado_em      timestamptz not null default now()
);

-- Um barbeiro não pode ter dois agendamentos vivos no mesmo horário.
-- É esta linha que impede duas pessoas fecharem o mesmo horário ao
-- mesmo tempo — a checagem no app sozinha não segura corrida.
create unique index if not exists agendamentos_slot_unico
  on agendamentos (barbeiro_id, data, hora)
  where status in ('aguardando_pagamento', 'pendente', 'confirmado', 'concluido');

create index if not exists agendamentos_agenda_idx
  on agendamentos (barbearia_id, data);

-- ---------- Produtos vendidos junto ----------
create table if not exists pedido_produtos (
  id           uuid primary key default gen_random_uuid(),
  pedido_id    uuid not null references pedidos(id) on delete cascade,
  produto_id   uuid not null references produtos(id),
  produto_nome text not null,
  quantidade   int not null,
  preco        numeric(10,2) not null
);

-- ---------- Movimentos de estoque ----------
create table if not exists movimentos_estoque (
  id            uuid primary key default gen_random_uuid(),
  barbearia_id  uuid not null references barbearias(id) on delete cascade,
  produto_id    uuid not null references produtos(id) on delete cascade,
  produto_nome  text not null,
  tipo          text not null,        -- 'entrada' | 'saida'
  quantidade    int not null,
  motivo        text not null default '',
  data          timestamptz not null default now()
);

-- ============================================================
-- RLS (Row Level Security)
--
-- Regra de ouro: mp_contas NUNCA pode ser lida pelo navegador.
-- Só o service role (usado nas rotas de API) enxerga essa tabela.
-- ============================================================

alter table mp_contas enable row level security;
-- Nenhuma policy criada de propósito: sem policy, ninguém com a chave
-- anônima lê nem escreve. O service role ignora RLS por definição.

alter table barbearias   enable row level security;
alter table servicos     enable row level security;
alter table produtos     enable row level security;
alter table barbeiros    enable row level security;

-- A página pública precisa ler catálogo e equipe sem login.
drop policy if exists "leitura publica barbearias" on barbearias;
create policy "leitura publica barbearias" on barbearias
  for select using (true);

drop policy if exists "leitura publica servicos" on servicos;
create policy "leitura publica servicos" on servicos
  for select using (ativo = true);

drop policy if exists "leitura publica produtos" on produtos;
create policy "leitura publica produtos" on produtos
  for select using (ativo = true);

drop policy if exists "leitura publica barbeiros" on barbeiros;
create policy "leitura publica barbeiros" on barbeiros
  for select using (ativo = true);

-- Pedidos e agendamentos só passam pelas rotas de API (service role).
alter table pedidos            enable row level security;
alter table agendamentos       enable row level security;
alter table pedido_produtos    enable row level security;
alter table movimentos_estoque enable row level security;
alter table usuarios           enable row level security;
