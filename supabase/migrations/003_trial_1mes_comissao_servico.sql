-- ============================================================
-- Navalha — migração: teste de 1 mês e comissão só sobre serviço
--
-- Como rodar: painel do Supabase → SQL Editor → cole tudo → Run.
-- É seguro rodar mais de uma vez.
-- ============================================================

-- ---------- Teste grátis de 30 dias, nos dois planos ----------
-- Sete dias não davam pra barbearia cadastrar serviço, montar equipe e ver
-- o sistema rodando num ciclo real de agenda. O default da coluna precisa
-- ser trocado à parte: `add column if not exists` não mexe em coluna que
-- já existe, então bancos antigos continuariam criando trial de 7 dias.
alter table barbearias
  alter column trial_termina_em set default (now() + interval '30 days');

-- Quem está em teste agora entrou sob a regra de 7 dias. Estende pra 30
-- contados da criação, sem encurtar nada de quem o suporte já ajudou.
update barbearias
   set trial_termina_em = greatest(trial_termina_em, criada_em + interval '30 days')
 where assinatura_status = 'trial';

-- ---------- Comissão só sobre serviço ----------
-- Produto vendido no balcão é da barbearia: o barbeiro não compra o
-- estoque nem assume o encalhe, então a margem não é dele.
alter table barbeiros drop column if exists comissao_produtos_percentual;

-- `comissao_fechamentos.base_produtos` fica onde está, com 0. Apagar a
-- coluna zeraria o histórico de quem já fechou um período com ela.
