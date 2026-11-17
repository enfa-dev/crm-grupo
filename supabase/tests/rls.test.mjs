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
try { await db.exec(fs.readFileSync(new URL('../migrations/20261117170000_fase1_base_multiempresa.sql', import.meta.url), 'utf8')); } catch (e) { console.log('MIGRATION ERR', e.message, e.position); process.exit(1); }
await db.exec(`grant usage on schema public to authenticated; grant all on all tables in schema public to authenticated;`);
const dona='00000000-0000-0000-0000-000000000001', ges='00000000-0000-0000-0000-000000000002', ven='00000000-0000-0000-0000-000000000003';
await db.exec(`insert into auth.users values ('${dona}','paula@x',null),('${ges}','g@x','{"nome":"Gestor Halo"}'),('${ven}','v@x',null);
update perfis set dona_grupo=true where id='${dona}';
insert into empresas (id,nome_fantasia,cnpj) values ('10000000-0000-0000-0000-000000000001','Halo','11111111000111'),('10000000-0000-0000-0000-000000000002','Chay','22222222000122');
insert into membros values ('${ges}','10000000-0000-0000-0000-000000000001','gestor'),('${ven}','10000000-0000-0000-0000-000000000002','vendas');
insert into clientes (empresa_id,nome) values ('10000000-0000-0000-0000-000000000001','Cliente Halo'),('10000000-0000-0000-0000-000000000002','Cliente Chay');
insert into oportunidades (empresa_id,titulo,valor_centavos) values ('10000000-0000-0000-0000-000000000001','Op Halo',50000);`);
const as = async (u, fn) => { await db.exec(`set role authenticated; set request.jwt.sub='${u}'`); try { return await fn(); } finally { await db.exec(`reset role`); } };
const check = (name, ok) => { console.log(ok ? 'OK  ' : 'FAIL', name); if (!ok) process.exitCode = 1; };
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
