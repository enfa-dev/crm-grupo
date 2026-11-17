import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/supabase/server";
import { cnpjFormatado, etapas, operacoes, reais, regimes } from "@/lib/formato";
import { adicionarCnae } from "../actions";
import { Cabecalho } from "../../cabecalho";

export default async function Empresa({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, perfil } = await usuarioAtual();
  if (!user) redirect("/login");

  const [{ data: empresa }, { data: cnaes }, { data: oportunidades }, { data: homologacoes }, { count: clientes }] =
    await Promise.all([
      supabase.from("empresas").select("*").eq("id", id).maybeSingle(),
      supabase.from("empresa_cnaes").select("*").eq("empresa_id", id).order("principal", { ascending: false }),
      supabase.from("oportunidades").select("id, titulo, etapa, valor_centavos").eq("empresa_id", id).order("atualizado_em", { ascending: false }).limit(20),
      supabase.from("homologacoes").select("id, orgao, descricao, status, validade").eq("empresa_id", id).order("validade"),
      supabase.from("clientes").select("id", { count: "exact", head: true }).eq("empresa_id", id),
    ]);
  if (!empresa) notFound();

  return (
    <>
      <Cabecalho nome={perfil?.nome || user.email || ""} dona={!!perfil?.dona_grupo} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div>
          <Link href="/" className="text-sm text-slate-500">← Todas as empresas</Link>
          <h1 className="mt-2 text-2xl font-semibold">{empresa.nome_fantasia}</h1>
          <p className="text-slate-500">
            {cnpjFormatado(empresa.cnpj)} · {regimes[empresa.regime]}
            {empresa.anexo_simples ? ` · Anexo ${empresa.anexo_simples}` : ""}
            {empresa.municipio ? ` · ${empresa.municipio}/${empresa.uf ?? ""}` : ""}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Bloco titulo="CNAEs">
            <ul className="divide-y divide-slate-100">
              {(cnaes ?? []).map((c) => (
                <li key={c.id} className="flex justify-between py-2 text-sm">
                  <span>{c.codigo} {c.descricao}{c.principal ? " (principal)" : ""}</span>
                  <span className="text-slate-500">{operacoes[c.operacao]}</span>
                </li>
              ))}
              {!cnaes?.length && <li className="py-2 text-sm text-slate-500">Nenhum CNAE cadastrado.</li>}
            </ul>
            {perfil?.dona_grupo && (
              <form action={adicionarCnae.bind(null, id)} className="mt-3 flex flex-wrap gap-2 text-sm">
                <input name="codigo" required placeholder="CNAE" className="w-28 rounded-md border border-slate-300 px-2 py-1" />
                <input name="descricao" placeholder="Descrição" className="flex-1 rounded-md border border-slate-300 px-2 py-1" />
                <select name="operacao" className="rounded-md border border-slate-300 px-2 py-1">
                  <option value="servico">Serviço</option>
                  <option value="produto">Produto</option>
                  <option value="ambos">Ambos</option>
                </select>
                <button className="rounded-md bg-slate-900 px-3 py-1 text-white">Adicionar</button>
              </form>
            )}
          </Bloco>

          <Bloco titulo={`Funil de vendas · ${clientes ?? 0} clientes`}>
            <ul className="divide-y divide-slate-100">
              {(oportunidades ?? []).map((o) => (
                <li key={o.id} className="flex justify-between py-2 text-sm">
                  <span>{o.titulo}</span>
                  <span className="text-slate-500">{etapas[o.etapa]} · {reais(o.valor_centavos)}</span>
                </li>
              ))}
              {!oportunidades?.length && <li className="py-2 text-sm text-slate-500">Nenhuma oportunidade ainda.</li>}
            </ul>
          </Bloco>

          <Bloco titulo="Homologações">
            <ul className="divide-y divide-slate-100">
              {(homologacoes ?? []).map((h) => (
                <li key={h.id} className="flex justify-between py-2 text-sm">
                  <span>{h.orgao} · {h.descricao}</span>
                  <span className="text-slate-500">{h.status}{h.validade ? ` · vence ${new Date(h.validade + "T12:00:00").toLocaleDateString("pt-BR")}` : ""}</span>
                </li>
              ))}
              {!homologacoes?.length && <li className="py-2 text-sm text-slate-500">Nenhuma homologação cadastrada.</li>}
            </ul>
          </Bloco>
        </div>
      </main>
    </>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="mb-2 font-semibold">{titulo}</h2>
      {children}
    </section>
  );
}
