import Link from "next/link";
import { paginaLogada, Moldura, Bloco, campo } from "@/lib/pagina";
import { criarCliente } from "@/app/operacao-actions";
import { Formulario } from "@/app/formulario";

export default async function Clientes({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, perfil } = await paginaLogada();
  const [{ data: empresa }, { data: clientes }] = await Promise.all([
    supabase.from("empresas").select("nome_fantasia").eq("id", id).maybeSingle(),
    supabase.from("clientes").select("*").eq("empresa_id", id).order("nome"),
  ]);

  return (
    <Moldura nome={perfil?.nome || user.email || ""} dona={!!perfil?.dona_grupo}>
      <div>
        <Link href={`/empresas/${id}`} className="text-sm text-slate-500">← {empresa?.nome_fantasia}</Link>
        <h1 className="mt-2 text-2xl font-semibold">Clientes</h1>
      </div>
      <Bloco titulo="Novo cliente">
        <Formulario acao={criarCliente.bind(null, id)} botao="Adicionar">
          <input name="nome" required placeholder="Nome ou razão social" className={`${campo} flex-1`} />
          <input name="documento" placeholder="CPF ou CNPJ" className={`${campo} w-40`} />
          <input name="email" type="email" placeholder="E-mail" className={`${campo} w-48`} />
          <input name="telefone" placeholder="Telefone" className={`${campo} w-32`} />
          <input name="cidade" placeholder="Cidade" className={`${campo} w-32`} />
          <input name="uf" maxLength={2} placeholder="UF" className={`${campo} w-14`} />
        </Formulario>
      </Bloco>
      <Bloco titulo={`${clientes?.length ?? 0} clientes`}>
        <ul className="divide-y divide-slate-100 text-sm">
          {(clientes ?? []).map((c) => (
            <li key={c.id} className="flex justify-between py-2">
              <span>{c.nome}</span>
              <span className="text-slate-500">{[c.documento, c.email, c.cidade && `${c.cidade}/${c.uf ?? ""}`].filter(Boolean).join(" · ")}</span>
            </li>
          ))}
        </ul>
      </Bloco>
    </Moldura>
  );
}
