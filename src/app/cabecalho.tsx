import Link from "next/link";
import { sair } from "./login/actions";

export function Cabecalho({ nome, dona }: { nome: string; dona: boolean }) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold">CRM do Grupo</Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-500">{nome}{dona ? " · dona do grupo" : ""}</span>
          <form action={sair}><button className="text-slate-700 underline">Sair</button></form>
        </div>
      </div>
    </header>
  );
}
