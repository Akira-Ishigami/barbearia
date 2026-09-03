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
  -- Endereço legível da página pública: /loja/barbearia-do-ze em vez do uuid.
  -- Único porque é o que identifica a barbearia na URL.
  slug                text        unique,
  link_maps           text,
  foto                text,
  sobre               text,
  galeria             text[]      not null default '{}',
  -- Assinatura do sistema (a barbearia paga a Navalha).
  --   'trial'   → no mês grátis
  --   'ativa'   → pagou, em dia
  --   'vencida' → trial acabou ou pagamento não veio
  assinatura_status   text        not null default 'trial',
  trial_termina_em    timestamptz not null default (now() + interval '30 days'),
  assinatura_ate      timestamptz,          -- até quando está pago
  criada_em           timestamptz not null default now()
);

-- Para bancos já criados antes destes campos (roda sem erro se já existirem):
alter table barbearias add column if not exists assinatura_status text not null default 'trial';
alter table barbearias add column if not exists trial_termina_em timestamptz not null default (now() + interval '30 days');
-- O teste era de 7 dias e passou a ser de um mês; bancos criados antes
-- disso guardam o default antigo na coluna, então ele é trocado aqui.
alter table barbearias alter column trial_termina_em set default (now() + interval '30 days');
alter table barbearias add column if not exists assinatura_ate timestamptz;

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

-- ---------- Clientes ----------
-- Quem agenda. Diferente de `usuarios`, que é a equipe da barbearia: o
-- cliente não pertence a nenhuma barbearia, ele circula entre várias.
-- Continua dando pra agendar sem conta — a conta só guarda o histórico.
create table if not exists clientes (
  id            uuid primary key default gen_random_uuid(),
  auth_user_id  uuid unique,
  nome          text not null,
  email         text not null unique,
  telefone      text not null default '',
  criado_em     timestamptz not null default now()
);

create index if not exists clientes_telefone_idx on clientes (telefone);

