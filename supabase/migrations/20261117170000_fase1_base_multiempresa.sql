-- Fase 1: base multiempresa do CRM do grupo.
-- Cada linha de operação pertence a uma empresa (empresa_id) e o acesso é
-- controlado por Row Level Security: um membro só enxerga as empresas em que
-- tem papel; a dona do grupo enxerga todas.


-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.regime_tributario as enum ('simples_nacional', 'mei', 'lucro_presumido', 'lucro_real');
create type public.tipo_operacao as enum ('servico', 'produto', 'ambos');
create type public.papel_empresa as enum ('gestor', 'financeiro', 'vendas', 'expedicao', 'marketing');
create type public.tipo_item as enum ('servico', 'produto');
create type public.etapa_oportunidade as enum ('lead', 'qualificado', 'proposta', 'negociacao', 'ganho', 'perdido');
create type public.status_homologacao as enum ('pendente', 'em_andamento', 'ativa', 'vencida', 'cancelada');

-- ---------------------------------------------------------------------------
-- Perfis de usuário (1:1 com auth.users)
-- ---------------------------------------------------------------------------
create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null default '',
  email text not null,
  dona_grupo boolean not null default false,
  criado_em timestamptz not null default now()
);

-- Cria o perfil automaticamente quando alguém se cadastra.
create function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'nome', ''));
  return new;
end;
$$;

create trigger ao_criar_usuario
after insert on auth.users
for each row execute function public.criar_perfil_novo_usuario();

-- ---------------------------------------------------------------------------
-- Empresas e estrutura
-- ---------------------------------------------------------------------------
create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  nome_fantasia text not null,
  razao_social text,
  cnpj text unique check (cnpj is null or cnpj ~ '^[0-9]{14}$'),
  regime public.regime_tributario not null default 'simples_nacional',
  anexo_simples text check (anexo_simples is null or anexo_simples in ('I', 'II', 'III', 'IV', 'V')),
  inscricao_municipal text,
  inscricao_estadual text,
  municipio text,
  uf char(2),
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);

create table public.empresa_cnaes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  codigo text not null check (codigo ~ '^[0-9]{7}$'),
  descricao text not null default '',
  principal boolean not null default false,
  operacao public.tipo_operacao not null,
  unique (empresa_id, codigo)
);
create index on public.empresa_cnaes (empresa_id);
-- No máximo um CNAE principal por empresa.
create unique index empresa_cnae_principal_unico on public.empresa_cnaes (empresa_id) where principal;

-- Configuração fiscal sensível: só o servidor (service role) lê os segredos.
-- O certificado A1 e o token do emissor ficam no Supabase Vault; aqui só a referência.
create table public.empresa_fiscal (
  empresa_id uuid primary key references public.empresas (id) on delete cascade,
  provedor text,
  provedor_token_secret_id uuid,
  certificado_secret_id uuid,
  certificado_validade date,
  serie_nfe text,
  serie_nfse text,
  ambiente text not null default 'homologacao' check (ambiente in ('homologacao', 'producao')),
  atualizado_em timestamptz not null default now()
);

create table public.membros (
  usuario_id uuid not null references public.perfis (id) on delete cascade,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  papel public.papel_empresa not null,
  criado_em timestamptz not null default now(),
  primary key (usuario_id, empresa_id, papel)
);
create index on public.membros (empresa_id);

-- ---------------------------------------------------------------------------
-- Funções de acesso (security definer para não cair em recursão de RLS)
-- ---------------------------------------------------------------------------
create schema if not exists privado;
revoke all on schema privado from public, anon;
grant usage on schema privado to authenticated;

create function privado.e_dona_grupo()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select dona_grupo from public.perfis where id = auth.uid()), false);
$$;

-- Verdadeiro se o usuário é dona do grupo ou tem algum dos papéis na empresa.
-- papeis nulo = qualquer papel.
create function privado.tem_acesso(alvo uuid, papeis public.papel_empresa[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select privado.e_dona_grupo() or exists (
    select 1 from public.membros m
    where m.usuario_id = auth.uid()
      and m.empresa_id = alvo
      and (papeis is null or m.papel = any (papeis))
  );
$$;

grant execute on function privado.e_dona_grupo() to authenticated;
grant execute on function privado.tem_acesso(uuid, public.papel_empresa[]) to authenticated;

-- ---------------------------------------------------------------------------
-- CRM e catálogo
-- ---------------------------------------------------------------------------
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nome text not null,
  documento text check (documento is null or documento ~ '^([0-9]{11}|[0-9]{14})$'),
  email text,
  telefone text,
  cidade text,
  uf char(2),
  observacoes text,
  criado_em timestamptz not null default now()
);
create index on public.clientes (empresa_id);

create table public.oportunidades (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  cliente_id uuid references public.clientes (id) on delete set null,
  titulo text not null,
  etapa public.etapa_oportunidade not null default 'lead',
  valor_centavos bigint not null default 0 check (valor_centavos >= 0),
  origem text,
  responsavel_id uuid references public.perfis (id) on delete set null,
  previsao_fechamento date,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on public.oportunidades (empresa_id, etapa);
create index on public.oportunidades (cliente_id);

create table public.itens_catalogo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  tipo public.tipo_item not null,
  nome text not null,
  descricao text,
  preco_centavos bigint not null default 0 check (preco_centavos >= 0),
  cnae text,
  ncm text check (ncm is null or ncm ~ '^[0-9]{8}$'),
  codigo_servico text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  -- produto precisa de NCM; serviço precisa de código de serviço (LC 116)
  check (tipo <> 'produto' or ncm is not null),
  check (tipo <> 'servico' or codigo_servico is not null)
);
create index on public.itens_catalogo (empresa_id);

create table public.homologacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  orgao text not null,
  descricao text not null,
  status public.status_homologacao not null default 'pendente',
  validade date,
  observacoes text,
  criado_em timestamptz not null default now()
);
create index on public.homologacoes (empresa_id, validade);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.perfis enable row level security;
alter table public.empresas enable row level security;
alter table public.empresa_cnaes enable row level security;
alter table public.empresa_fiscal enable row level security;
alter table public.membros enable row level security;
alter table public.clientes enable row level security;
alter table public.oportunidades enable row level security;
alter table public.itens_catalogo enable row level security;
alter table public.homologacoes enable row level security;

