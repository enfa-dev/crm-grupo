# CRM do Grupo

Sistema central das empresas do grupo: cada empresa opera de forma independente
(dados isolados por Row Level Security no Supabase) e a dona do grupo vê o
consolidado de todas.

Plano completo: https://claude.ai/artifact/RyAqZGLcNu1zVYx7CkTBHS

## Fase 1 (este esqueleto)

- Login (Supabase Auth, e-mail e senha)
- Painel do grupo: empresas, clientes, funil aberto, homologações a vencer
- Cadastro de empresa com CNPJ, regime (Simples Nacional, anexo), município e CNAE principal
- Página da empresa: CNAEs (serviço/produto), funil de vendas, homologações
- Banco: `supabase/migrations/` com empresas, CNAEs, configuração fiscal, membros e papéis,
  clientes, oportunidades, catálogo e homologações, todas com RLS por empresa

## Papéis

| Papel | Alcance |
| --- | --- |
| Dona do grupo (`perfis.dona_grupo`) | Todas as empresas |
| gestor | Tudo da sua empresa, inclusive convidar membros |
| financeiro | Financeiro e fiscal da empresa |
| vendas | CRM e pedidos |
| expedicao | Fila de despacho |
| marketing | Prospecção e campanhas |

## Rodar localmente

```bash
cp .env.example .env.local   # preencha com a URL e a chave publicável do projeto Supabase
npm install
npm run dev
```

Aplicar o banco: `supabase db push` (Supabase CLI) ou rode o SQL de
`supabase/migrations/` no editor SQL do projeto. Depois do primeiro cadastro,
marque a dona do grupo:

```sql
update perfis set dona_grupo = true where email = 'SEU-EMAIL';
```

## Testes de acesso

`npm run test:rls` aplica a migração num Postgres embutido e confere que cada
papel só enxerga a própria empresa.
