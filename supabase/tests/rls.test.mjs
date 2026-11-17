import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const db = new PGlite();
const q = async (s, p) => { try { return await db.query(s, p); } catch (e) { console.log('ERR', s.slice(0,80), e.message); throw e; } };
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema vault; create table vault.decrypted_secrets (id uuid primary key, decrypted_secret text);
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true),'')::uuid $$;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
`);
try { for (const f of fs.readdirSync(new URL('../migrations/', import.meta.url)).sort()) await db.exec(fs.readFileSync(new URL('../migrations/' + f, import.meta.url), 'utf8')); } catch (e) { console.log('MIGRATION ERR', e.message, e.position); process.exit(1); }
await db.exec(`grant usage on schema public to authenticated; grant all on all tables in schema public to authenticated;`);
const dona='00000000-0000-0000-0000-000000000001', ges='00000000-0000-0000-0000-000000000002', ven='00000000-0000-0000-0000-000000000003';
await db.exec(`insert into auth.users values ('${dona}','paula@x',null),('${ges}','g@x','{"nome":"Gestor Halo"}'),('${ven}','v@x',null);
-- primeira conta vira dona automaticamente
insert into empresas (id,nome_fantasia,cnpj) values ('10000000-0000-0000-0000-000000000001','Halo','11111111000111'),('10000000-0000-0000-0000-000000000002','Chay','22222222000122');
insert into membros values ('${ges}','10000000-0000-0000-0000-000000000001','gestor'),('${ven}','10000000-0000-0000-0000-000000000002','vendas');
insert into clientes (empresa_id,nome) values ('10000000-0000-0000-0000-000000000001','Cliente Halo'),('10000000-0000-0000-0000-000000000002','Cliente Chay');
insert into oportunidades (empresa_id,titulo,valor_centavos) values ('10000000-0000-0000-0000-000000000001','Op Halo',50000);`);
const as = async (u, fn) => { await db.exec(`set role authenticated; set request.jwt.sub='${u}'`); try { return await fn(); } finally { await db.exec(`reset role`); } };
const check = (name, ok) => { console.log(ok ? 'OK  ' : 'FAIL', name); if (!ok) process.exitCode = 1; };
check('só a primeira conta virou dona', (await db.query('select count(*)::int n from perfis where dona_grupo')).rows[0].n === 1 && (await db.query(`select dona_grupo from perfis where id='${dona}'`)).rows[0].dona_grupo);
await as(dona, async () => { const r = await q('select nome_fantasia, clientes, funil_centavos from resumo_empresas order by 1'); check('dona vê 2 empresas no resumo', r.rows.length===2); console.log(r.rows); });
await as(ges, async () => {
  check('gestor vê só Halo', (await q('select * from empresas')).rows.length===1);
  check('gestor vê só cliente Halo', (await q('select nome from clientes')).rows.map(r=>r.nome).join()==='Cliente Halo');
  let blocked=false; try { await db.query(`insert into clientes (empresa_id,nome) values ('10000000-0000-0000-0000-000000000002','x')`);} catch { blocked=true; }
  check('gestor Halo não grava na Chay', blocked);
  let b2=false; try { await db.query(`insert into empresas (nome_fantasia) values ('x')`);} catch { b2=true; }
  check('gestor não cria empresa', b2);
  let b3=false; try { await db.query(`update perfis set dona_grupo=true where id='${ges}'`);} catch { b3=true; }
  check('gestor não vira dona', b3);
  check('perfil criado pelo trigger com nome', (await q(`select nome from perfis where id='${ges}'`)).rows[0]?.nome==='Gestor Halo');
});
await as(ven, async () => {
  check('vendas Chay não vê oportunidade Halo', (await q('select * from oportunidades')).rows.length===0);
  await q(`insert into clientes (empresa_id,nome) values ('10000000-0000-0000-0000-000000000002','Novo')`);
  check('vendas grava cliente na Chay', true);
  check('vendas não lê fiscal', (await q('select * from empresa_fiscal')).rows.length===0);
});
// A dona do grupo (Paula) nunca é bloqueada: lê e escreve em todas as empresas.
const halo = '10000000-0000-0000-0000-000000000001', chay = '10000000-0000-0000-0000-000000000002';
await as(dona, async () => {
  for (const emp of [halo, chay]) {
    await q(`insert into clientes (empresa_id,nome) values ('${emp}','Cliente da dona')`);
    await q(`insert into oportunidades (empresa_id,titulo) values ('${emp}','Op da dona')`);
    await q(`insert into itens_catalogo (empresa_id,tipo,nome,codigo_servico) values ('${emp}','servico','Consulta','04.01')`);
    await q(`insert into homologacoes (empresa_id,orgao,descricao) values ('${emp}','Anvisa','Licença')`);
    await q(`insert into empresa_fiscal (empresa_id,provedor) values ('${emp}','focus')`);
    await q(`insert into empresa_cnaes (empresa_id,codigo,operacao) values ('${emp}','8630503','servico')`);
    await q(`update empresas set municipio='São Paulo' where id='${emp}'`);
  }
  await q(`insert into membros values ('${ven}','${halo}','vendas')`);
  check('dona escreve em todas as empresas', true);
  for (const t of ['clientes', 'oportunidades', 'itens_catalogo', 'homologacoes', 'empresa_fiscal', 'empresa_cnaes', 'membros']) {
    const r = await q(`select count(distinct empresa_id)::int n from ${t}`);
    check(`dona lê ${t} das 2 empresas`, r.rows[0].n === 2);
  }
});

// ---------------- Fase 2: pedidos, notas e expedição ----------------
const exp = '00000000-0000-0000-0000-000000000004';
await db.exec(`insert into auth.users values ('${exp}','e@x',null);
insert into membros values ('${exp}','${halo}','expedicao');
delete from empresa_cnaes; 
insert into empresa_cnaes (empresa_id,codigo,operacao,principal) values ('${halo}','4772500','ambos',true),('${chay}','8630503','servico',true);
insert into itens_catalogo (id,empresa_id,tipo,nome,preco_centavos,ncm) values ('20000000-0000-0000-0000-000000000001','${halo}','produto','Creme',5000,'33049910'),('20000000-0000-0000-0000-000000000003','${chay}','produto','Produto Chay',1000,'33049910');
insert into itens_catalogo (id,empresa_id,tipo,nome,preco_centavos,codigo_servico) values ('20000000-0000-0000-0000-000000000002','${halo}','servico','Consultoria',20000,'17.01');`);
const fails = async (sql) => { try { await db.query(sql); return false; } catch { return true; } };
let pedido;
await as(ges, async () => {
  pedido = (await q(`insert into pedidos (empresa_id) values ('${halo}') returning id`)).rows[0].id;
  await q(`insert into pedido_itens (pedido_id,item_id,quantidade,descricao,preco_unit_centavos,empresa_id,tipo) values ('${pedido}','20000000-0000-0000-0000-000000000001',2,'',null,'${halo}','produto')`.replace(",null,", ",5000,"));
  await q(`insert into pedido_itens (pedido_id,item_id,quantidade,descricao,preco_unit_centavos,empresa_id,tipo) values ('${pedido}','20000000-0000-0000-0000-000000000002',1,'',20000,'${halo}','servico')`);
  check('total do pedido somado', (await q(`select total_centavos::int t from pedidos where id='${pedido}'`)).rows[0].t === 30000);
  check('item de outra empresa bloqueado', await fails(`insert into pedido_itens (pedido_id,item_id,quantidade,descricao,preco_unit_centavos,empresa_id,tipo) values ('${pedido}','20000000-0000-0000-0000-000000000003',1,'',1,'${halo}','produto')`));
  check('não fatura pelo update direto', await fails(`update pedidos set status='faturado' where id='${pedido}'`));
  check('navegador não grava nota', await fails(`insert into notas_fiscais (empresa_id,pedido_id,tipo) values ('${halo}','${pedido}','nfe')`));
  const n = (await q(`select faturar_pedido('${pedido}') n`)).rows[0].n;
  check('faturar gera NF-e e NFS-e', n === 2 && (await q(`select string_agg(tipo::text, ',' order by tipo) t from notas_fiscais where pedido_id='${pedido}'`)).rows[0].t === 'nfse,nfe');
  check('refaturar não duplica', (await q(`select faturar_pedido('${pedido}') n`)).rows[0].n === 0 && (await q(`select count(*)::int c from notas_fiscais where pedido_id='${pedido}'`)).rows[0].c === 2);
  check('pedido com produto abre expedição', (await q(`select count(*)::int c from expedicoes where pedido_id='${pedido}'`)).rows[0].c === 1);
  check('pedido faturado não aceita itens', await fails(`insert into pedido_itens (pedido_id,item_id,quantidade,descricao,preco_unit_centavos,empresa_id,tipo) values ('${pedido}','20000000-0000-0000-0000-000000000001',1,'',1,'${halo}','produto')`));
});
await as(dona, async () => {
  const p2 = (await q(`insert into pedidos (empresa_id) values ('${chay}') returning id`)).rows[0].id;
  check('Chay (só serviço) não vende produto', await fails(`insert into pedido_itens (pedido_id,item_id,quantidade,descricao,preco_unit_centavos,empresa_id,tipo) values ('${p2}','20000000-0000-0000-0000-000000000003',1,'',1,'${chay}','produto')`));
  check('dona vê notas e expedições da Halo', (await q(`select count(*)::int c from notas_fiscais`)).rows[0].c === 2);
});
await as(exp, async () => {
  check('expedição vê a fila', (await q(`select count(*)::int c from expedicoes`)).rows[0].c === 1);
  check('expedição não vê notas', (await q(`select count(*)::int c from notas_fiscais`)).rows[0].c === 0);
  await q(`update expedicoes set status='enviado', codigo_rastreio='BR123' where pedido_id='${pedido}'`);
  check('expedição marca como enviado', (await q(`select status from expedicoes where pedido_id='${pedido}'`)).rows[0].status === 'enviado');
});
const ven2 = '00000000-0000-0000-0000-000000000005';
await db.exec(`insert into auth.users values ('${ven2}','v2@x',null); insert into membros values ('${ven2}','${chay}','vendas');`);
await as(ven2, async () => {
  check('vendas da Chay não fatura pedido da Halo', await fails(`select faturar_pedido('${pedido}')`));
  check('vendas da Chay não vê notas da Halo', (await q(`select count(*)::int c from notas_fiscais where empresa_id='${halo}'`)).rows[0].c === 0);
});
