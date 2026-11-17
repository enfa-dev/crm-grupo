import Link from "next/link";
import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/supabase/server";
import { cnpjFormatado, reais, regimes } from "@/lib/formato";
import { Cabecalho } from "./cabecalho";

type Resumo = {
  id: string;
  nome_fantasia: string;
  cnpj: string | null;
  regime: string;
  clientes: number;
  oportunidades_abertas: number;
  funil_centavos: number;
  homologacoes_a_vencer: number;
  faturado_mes_centavos: number;
  a_despachar: number;
  notas_pendentes: number;
};

export default async function Painel() {
  const { supabase, user, perfil } = await usuarioAtual();
  if (!user) redirect("/login");

  const { data, error } = await supabase.from("resumo_empresas").select("*").order("nome_fantasia");
  const empresas = (data ?? []) as Resumo[];
  const total = (k: keyof Resumo) => empresas.reduce((s, e) => s + Number(e[k] ?? 0), 0);

  return (
    <>
      <Cabecalho nome={perfil?.nome || user.email || ""} dona={!!perfil?.dona_grupo} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{perfil?.dona_grupo ? "Visão do grupo" : "Minhas empresas"}</h1>
          {perfil?.dona_grupo && (
            <Link href="/empresas/nova" className="rounded-md bg-slate-900 px-3 py-2 text-sm text-white">Nova empresa</Link>
          )}
        </div>

        {error && <p className="text-red-600">Não foi possível carregar: {error.message}</p>}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Indicador titulo="Faturado no mês" valor={reais(total("faturado_mes_centavos"))} />
          <Indicador titulo="Funil aberto" valor={reais(total("funil_centavos"))} />
          <Indicador titulo="Pedidos a despachar" valor={String(total("a_despachar"))} href="/expedicao" alerta={total("a_despachar") > 0} />
          <Indicador titulo="Notas pendentes" valor={String(total("notas_pendentes"))} href="/notas" alerta={total("notas_pendentes") > 0} />
          <Indicador titulo="Empresas" valor={String(empresas.length)} />
          <Indicador titulo="Homologações a vencer" valor={String(total("homologacoes_a_vencer"))} alerta={total("homologacoes_a_vencer") > 0} />
                  </section>

        <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {empresas.map((e) => (
            <Link key={e.id} href={`/empresas/${e.id}`} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-400">
              <h2 className="font-semibold">{e.nome_fantasia}</h2>
              <p className="text-sm text-slate-500">{cnpjFormatado(e.cnpj)} · {regimes[e.regime]}</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div><dt className="text-slate-500">Faturado no mês</dt><dd className="font-medium">{reais(e.faturado_mes_centavos)}</dd></div>
                <div><dt className="text-slate-500">A despachar</dt><dd className="font-medium">{e.a_despachar}</dd></div>
                <div><dt className="text-slate-500">Notas pendentes</dt><dd className="font-medium">{e.notas_pendentes}</dd></div>
                <div><dt className="text-slate-500">Clientes</dt><dd className="font-medium">{e.clientes}</dd></div>
                <div><dt className="text-slate-500">Oportunidades</dt><dd className="font-medium">{e.oportunidades_abertas}</dd></div>
                <div><dt className="text-slate-500">Funil</dt><dd className="font-medium">{reais(e.funil_centavos)}</dd></div>
              </dl>
            </Link>
          ))}
          {empresas.length === 0 && !error && (
            <p className="text-slate-500">Nenhuma empresa cadastrada ainda.</p>
          )}
        </section>
      </main>
    </>
  );
}

function Indicador({ titulo, valor, alerta, href }: { titulo: string; valor: string; alerta?: boolean; href?: string }) {
  const conteudo = (
    <div className={`h-full rounded-xl border bg-white p-4 ${alerta ? "border-amber-400" : "border-slate-200"}`}>
      <p className="text-sm text-slate-500">{titulo}</p>
      <p className="mt-1 text-xl font-semibold">{valor}</p>
    </div>
  );
  return href ? <Link href={href}>{conteudo}</Link> : conteudo;
}
