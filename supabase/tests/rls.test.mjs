import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const db = new PGlite();
const q = async (s, p) => { try { return await db.query(s, p); } catch (e) { console.log('ERR', s.slice(0,80), e.message); throw e; } };
await db.exec(`
create role anon; create role authenticated; create role service_role;
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
