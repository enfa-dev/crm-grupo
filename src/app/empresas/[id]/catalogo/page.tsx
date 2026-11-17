import Link from "next/link";
import { paginaLogada, Moldura, Bloco, campo } from "@/lib/pagina";
import { reais } from "@/lib/formato";
import { criarItem } from "@/app/operacao-actions";
import { Formulario } from "@/app/formulario";

export default async function Catalogo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, perfil } = await paginaLogada();
  const [{ data: empresa }, { data: itens }] = await Promise.all([
    supabase.from("empresas").select("nome_fantasia").eq("id", id).maybeSingle(),
    supabase.from("itens_catalogo").select("*").eq("empresa_id", id).order("nome"),
  ]);

  return (
    <Moldura nome={perfil?.nome || user.email || ""} dona={!!perfil?.dona_grupo}>
      <div>
        <Link href={`/empresas/${id}`} className="text-sm text-slate-500">← {empresa?.nome_fantasia}</Link>
        <h1 className="mt-2 text-2xl font-semibold">Catálogo de produtos e serviços</h1>
      </div>

      <Bloco titulo="Novo item">
        <Formulario acao={criarItem.bind(null, id)} botao="Adicionar">
          <select name="tipo" className={campo}>
            <option value="servico">Serviço</option>
            <option value="produto">Produto</option>
          </select>
          <input name="nome" required placeholder="Nome" className={`${campo} flex-1`} />
          <input name="preco" placeholder="Preço (R$)" className={`${campo} w-28`} />
          <input name="codigo_servico" placeholder="Cód. serviço (LC 116)" className={`${campo} w-40`} />
          <input name="aliquota_iss" placeholder="ISS %" className={`${campo} w-20`} />
          <input name="ncm" placeholder="NCM (produto)" className={`${campo} w-32`} />
          <input name="cfop" placeholder="CFOP" className={`${campo} w-20`} />
        </Formulario>
        <p className="mt-2 text-xs text-slate-500">Serviço usa código LC 116 e ISS; produto usa NCM e CFOP. Confirme os códigos com a contabilidade.</p>
      </Bloco>

      <Bloco titulo={`${itens?.length ?? 0} itens`}>
        <table className="w-full text-sm">
          <thead className="text-left text-slate-500">
            <tr><th className="py-1">Nome</th><th>Tipo</th><th>Código fiscal</th><th className="text-right">Preço</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(itens ?? []).map((i) => (
              <tr key={i.id}>
                <td className="py-2">{i.nome}</td>
                <td>{i.tipo === "servico" ? "Serviço" : "Produto"}</td>
                <td className="text-slate-500">{i.tipo === "servico" ? `LC ${i.codigo_servico}${i.aliquota_iss != null ? ` · ISS ${i.aliquota_iss}%` : ""}` : `NCM ${i.ncm} · CFOP ${i.cfop}`}</td>
                <td className="text-right">{reais(i.preco_centavos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Bloco>
    </Moldura>
  );
}