-- ---------- Pedidos (uma compra do carrinho) ----------
-- O pedido nasce ANTES de o cliente ir pro Mercado Pago; o webhook
-- depois marca como pago. Sem isso o horário não fica preso enquanto
-- a pessoa está pagando.
create table if not exists pedidos (
  id                uuid primary key default gen_random_uuid(),
  barbearia_id      uuid not null references barbearias(id) on delete cascade,
  -- Preenchido quando a pessoa agendou logada; nulo em compra de visitante.
  cliente_id        uuid references clientes(id) on delete set null,
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

-- Coluna adicionada depois: bancos criados antes disso não a têm.
alter table barbearias add column if not exists slug text;
-- Horário por dia da semana. Antes a barbearia tinha um horário só pra
-- todos os dias, o que não fecha com a realidade: sábado quase sempre abre
-- e fecha em horário diferente. Fica como JSON pra não criar sete colunas —
-- e continua nulo pra quem usa o mesmo horário todo dia, caindo no
-- horario_abertura/fechamento de sempre.
--
-- Formato: {"seg": {"abre": "09:00", "fecha": "19:00"}, ...}
alter table barbearias add column if not exists horarios_dia jsonb;

-- O CEP era só estado da tela: preenchia, virava endereço e sumia no
-- reload. Guardar ele deixa o campo voltar preenchido na próxima edição,
-- em vez de o dono ter que digitar de novo pra mexer no número.
alter table barbearias add column if not exists cep text;

alter table pedidos add column if not exists cliente_id uuid references clientes(id) on delete set null;
create index if not exists pedidos_cliente_idx on pedidos (cliente_id, criado_em desc);
create unique index if not exists barbearias_slug_unico on barbearias (slug) where slug is not null;

-- Produto comprado no carrinho (pedido_produtos) nunca baixava o estoque —
-- só entrada/saída manual em Estoque mexia em produtos.estoque. A baixa
-- acontece quando o pedido vira de verdade (agendamento confirmado —
-- local, Pix direto — ou pagamento aprovado no Mercado Pago), nunca no
-- momento do agendamento em si. Essa flag marca se já baixou, pra
-- confirmar duas vezes (ou o webhook do MP repetir a notificação) não
-- descontar o mesmo produto duas vezes.
alter table pedidos add column if not exists estoque_baixado boolean not null default false;

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
alter table clientes           enable row level security;

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

-- Id do cliente logado. Mesma ideia de minha_barbearia(), mas pra quem
-- agenda: `security definer` evita a recursão de ler `clientes` dentro da
-- própria policy de `clientes`.
create or replace function public.meu_cliente()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from clientes where auth_user_id = auth.uid() limit 1
$$;

-- O cliente enxerga e edita só o próprio cadastro.
drop policy if exists "cliente le a si mesmo" on clientes;
create policy "cliente le a si mesmo" on clientes
  for select using (auth_user_id = auth.uid());

drop policy if exists "cliente edita a si mesmo" on clientes;
create policy "cliente edita a si mesmo" on clientes
  for update using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- A equipe da barbearia lê o cadastro de quem já comprou nela — é o que
-- permite reconhecer o cliente na agenda sem expor a base inteira.
drop policy if exists "barbearia le clientes que compraram" on clientes;
create policy "barbearia le clientes que compraram" on clientes
  for select using (
    exists (
      select 1 from pedidos p
      where p.cliente_id = clientes.id
        and p.barbearia_id = public.minha_barbearia()
    )
  );

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

-- RLS é por LINHA, não por coluna: a política antiga liberava a leitura
-- pública da linha inteira de `barbeiros`, incluindo `email` (login da
-- equipe) e `comissao_percentual` (quanto cada um ganha) — qualquer
-- pessoa, sem login nenhum, conseguia ler os dois direto pela API REST.
-- Testado direto contra o banco: `curl` com a anon key devolvia e-mail e
-- comissão de todo mundo. A vitrine pública nunca usou esses dois campos;
-- só nome, foto e especialidade. Por isso a leitura pública passa a ser só
-- pela view abaixo, com as colunas já filtradas — a tabela em si fica só
-- pra quem é da equipe (política "equipe le barbeiros", que já existe).
drop policy if exists "leitura publica barbeiros" on barbeiros;

drop view if exists public.barbeiros_publico;
create view public.barbeiros_publico
with (security_invoker = false) as
  select id, barbearia_id, nome, especialidade, foto, ativo
    from barbeiros
   where ativo = true;

grant select on public.barbeiros_publico to anon, authenticated;

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

-- ---------- Cliente vê o próprio histórico ----------
-- Só leitura: criar e alterar pedido continua passando pelas rotas de API,
-- que validam preço e horário.
drop policy if exists "cliente le seus pedidos" on pedidos;
create policy "cliente le seus pedidos" on pedidos
  for select using (cliente_id is not null and cliente_id = public.meu_cliente());

drop policy if exists "cliente le seus agendamentos" on agendamentos;
create policy "cliente le seus agendamentos" on agendamentos
  for select using (
    exists (
      select 1 from pedidos p
      where p.id = agendamentos.pedido_id
        and p.cliente_id is not null
        and p.cliente_id = public.meu_cliente()
    )
  );

drop policy if exists "cliente le itens dos seus pedidos" on pedido_produtos;
create policy "cliente le itens dos seus pedidos" on pedido_produtos
  for select using (
    exists (
      select 1 from pedidos p
      where p.id = pedido_produtos.pedido_id
        and p.cliente_id is not null
        and p.cliente_id = public.meu_cliente()
    )
  );

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

-- ---------- Baixa de estoque dos produtos comprados no carrinho ----------
-- Produto adicionado no carrinho da loja vira uma linha em pedido_produtos,
-- mas isso nunca tocou produtos.estoque — o número mostrado em Estoque
-- nunca refletia o que o cliente realmente levou. A baixa acontece só
-- quando o pedido vira de verdade (agendamento confirmado — local ou Pix
-- direto —, ou pagamento aprovado no Mercado Pago), nunca no momento do
-- agendamento — senão cancelar um "pendente" já teria descontado um
-- produto que ninguém levou.
--
-- Função interna (sem checagem de dono própria): só é chamada de dentro de
-- confirmar_agendamento() e baixar_estoque_pedido_pago(), que já validaram
-- a barbearia antes de chegar aqui — nunca exposta direto por RPC.
create or replace function public._baixar_estoque_pedido(p_pedido uuid, p_barbearia uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- `estoque_baixado` como trava: se já baixou (ou não existe o pedido),
  -- não faz nada — evita descontar duas vezes se o webhook do MP repetir a
  -- notificação, ou se o dono clicar em confirmar duas vezes.
  update pedidos
     set estoque_baixado = true
   where id = p_pedido and barbearia_id = p_barbearia and not estoque_baixado;

  if not found then
    return;
  end if;

  -- `greatest(0, ...)` em vez de travar a confirmação: o estoque já foi
  -- checado na hora da compra (validarProdutos), e a essa altura o pedido
  -- já existe — melhor deixar o número não ficar negativo do que impedir
  -- o dono de confirmar um cliente que já está na cadeira.
  update produtos p
     set estoque = greatest(0, p.estoque - pp.quantidade)
    from pedido_produtos pp
   where pp.pedido_id = p_pedido
     and p.id = pp.produto_id
     and p.barbearia_id = p_barbearia;

  insert into movimentos_estoque (barbearia_id, produto_id, produto_nome, tipo, quantidade, motivo)
  select p_barbearia, pp.produto_id, pp.produto_nome, 'saida', pp.quantidade, 'Venda — pedido no carrinho'
    from pedido_produtos pp
   where pp.pedido_id = p_pedido;
end $$;

revoke all on function public._baixar_estoque_pedido(uuid, uuid) from public, anon, authenticated;

-- Confirma um agendamento "pendente" (pagamento no local ou Pix direto) e,
-- se for a primeira confirmação do pedido, já baixa o estoque dos
-- produtos comprados junto. Chamada pelo dono/barbeiro logado — por isso
-- confere a barbearia do próprio usuário, igual ao movimentar_estoque()
-- acima.
create or replace function public.confirmar_agendamento(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barbearia uuid;
  v_pedido uuid;
begin
  select barbearia_id, pedido_id into v_barbearia, v_pedido
    from agendamentos where id = p_id and status = 'pendente';

  -- Já confirmado, cancelado, ou não existe: nada a fazer — silencioso, pra
  -- clicar duas vezes rápido não virar erro na tela.
  if v_barbearia is null then
    return;
  end if;
  if v_barbearia is distinct from public.minha_barbearia() then
    raise exception 'Sem permissão pra mexer nessa agenda.';
  end if;

  update agendamentos set status = 'confirmado' where id = p_id;

  if v_pedido is not null then
    perform public._baixar_estoque_pedido(v_pedido, v_barbearia);
  end if;
end $$;

-- Contraparte pro webhook do Mercado Pago: já roda com service_role (sem
-- sessão de usuário, então minha_barbearia() não tem o que responder) — o
-- servidor já validou que o pedido é dessa barbearia antes de chamar isto.
-- Por isso fica restrita ao service_role, nunca exposta pro navegador.
create or replace function public.baixar_estoque_pedido_pago(p_pedido uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barbearia uuid;
begin
  select barbearia_id into v_barbearia from pedidos where id = p_pedido;
  if v_barbearia is null then
    return;
  end if;
  perform public._baixar_estoque_pedido(p_pedido, v_barbearia);
end $$;

revoke all on function public.baixar_estoque_pedido_pago(uuid) from public, anon, authenticated;
grant execute on function public.baixar_estoque_pedido_pago(uuid) to service_role;

-- ============================================================
-- Assinatura: trial de 7 dias, depois cobra
-- ============================================================

-- Barbearia tem acesso liberado? (trial em dia OU assinatura paga em dia)
create or replace function public.assinatura_ativa(p_barbearia uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when b.assinatura_status = 'ativa' and (b.assinatura_ate is null or b.assinatura_ate > now())
      then true
    when b.assinatura_status = 'trial' and b.trial_termina_em > now()
      then true
    else false
  end
  from barbearias b
  where b.id = p_barbearia
$$;

-- Marca a assinatura como paga por +30 dias. Chamada só pelo service role
-- (webhook), então não checa RLS — o id vem do external_reference validado.
-- Chamada pelo webhook quando o pagamento da mensalidade é aprovado.
--
-- `p_plano` vem junto porque a troca de plano é paga: o dono escolhe o Pro,
-- paga, e só aqui — com o dinheiro confirmado — a barbearia passa a ser Pro.
-- Sem esse parâmetro dava pra virar Pro só clicando num botão.
create or replace function public.marcar_assinatura_paga(
  p_barbearia uuid,
  p_plano text default null
)
returns void
language sql
security definer
set search_path = public
as $$
  update barbearias
     set assinatura_status = 'ativa',
         assinatura_ate = greatest(coalesce(assinatura_ate, now()), now()) + interval '30 days',
         plano = case when p_plano in ('basico','pro') then p_plano else plano end
   where id = p_barbearia
$$;

-- O comentário acima sempre disse "chamada só pelo service role", mas
-- nenhum REVOKE nunca foi de fato executado — toda função nova no Postgres
-- nasce com EXECUTE liberado pra PUBLIC, e no Supabase isso cai direto pra
-- anon e authenticated. Sem esta linha, QUALQUER pessoa logada (dono de
-- outra barbearia, ou até um cliente) conseguia chamar
-- `supabase.rpc('marcar_assinatura_paga', {p_barbearia: '<qualquer id>', p_plano: 'pro'})`
-- direto pelo navegador e virar Pro de graça — a mesma falha do upgrade
-- grátis já corrigida na rota /api/plano, só que reaberta por uma porta
-- que ninguém tinha trancado.
revoke all on function public.marcar_assinatura_paga(uuid, text) from public, anon, authenticated;
grant execute on function public.marcar_assinatura_paga(uuid, text) to service_role;

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
-- produziu. O percentual incide só sobre o serviço prestado.
-- ============================================================

-- Percentual sugerido pra quem entrar na equipe daqui pra frente.
alter table barbearias add column if not exists comissao_padrao numeric(5,2) not null default 0;

alter table barbeiros add column if not exists comissao_percentual numeric(5,2) not null default 0;
-- Comissão só sobre serviço. Produto vendido no balcão é da barbearia:
-- o barbeiro não compra o estoque nem assume o encalhe, então a margem
-- não é dele. A coluna chegou a existir e sai aqui.
alter table barbeiros drop column if exists comissao_produtos_percentual;

-- Fechamentos de comissão: o que já foi pago, pra não pagar duas vezes.
create table if not exists comissao_fechamentos (
  id            uuid primary key default gen_random_uuid(),
  barbearia_id  uuid not null references barbearias(id) on delete cascade,
  barbeiro_id   uuid not null references barbeiros(id) on delete cascade,
  periodo_de    date not null,
  periodo_ate   date not null,
  base_servicos numeric(10,2) not null default 0,
  base_produtos numeric(10,2) not null default 0,   -- histórico; hoje sempre 0
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

-- ============================================================
-- Correção pontual: pedidos antigos que nunca baixaram estoque
-- ============================================================
-- Roda uma vez (e é seguro rodar de novo: _baixar_estoque_pedido() marca
-- estoque_baixado e para de mexer no que já processou). Sem isso, o dia em
-- que este arquivo for aplicado o estoque continuaria com a contagem
-- errada de tudo que já foi vendido antes da correção — só pedidos novos
-- ficariam certos, e o dono não teria como saber que os antigos ficaram
-- pra trás.
do $$
declare
  r record;
begin
  for r in
    select p.id, p.barbearia_id
      from pedidos p
     where not p.estoque_baixado
       and exists (select 1 from pedido_produtos pp where pp.pedido_id = p.id)
       and exists (
         select 1 from agendamentos a
          where a.pedido_id = p.id and a.status in ('confirmado', 'concluido')
       )
  loop
    perform public._baixar_estoque_pedido(r.id, r.barbearia_id);
  end loop;
end $$;

-- ============================================================
-- Conta do Mercado Pago da própria Navalha, via OAuth
-- ============================================================
-- O saldo (Carteira, em /adm) não abre com MP_ACCESS_TOKEN nessa conta —
-- o Mercado Pago devolve 403, provavelmente por ela ainda ter cadastro
-- pendente (endereço). Token de OAuth, autorizado por login de verdade,
-- costuma ter permissão que token de app sozinho não tem — vale tentar.
--
-- Linha única (id fixo), diferente de mp_contas que é uma por barbearia:
-- só existe uma Navalha. Mesma regra de mp_contas e plataforma_equipe:
-- sem policy de RLS, só o service role (rotas de API) enxerga.
create table if not exists plataforma_mp_conta (
  id             text primary key default 'navalha',
  mp_user_id     text not null,
  apelido        text not null default '',
  access_token   text not null,
  refresh_token  text not null,
  expira_em      timestamptz not null,
  conectado_em   timestamptz not null default now()
);

alter table plataforma_mp_conta enable row level security;
