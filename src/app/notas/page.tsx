import Link from "next/link";
import { paginaLogada, Moldura, Bloco, statusNota, tipoNota } from "@/lib/pagina";
import { reais } from "@/lib/formato";

type Linha = {
  id: string;
  tipo: string;
  status: string;
  ambiente: string;
  numero: string | null;
  motivo: string | null;
  pdf_url: string | null;
  valor_centavos: number;
  criado_em: string;
  pedido_id: string;
  empresas: { nome_fantasia: string };
};

export default async function Notas() {
  const { supabase, user, perfil } = await paginaLogada();
  const { data } = await supabase
    .from("notas_fiscais")
    .select("id, tipo, status, ambiente, numero, motivo, pdf_url, valor_centavos, criado_em, pedido_id, empresas(nome_fantasia)")
    .order("criado_em", { ascending: false })
    .limit(100);
  const notas = (data ?? []) as unknown as Linha[];
  const atencao = notas.filter((n) => n.status === "rejeitada" || n.status === "pendente");

  return (
    <Moldura nome={perfil?.nome || user.email || ""} dona={!!perfil?.dona_grupo}>
      <h1 className="text-2xl font-semibold">Notas fiscais</h1>
      <Bloco titulo={`${atencao.length} precisam de atenção`}>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr><th className="py-1">Data</th><th>Empresa</th><th>Tipo</th><th>Situação</th><th className="text-right">Valor</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {notas.map((n) => (
              <tr key={n.id}>
                <td className="py-2">{new Date(n.criado_em).toLocaleDateString("pt-BR")}</td>
                <td>{n.empresas.nome_fantasia}</td>
                <td><Link href={`/pedidos/${n.pedido_id}`} className="underline">{tipoNota[n.tipo]}{n.numero ? ` nº ${n.numero}` : ""}</Link>{n.ambiente === "homologacao" ? " (teste)" : ""}</td>
                <td className={n.status === "rejeitada" ? "text-red-600" : ""}>{statusNota[n.status]}{n.motivo ? `: ${n.motivo}` : ""}</td>
                <td className="text-right">{reais(n.valor_centavos)}</td>
              </tr>
            ))}
            {!notas.length && <tr><td colSpan={5} className="py-2 text-slate-500">Nenhuma nota ainda.</td></tr>}
          </tbody>
        </table>
      </Bloco>
    </Moldura>
  );
}
