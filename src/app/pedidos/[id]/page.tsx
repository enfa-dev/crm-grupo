import Link from "next/link";
import { notFound } from "next/navigation";
import { paginaLogada, Moldura, Bloco, campo, statusPedido, statusNota, statusExpedicao, tipoNota } from "@/lib/pagina";
import { reais } from "@/lib/formato";
import { adicionarItemPedido, cancelarPedido, faturarPedido, removerItemPedido } from "@/app/operacao-actions";
import { Formulario } from "@/app/formulario";

export default async function Pedido({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, perfil } = await paginaLogada();
  const { data: pedido } = await supabase
    .from("pedidos")
    .select("*, empresas(nome_fantasia), clientes(nome, documento)")
    .eq("id", id)
    .maybeSingle();
  if (!pedido) notFound();

  const [{ data: itens }, { data: catalogo }, { data: notas }, { data: expedicao }] = await Promise.all([
    supabase.from("pedido_itens").select("*").eq("pedido_id", id).order("tipo"),
    supabase.from("itens_catalogo").select("id, nome, tipo, preco_centavos").eq("empresa_id", pedido.empresa_id).eq("ativo", true).order("nome"),
    supabase.from("notas_fiscais").select("*").eq("pedido_id", id).order("tipo"),
    supabase.from("expedicoes").select("*").eq("pedido_id", id).maybeSingle(),
  ]);
  const rascunho = pedido.status === "rascunho";
  const empresa = pedido.empresas as unknown as { nome_fantasia: string };
  const cliente = pedido.clientes as unknown as { nome: string; documento: string | null } | null;

  return (
    <Moldura nome={perfil?.nome || user.email || ""} dona={!!perfil?.dona_grupo}>
      <div>
        <Link href={`/empresas/${pedido.empresa_id}/pedidos`} className="text-sm text-slate-500">← Pedidos da {empresa.nome_fantasia}</Link>
        <h1 className="mt-2 text-2xl font-semibold">Pedido #{pedido.numero}</h1>
        <p className="text-slate-500">
          {statusPedido[pedido.status]} · {cliente?.nome ?? "Sem cliente"}{pedido.consumidor_final ? " · consumidor final" : ""} · {reais(pedido.total_centavos)}
        </p>
      </div>

      <Bloco titulo="Itens">
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr><th className="py-1">Item</th><th>Tipo</th><th className="text-right">Qtd.</th><th className="text-right">Unitário</th><th className="text-right">Total</th><th /></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(itens ?? []).map((i) => (
              <tr key={i.id}>
                <td className="py-2">{i.descricao}</td>
                <td>{i.tipo === "servico" ? "Serviço" : "Produto"}</td>
                <td className="text-right">{Number(i.quantidade).toLocaleString("pt-BR")}</td>
                <td className="text-right">{reais(i.preco_unit_centavos)}</td>
                <td className="text-right">{reais(i.total_centavos)}</td>
                <td className="text-right">
                  {rascunho && (
                    <form action={removerItemPedido.bind(null, id, i.id)}><button className="text-red-600 underline">remover</button></form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rascunho && (
          <div className="mt-3">
            <Formulario acao={adicionarItemPedido.bind(null, id)} botao="Adicionar item">
              <select name="item_id" required className={`${campo} flex-1`}>
                {(catalogo ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.nome} ({c.tipo === "servico" ? "serviço" : "produto"}, {reais(c.preco_centavos)})</option>
                ))}
              </select>
              <input name="quantidade" defaultValue="1" className={`${campo} w-20`} />
              <input name="preco" placeholder="Preço (opcional)" className={`${campo} w-32`} />
            </Formulario>
            {!catalogo?.length && (
              <p className="mt-2 text-sm text-slate-500">Cadastre itens no <Link className="underline" href={`/empresas/${pedido.empresa_id}/catalogo`}>catálogo</Link> primeiro.</p>
            )}
          </div>
        )}
      </Bloco>

      {rascunho && (
        <div className="flex flex-wrap items-start gap-3">
          <Formulario acao={faturarPedido.bind(null, id)} botao="Faturar e gerar notas" className="flex flex-col gap-1 text-sm">
            <span className="text-slate-500">Gera uma nota por tipo (serviço e produto) pela {empresa.nome_fantasia}.</span>
          </Formulario>
          <form action={cancelarPedido.bind(null, id)}><button className="rounded-md border border-slate-300 px-3 py-1 text-sm">Cancelar pedido</button></form>
        </div>
      )}

      {!!notas?.length && (
        <Bloco titulo="Notas fiscais">
          <ul className="divide-y divide-slate-100 text-sm">
            {notas.map((n) => (
              <li key={n.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>{tipoNota[n.tipo]} · {reais(n.valor_centavos)}{n.numero ? ` · nº ${n.numero}` : ""}{n.ambiente === "homologacao" ? " · teste" : ""}</span>
                <span className={n.status === "rejeitada" ? "text-red-600" : "text-slate-500"}>
                  {statusNota[n.status]}{n.motivo ? `: ${n.motivo}` : ""}
                  {n.pdf_url && <> · <a className="underline" href={n.pdf_url} target="_blank" rel="noreferrer">PDF</a></>}
                </span>
              </li>
            ))}
          </ul>
        </Bloco>
      )}

      {expedicao && (
        <Bloco titulo="Expedição">
          <p className="text-sm">{statusExpedicao[expedicao.status]}{expedicao.codigo_rastreio ? ` · rastreio ${expedicao.codigo_rastreio}` : ""} · <Link href="/expedicao" className="underline">ver fila</Link></p>
        </Bloco>
      )}
    </Moldura>
  );
}
