-- Fase 2: pedidos, notas fiscais e expedição.
-- Regras principais:
--  * um item só entra num pedido da mesma empresa e só se algum CNAE da empresa
--    libera aquela operação (serviço ou produto);
--  * faturar um pedido gera uma nota por tipo (NFS-e para serviço, NF-e/NFC-e
--    para produto), nunca duplicada, e abre a expedição quando há produto;
--  * notas só são gravadas pelo servidor (função faturar_pedido e o emissor),
--    nunca diretamente pelo navegador.

create type public.status_pedido as enum ('rascunho', 'confirmado', 'faturado', 'cancelado');
create type public.tipo_nota as enum ('nfse', 'nfe', 'nfce');
create type public.status_nota as enum ('pendente', 'processando', 'autorizada', 'rejeitada', 'cancelada');
create type public.status_expedicao as enum ('a_separar', 'separado', 'enviado', 'entregue');

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  numero bigint generated always as identity,
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  cliente_id uuid references public.clientes (id) on delete set null,
  status public.status_pedido not null default 'rascunho',
  consumidor_final boolean not null default false,
  total_centavos bigint not null default 0,
  observacoes text,
  criado_por uuid references public.perfis (id) on delete set null default auth.uid(),
  criado_em timestamptz not null default now(),
  faturado_em timestamptz
);
create index on public.pedidos (empresa_id, status);
create index on public.pedidos (cliente_id);

create table public.pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  item_id uuid not null references public.itens_catalogo (id) on delete restrict,
  tipo public.tipo_item not null,
  descricao text not null,
  quantidade numeric(12, 3) not null check (quantidade > 0),
  preco_unit_centavos bigint not null check (preco_unit_centavos >= 0),
  total_centavos bigint generated always as (round(quantidade * preco_unit_centavos)::bigint) stored
);
create index on public.pedido_itens (pedido_id);
create index on public.pedido_itens (empresa_id);
create index on public.pedido_itens (item_id);

create table public.notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  pedido_id uuid not null references public.pedidos (id) on delete restrict,
  tipo public.tipo_nota not null,
  status public.status_nota not null default 'pendente',
  ambiente text not null default 'homologacao' check (ambiente in ('homologacao', 'producao')),
  valor_centavos bigint not null default 0,
  numero text,
  chave_acesso text,
  provedor_ref text,
  motivo text,
  xml_url text,
  pdf_url text,
  tentativas int not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- uma nota por tipo por pedido: refaturar nunca duplica
  unique (pedido_id, tipo)
);
create index on public.notas_fiscais (empresa_id, status);

create table public.expedicoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete restrict,
  pedido_id uuid not null unique references public.pedidos (id) on delete cascade,
  status public.status_expedicao not null default 'a_separar',
  transportadora text,
  codigo_rastreio text,
  atualizado_em timestamptz not null default now()
);
create index on public.expedicoes (empresa_id, status);

-- ---------------------------------------------------------------------------
-- Travas dos itens do pedido
-- ---------------------------------------------------------------------------
create function privado.validar_item_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
  i record;
begin
  select empresa_id, status into p from public.pedidos where id = new.pedido_id;
  if p is null then
    raise exception 'Pedido não encontrado.';
  end if;
  if p.status <> 'rascunho' then
    raise exception 'Só é possível alterar itens de pedidos em rascunho.';
  end if;

  select empresa_id, tipo, nome, preco_centavos, ativo into i from public.itens_catalogo where id = new.item_id;
  if i is null or i.empresa_id <> p.empresa_id then
    raise exception 'O item não pertence à empresa do pedido.';
  end if;
  if not i.ativo then
    raise exception 'O item "%" está inativo.', i.nome;
  end if;
  if not exists (
    select 1 from public.empresa_cnaes c
    where c.empresa_id = p.empresa_id
      and (c.operacao = 'ambos' or c.operacao::text = i.tipo::text)
  ) then
    raise exception 'Nenhum CNAE da empresa permite vender %.', case i.tipo when 'servico' then 'serviço' else 'produto' end;
  end if;

  new.empresa_id := p.empresa_id;
  new.tipo := i.tipo;
  new.descricao := coalesce(nullif(new.descricao, ''), i.nome);
  new.preco_unit_centavos := coalesce(new.preco_unit_centavos, i.preco_centavos);
  return new;
end;
$$;

create trigger validar_item_pedido
before insert or update on public.pedido_itens
for each row execute function privado.validar_item_pedido();