-- Perfis: cada um vê o seu; dona vê todos; colegas de empresa se veem.
create policy perfis_ler on public.perfis for select to authenticated
  using (
    id = (select auth.uid())
    or (select privado.e_dona_grupo())
    or exists (
      select 1 from public.membros eu
      join public.membros outro on outro.empresa_id = eu.empresa_id
      where eu.usuario_id = (select auth.uid()) and outro.usuario_id = perfis.id
    )
  );
create policy perfis_editar_proprio on public.perfis for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()) and dona_grupo = (select privado.e_dona_grupo()));

-- Empresas: membros leem; só a dona cria, altera ou remove.
create policy empresas_ler on public.empresas for select to authenticated
  using ((select privado.tem_acesso(id)));
create policy empresas_dona_escreve on public.empresas for all to authenticated
  using ((select privado.e_dona_grupo())) with check ((select privado.e_dona_grupo()));

create policy cnaes_ler on public.empresa_cnaes for select to authenticated
  using ((select privado.tem_acesso(empresa_id)));
create policy cnaes_dona_escreve on public.empresa_cnaes for all to authenticated
  using ((select privado.e_dona_grupo())) with check ((select privado.e_dona_grupo()));

-- Fiscal: só dona e financeiro leem; só a dona altera. Segredos ficam no Vault.
create policy fiscal_ler on public.empresa_fiscal for select to authenticated
  using ((select privado.tem_acesso(empresa_id, array['gestor', 'financeiro']::public.papel_empresa[])));
create policy fiscal_dona_escreve on public.empresa_fiscal for all to authenticated
  using ((select privado.e_dona_grupo())) with check ((select privado.e_dona_grupo()));

-- Membros: cada um vê os membros das suas empresas; dona e gestor administram.
create policy membros_ler on public.membros for select to authenticated
  using ((select privado.tem_acesso(empresa_id)));
create policy membros_gestor_escreve on public.membros for all to authenticated
  using ((select privado.tem_acesso(empresa_id, array['gestor']::public.papel_empresa[])))
  with check ((select privado.tem_acesso(empresa_id, array['gestor']::public.papel_empresa[])));

-- CRM: gestor e vendas leem e escrevem; marketing lê.
create policy clientes_ler on public.clientes for select to authenticated
  using ((select privado.tem_acesso(empresa_id, array['gestor', 'vendas', 'financeiro', 'marketing']::public.papel_empresa[])));
create policy clientes_escrever on public.clientes for all to authenticated
  using ((select privado.tem_acesso(empresa_id, array['gestor', 'vendas']::public.papel_empresa[])))
  with check ((select privado.tem_acesso(empresa_id, array['gestor', 'vendas']::public.papel_empresa[])));

create policy oportunidades_ler on public.oportunidades for select to authenticated
  using ((select privado.tem_acesso(empresa_id, array['gestor', 'vendas', 'marketing']::public.papel_empresa[])));
create policy oportunidades_escrever on public.oportunidades for all to authenticated
  using ((select privado.tem_acesso(empresa_id, array['gestor', 'vendas']::public.papel_empresa[])))
  with check ((select privado.tem_acesso(empresa_id, array['gestor', 'vendas']::public.papel_empresa[])));

-- Catálogo: todos os membros leem; gestor escreve.
create policy catalogo_ler on public.itens_catalogo for select to authenticated
  using ((select privado.tem_acesso(empresa_id)));
create policy catalogo_escrever on public.itens_catalogo for all to authenticated
  using ((select privado.tem_acesso(empresa_id, array['gestor']::public.papel_empresa[])))
  with check ((select privado.tem_acesso(empresa_id, array['gestor']::public.papel_empresa[])));

-- Homologações: todos os membros leem; gestor escreve.
create policy homologacoes_ler on public.homologacoes for select to authenticated
  using ((select privado.tem_acesso(empresa_id)));
create policy homologacoes_escrever on public.homologacoes for all to authenticated
  using ((select privado.tem_acesso(empresa_id, array['gestor']::public.papel_empresa[])))
  with check ((select privado.tem_acesso(empresa_id, array['gestor']::public.papel_empresa[])));

-- ---------------------------------------------------------------------------
-- Visão consolidada para o painel (respeita RLS de quem consulta)
-- ---------------------------------------------------------------------------
create view public.resumo_empresas
with (security_invoker = true) as
select
  e.id,
  e.nome_fantasia,
  e.cnpj,
  e.regime,
  (select count(*) from public.clientes c where c.empresa_id = e.id) as clientes,
  (select count(*) from public.oportunidades o where o.empresa_id = e.id and o.etapa not in ('ganho', 'perdido')) as oportunidades_abertas,
  (select coalesce(sum(o.valor_centavos), 0) from public.oportunidades o where o.empresa_id = e.id and o.etapa not in ('ganho', 'perdido')) as funil_centavos,
  (select count(*) from public.homologacoes h where h.empresa_id = e.id and h.validade is not null and h.validade <= current_date + 30 and h.status <> 'cancelada') as homologacoes_a_vencer
from public.empresas e
where e.ativa;
