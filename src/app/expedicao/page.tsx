import Link from "next/link";
import { paginaLogada, Moldura, Bloco, campo, botao, statusExpedicao } from "@/lib/pagina";
import { atualizarExpedicao } from "@/app/operacao-actions";

type Linha = {
  id: string;
  status: string;
  transportadora: string | null;
  codigo_rastreio: string | null;
  pedidos: { id: string; numero: number; clientes: { nome: string; cidade: string | null; uf: string | null } | null };
  empresas: { nome_fantasia: string };
};

export default async function Expedicao() {
  const { supabase, user, perfil } = await paginaLogada();
  const { data } = await supabase
    .from("expedicoes")
    .select("id, status, transportadora, codigo_rastreio, pedidos(id, numero, clientes(nome, cidade, uf)), empresas(nome_fantasia)")
    .in("status", ["a_separar", "separado", "enviado"])
    .order("atualizado_em");
  const linhas = (data ?? []) as unknown as Linha[];

  return (
    <Moldura nome={perfil?.nome || user.email || ""} dona={!!perfil?.dona_grupo}>
      <h1 className="text-2xl font-semibold">Pedidos a despachar</h1>
      <Bloco titulo={`${linhas.filter((l) => l.status !== "enviado").length} aguardando envio`}>
        <ul className="divide-y divide-slate-100 text-sm">
          {linhas.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <Link href={`/pedidos/${l.pedidos.id}`} className="underline">#{l.pedidos.numero}</Link> · {l.empresas.nome_fantasia} · {l.pedidos.clientes?.nome ?? "Sem cliente"}
                {l.pedidos.clientes?.cidade ? ` · ${l.pedidos.clientes.cidade}/${l.pedidos.clientes.uf ?? ""}` : ""}
              </span>
              <form action={atualizarExpedicao.bind(null, l.id)} className="flex flex-wrap gap-2">
                <select name="status" defaultValue={l.status} className={campo}>
                  {Object.entries(statusExpedicao).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                </select>
                <input name="transportadora" defaultValue={l.transportadora ?? ""} placeholder="Transportadora" className={`${campo} w-32`} />
                <input name="codigo_rastreio" defaultValue={l.codigo_rastreio ?? ""} placeholder="Rastreio" className={`${campo} w-32`} />
                <button className={botao}>Salvar</button>
              </form>
            </li>
          ))}
          {!linhas.length && <li className="py-2 text-slate-500">Nada para despachar.</li>}
        </ul>
      </Bloco>
    </Moldura>
  );
}