create function privado.bloquear_remocao_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.pedidos where id = old.pedido_id and status <> 'rascunho') then
    raise exception 'Só é possível remover itens de pedidos em rascunho.';
  end if;
  return old;
end;
$$;

create trigger bloquear_remocao_item
before delete on public.pedido_itens
for each row execute function privado.bloquear_remocao_item();

-- Mantém o total do pedido.
create function privado.atualizar_total_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  alvo uuid := coalesce(new.pedido_id, old.pedido_id);
begin
  update public.pedidos
  set total_centavos = (select coalesce(sum(total_centavos), 0) from public.pedido_itens where pedido_id = alvo)
  where id = alvo;
  return null;
end;
$$;

create trigger atualizar_total_pedido
after insert or update or delete on public.pedido_itens
for each row execute function privado.atualizar_total_pedido();

-- Pedido faturado ou cancelado não volta para rascunho pelo navegador,
-- e só a função faturar_pedido marca como faturado.
create function privado.proteger_pedido()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status in ('faturado', 'cancelado') and new.status is distinct from old.status then
    raise exception 'Pedido % já está %.', old.numero, old.status;
  end if;
  if new.status = 'faturado' and old.status <> 'faturado'
     and coalesce(current_setting('crm.faturando', true), '') <> 'sim' then
    raise exception 'Use "Faturar" para faturar o pedido.';
  end if;
  if new.empresa_id <> old.empresa_id then
    raise exception 'Não é possível trocar a empresa de um pedido.';
  end if;
  return new;
end;
$$;

create trigger proteger_pedido
before update on public.pedidos
for each row execute function privado.proteger_pedido();

