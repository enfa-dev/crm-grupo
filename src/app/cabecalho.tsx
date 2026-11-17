import Link from "next/link";
import { sair } from "./login/actions";

export function Cabecalho({ nome, dona }: { nome: string; dona: boolean }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/" className="text-base font-semibold">CRM do Grupo</Link>
          <Link href="/expedicao" className="text-slate-600 hover:text-slate-900">Expedição</Link>
          <Link href="/notas" className="text-slate-600 hover:text-slate-900">Notas fiscais</Link>
        </nav>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-500">{nome}{dona ? " · dona do grupo" : ""}</span>
          <form action={sair}><button className="text-slate-700 underline">Sair</button></form>
        </div>
      </div>
    </header>
  );
}
