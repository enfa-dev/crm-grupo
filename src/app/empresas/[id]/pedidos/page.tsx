import Link from "next/link";
import { paginaLogada, Moldura, Bloco, campo, botao, statusPedido } from "@/lib/pagina";
import { reais } from "@/lib/formato";
import { criarPedido } from "@/app/operacao-actions";

export default async function Pedidos({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, perfil } = await paginaLogada();
  const [{ data: empresa }, { data: clientes }, { data: pedidos }] = await Promise.all([
    supabase.from("empresas").select("nome_fantasia").eq("id", id).maybeSingle(),
    supabase.from("clientes").select("id, nome").eq("empresa_id", id).order("nome"),
    supabase.from("pedidos").select("id, numero, status, total_centavos, criado_em, clientes(nome)").eq("empresa_id", id).order("criado_em", { ascending: false }).limit(50),
  ]);

  return (
    <Moldura nome={perfil?.nome || user.email || ""} dona={!!perfil?.dona_grupo}>
      <div>
        <Link href={`/empresas/${id}`} className="text-sm text-slate-500">← {empresa?.nome_fantasia}</Link>
        <h1 className="mt-2 text-2xl font-semibold">Pedidos</h1>
      </div>
      <Bloco titulo="Novo pedido">
        <form action={criarPedido.bind(null, id)} className="flex flex-wrap items-center gap-2 text-sm">
          <select name="cliente_id" className={campo} defaultValue="">
            <option value="">Sem cliente identificado</option>
            {(clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <label className="flex items-center gap-1"><input type="checkbox" name="consumidor_final" /> Venda ao consumidor final (NFC-e)</label>
          <input name="observacoes" placeholder="Observações" className={`${campo} flex-1`} />
          <button className={botao}>Criar pedido</button>
        </form>
      </Bloco>
      <Bloco titulo="Últimos pedidos">
        <ul className="divide-y divide-slate-100 text-sm">
          {(pedidos ?? []).map((p) => (
            <li key={p.id}>
              <Link href={`/pedidos/${p.id}`} className="flex justify-between py-2 hover:bg-slate-50">
                <span>#{p.numero} · {(p.clientes as unknown as { nome: string } | null)?.nome ?? "Sem cliente"}</span>
                <span className="text-slate-500">{statusPedido[p.status]} · {reais(p.total_centavos)}</span>
              </Link>
            </li>
          ))}
          {!pedidos?.length && <li className="py-2 text-slate-500">Nenhum pedido ainda.</li>}
        </ul>
      </Bloco>
    </Moldura>
  );
}
