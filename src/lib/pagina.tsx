import { redirect } from "next/navigation";
import { usuarioAtual } from "@/lib/supabase/server";
import { Cabecalho } from "@/app/cabecalho";

export async function paginaLogada() {
  const ctx = await usuarioAtual();
  if (!ctx.user) redirect("/login");
  return ctx as typeof ctx & { user: NonNullable<typeof ctx.user> };
}

export function Moldura({ nome, dona, children }: { nome: string; dona: boolean; children: React.ReactNode }) {
  return (
    <>
      <Cabecalho nome={nome} dona={dona} />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">{children}</main>
    </>
  );
}

export function Bloco({ titulo, children, acao }: { titulo: string; children: React.ReactNode; acao?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{titulo}</h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

export const campo = "rounded-md border border-slate-300 px-2 py-1";
export const botao = "rounded-md bg-slate-900 px-3 py-1 text-white";

export const statusNota: Record<string, string> = {
  pendente: "Pendente",
  processando: "Processando",
  autorizada: "Autorizada",
  rejeitada: "Rejeitada",
  cancelada: "Cancelada",
};
export const statusPedido: Record<string, string> = {
  rascunho: "Rascunho",
  confirmado: "Confirmado",
  faturado: "Faturado",
  cancelado: "Cancelado",
};
export const statusExpedicao: Record<string, string> = {
  a_separar: "A separar",
  separado: "Separado",
  enviado: "Enviado",
  entregue: "Entregue",
};
export const tipoNota: Record<string, string> = { nfse: "NFS-e", nfe: "NF-e", nfce: "NFC-e" };