-- ---------------------------------------------------------------------------
-- Faturamento
-- ---------------------------------------------------------------------------
create function public.faturar_pedido(alvo uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  p record;
  amb text;
  notas int := 0;
  linhas int;
begin
  select * into p from public.pedidos where id = alvo for update;
  if p is null or not privado.tem_acesso(p.empresa_id, array['gestor', 'vendas', 'financeiro']::public.papel_empresa[]) then
    raise exception 'Pedido não encontrado.';
  end if;
  if p.status = 'faturado' then
    return 0;
  end if;
  if p.status = 'cancelado' then
    raise exception 'Pedido cancelado não pode ser faturado.';
  end if;
  if not exists (select 1 from public.pedido_itens where pedido_id = alvo) then
    raise exception 'O pedido não tem itens.';
  end if;

  select coalesce(f.ambiente, 'homologacao') into amb
  from public.empresas e left join public.empresa_fiscal f on f.empresa_id = e.id
  where e.id = p.empresa_id;

  insert into public.notas_fiscais (empresa_id, pedido_id, tipo, ambiente, valor_centavos)
  select p.empresa_id, alvo,
         case when i.tipo = 'servico' then 'nfse'::public.tipo_nota
              when p.consumidor_final then 'nfce'::public.tipo_nota
              else 'nfe'::public.tipo_nota end,
         amb,
         sum(i.total_centavos)
  from public.pedido_itens i
  where i.pedido_id = alvo
  group by 3
  on conflict (pedido_id, tipo) do nothing;
  get diagnostics notas = row_count;

  if exists (select 1 from public.pedido_itens where pedido_id = alvo and tipo = 'produto') then
    insert into public.expedicoes (empresa_id, pedido_id) values (p.empresa_id, alvo)
    on conflict (pedido_id) do nothing;
  end if;

  perform set_config('crm.faturando', 'sim', true);
  update public.pedidos set status = 'faturado', faturado_em = now() where id = alvo;
  perform set_config('crm.faturando', '', true);

  return notas;
end;
$$;

revoke execute on function public.faturar_pedido(uuid) from public, anon;
grant execute on function public.faturar_pedido(uuid) to authenticated;

revoke execute on function privado.validar_item_pedido() from public, anon, authenticated;
revoke execute on function privado.bloquear_remocao_item() from public, anon, authenticated;
revoke execute on function privado.atualizar_total_pedido() from public, anon, authenticated;
revoke execute on function privado.proteger_pedido() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.pedidos enable row level security;
alter table public.pedido_itens enable row level security;
alter table public.notas_fiscais enable row level security;
alter table public.expedicoes enable row level security;

create policy pedidos_ler on public.pedidos for select to authenticated
  using ((select privado.tem_acesso(empresa_id, array['gestor', 'vendas', 'financeiro', 'expedicao']::public.papel_empresa[])));
create policy pedidos_criar on public.pedidos for insert to authenticated
  with check (status = 'rascunho' and (select privado.tem_acesso(empresa_id, array['gestor', 'vendas']::public.papel_empresa[])));
create policy pedidos_alterar on public.pedidos for update to authenticated
  using ((select privado.tem_acesso(empresa_id, array['gestor', 'vendas']::public.papel_empresa[])))
  with check ((select privado.tem_acesso(empresa_id, array['gestor', 'vendas']::public.papel_empresa[])));

create policy itens_ler on public.pedido_itens for select to authenticated
  using ((select privado.tem_acesso(empresa_id, array['gestor', 'vendas', 'financeiro', 'expedicao']::public.papel_empresa[])));
create policy itens_escrever on public.pedido_itens for all to authenticated
  using ((select privado.tem_acesso(empresa_id, array['gestor', 'vendas']::public.papel_empresa[])))
  with check ((select privado.tem_acesso(empresa_id, array['gestor', 'vendas']::public.papel_empresa[])));

-- Notas: leitura para quem acompanha; escrita só pelo servidor.
create policy notas_ler on public.notas_fiscais for select to authenticated
  using ((select privado.tem_acesso(empresa_id, array['gestor', 'vendas', 'financeiro']::public.papel_empresa[])));

create policy expedicoes_ler on public.expedicoes for select to authenticated
  using ((select privado.tem_acesso(empresa_id, array['gestor', 'vendas', 'expedicao']::public.papel_empresa[])));
create policy expedicoes_alterar on public.expedicoes for update to authenticated
  using ((select privado.tem_acesso(empresa_id, array['gestor', 'expedicao']::public.papel_empresa[])))
  with check ((select privado.tem_acesso(empresa_id, array['gestor', 'expedicao']::public.papel_empresa[])));

-- ---------------------------------------------------------------------------
-- Painel: novas colunas no resumo
-- ---------------------------------------------------------------------------
create or replace view public.resumo_empresas
with (security_invoker = true) as
select
  e.id,
  e.nome_fantasia,
  e.cnpj,
  e.regime,
  (select count(*) from public.clientes c where c.empresa_id = e.id) as clientes,
  (select count(*) from public.oportunidades o where o.empresa_id = e.id and o.etapa not in ('ganho', 'perdido')) as oportunidades_abertas,
  (select coalesce(sum(o.valor_centavos), 0) from public.oportunidades o where o.empresa_id = e.id and o.etapa not in ('ganho', 'perdido')) as funil_centavos,
  (select count(*) from public.homologacoes h where h.empresa_id = e.id and h.validade is not null and h.validade <= current_date + 30 and h.status <> 'cancelada') as homologacoes_a_vencer,
  (select coalesce(sum(p.total_centavos), 0) from public.pedidos p where p.empresa_id = e.id and p.status = 'faturado' and p.faturado_em >= date_trunc('month', now())) as faturado_mes_centavos,
  (select count(*) from public.expedicoes x where x.empresa_id = e.id and x.status in ('a_separar', 'separado')) as a_despachar,
  (select count(*) from public.notas_fiscais n where n.empresa_id = e.id and n.status in ('pendente', 'processando', 'rejeitada')) as notas_pendentes
from public.empresas e
where e.ativa;

-- ---------------------------------------------------------------------------
-- Dados fiscais extras usados pelo emissor
-- ---------------------------------------------------------------------------
alter table public.empresas add column codigo_municipio_ibge text check (codigo_municipio_ibge is null or codigo_municipio_ibge ~ '^[0-9]{7}$');
alter table public.itens_catalogo add column cfop text not null default '5102' check (cfop ~ '^[0-9]{4}$');
alter table public.itens_catalogo add column aliquota_iss numeric(5, 2) check (aliquota_iss is null or aliquota_iss between 0 and 5);
alter table public.itens_catalogo add column unidade text not null default 'UN';

-- Só o servidor (service_role) lê o token do provedor guardado no Vault.
create function public.token_fiscal(alvo uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select s.decrypted_secret
  from public.empresa_fiscal f
  join vault.decrypted_secrets s on s.id = f.provedor_token_secret_id
  where f.empresa_id = alvo;
$$;
revoke execute on function public.token_fiscal(uuid) from public, anon, authenticated;
grant execute on function public.token_fiscal(uuid) to service_role;
