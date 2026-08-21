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

alter table mp_contas          enable row level security;
alter table barbearias         enable row level security;
alter table servicos           enable row level security;
alter table produtos           enable row level security;
alter table barbeiros          enable row level security;
alter table pedidos            enable row level security;
alter table agendamentos       enable row level security;
alter table pedido_produtos    enable row level security;
alter table movimentos_estoque enable row level security;
alter table usuarios           enable row level security;

-- mp_contas fica sem nenhuma policy de propósito: sem policy, quem usa a
-- chave anônima não lê nem escreve. Só o service role (rotas de API) entra.

-- ---------- Quem sou eu ----------
-- Devolve a barbearia do usuário logado. `security definer` faz a função
-- rodar com os poderes do dono do banco, senão a leitura de `usuarios`
-- dentro da própria policy de `usuarios` daria recursão infinita.
create or replace function public.minha_barbearia()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select barbearia_id from usuarios where auth_user_id = auth.uid() limit 1
$$;

create or replace function public.meu_papel()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from usuarios where auth_user_id = auth.uid() limit 1
$$;

-- ---------- Leitura pública (página da barbearia, sem login) ----------
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

-- A página pública precisa saber quais horários já estão tomados, mas não
-- pode ver o nome nem o telefone de quem marcou. Por isso a leitura sai por
-- esta função, e não por policy de select na tabela.
create or replace function public.horarios_ocupados(p_barbearia uuid, p_data date)
returns table (barbeiro_id uuid, hora text, duracao_min int)
language sql
stable
security definer
set search_path = public
as $$
  select a.barbeiro_id, a.hora, a.duracao_min
  from agendamentos a
  where a.barbearia_id = p_barbearia
    and a.data = p_data
    and a.status in ('aguardando_pagamento','pendente','confirmado','concluido')
$$;

-- ---------- Dono e barbeiro: só a própria barbearia ----------
drop policy if exists "equipe le a barbearia" on barbearias;
create policy "equipe le a barbearia" on barbearias
  for select using (id = public.minha_barbearia());

drop policy if exists "dono edita a barbearia" on barbearias;
create policy "dono edita a barbearia" on barbearias
  for update using (id = public.minha_barbearia() and public.meu_papel() = 'dono')
  with check (id = public.minha_barbearia());

drop policy if exists "equipe le usuarios" on usuarios;
create policy "equipe le usuarios" on usuarios
  for select using (barbearia_id = public.minha_barbearia());

-- Catálogo e equipe: o dono gerencia, o barbeiro só lê.
do $$
declare t text;
begin
  foreach t in array array['servicos','produtos','barbeiros'] loop
    execute format('drop policy if exists "equipe le %1$s" on %1$s', t);
    execute format(
      'create policy "equipe le %1$s" on %1$s for select using (barbearia_id = public.minha_barbearia())', t);

    execute format('drop policy if exists "dono gerencia %1$s" on %1$s', t);
    execute format(
      'create policy "dono gerencia %1$s" on %1$s for all
         using (barbearia_id = public.minha_barbearia() and public.meu_papel() = ''dono'')
         with check (barbearia_id = public.minha_barbearia())', t);
  end loop;
end $$;

-- Agenda, pedidos e estoque: quem é da barbearia enxerga e mexe.
do $$
declare t text;
begin
  foreach t in array array['agendamentos','pedidos','movimentos_estoque'] loop
    execute format('drop policy if exists "equipe usa %1$s" on %1$s', t);
    execute format(
      'create policy "equipe usa %1$s" on %1$s for all
         using (barbearia_id = public.minha_barbearia())
         with check (barbearia_id = public.minha_barbearia())', t);
  end loop;
end $$;

drop policy if exists "equipe le itens do pedido" on pedido_produtos;
create policy "equipe le itens do pedido" on pedido_produtos
  for select using (
    exists (
      select 1 from pedidos p
      where p.id = pedido_produtos.pedido_id
        and p.barbearia_id = public.minha_barbearia()
    )
  );

-- ---------- Baixa de estoque em uma tacada ----------
-- Evita ler-somar-gravar do lado do app, que perde venda quando dois
-- atendimentos são fechados ao mesmo tempo.
--
-- `security definer` roda com privilégio elevado e ignora RLS das tabelas
-- que toca — por isso a função PRECISA checar sozinha que quem está
-- chamando é da própria barbearia. Sem o `if p_barbearia <> minha_barbearia()`
-- abaixo, qualquer dono/barbeiro autenticado (de QUALQUER barbearia)
-- conseguiria zerar o estoque de um concorrente só sabendo o id dele.
create or replace function public.movimentar_estoque(
  p_barbearia uuid,
  p_produto uuid,
  p_tipo text,
  p_quantidade int,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delta int := case when p_tipo = 'entrada' then p_quantidade else -p_quantidade end;
  v_nome text;
  v_novo int;
begin
  if p_barbearia is distinct from public.minha_barbearia() then
    raise exception 'Sem permissão pra mexer no estoque dessa barbearia.';
  end if;

  update produtos
     set estoque = estoque + v_delta
   where id = p_produto and barbearia_id = p_barbearia
   returning nome, estoque into v_nome, v_novo;

  if v_nome is null then
    raise exception 'Produto não encontrado.';
  end if;
  if v_novo < 0 then
    raise exception 'Estoque insuficiente pra essa saída.';
  end if;

  insert into movimentos_estoque (barbearia_id, produto_id, produto_nome, tipo, quantidade, motivo)
  values (p_barbearia, p_produto, v_nome, p_tipo, p_quantidade, p_motivo);
end $$;
