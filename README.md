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

## Fase 2

- Catálogo por empresa (serviço com código LC 116 e ISS; produto com NCM e CFOP)
- Clientes e pedidos; o banco bloqueia item de outra empresa ou de operação que nenhum CNAE da empresa libera
- "Faturar" gera uma nota por tipo (NFS-e para serviço, NF-e ou NFC-e para produto), sem duplicar, e abre a expedição quando há produto
- Fila de expedição (a separar, separado, enviado, entregue, com rastreio) e lista de notas
- Emissor: Edge Functions `emitir-notas` e `webhook-fiscal` com adaptador Focus NFe. Só envia quando a empresa
  tem `empresa_fiscal.provedor = 'focus'` e o token no Supabase Vault; começa em homologação (teste).
  Os campos fiscais devem ser validados com a contabilidade antes de ir para produção.

Para ligar o emissor: `supabase functions deploy emitir-notas webhook-fiscal`, definir os segredos
`EMISSOR_SEGREDO` e `WEBHOOK_FISCAL_SEGREDO`, e agendar `emitir-notas` (pg_cron) a cada minuto.

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
`supabase/migrations/` no editor SQL do projeto.

A **primeira conta criada** vira a dona do grupo, com acesso total a todas as
empresas. As próximas contas só enxergam as empresas em que recebem um papel.

## Testes de acesso

`npm run test:rls` aplica a migração num Postgres embutido e confere que cada
papel só enxerga a própria empresa e que a dona do grupo lê e escreve em todas.
