"use client";

import { useActionState } from "react";
import type { Estado } from "./operacao-actions";

// Formulário com mensagem de erro vinda de uma server action.
export function Formulario({
  acao,
  children,
  botao,
  className = "flex flex-wrap items-end gap-2 text-sm",
}: {
  acao: (estado: Estado, form: FormData) => Promise<Estado>;
  children: React.ReactNode;
  botao: string;
  className?: string;
}) {
  const [estado, enviar, enviando] = useActionState(acao, undefined);
  return (
    <form action={enviar} className={className}>
      {children}
      <button disabled={enviando} className="rounded-md bg-slate-900 px-3 py-1 text-white disabled:opacity-60">
        {enviando ? "Aguarde..." : botao}
      </button>
      {estado?.erro && <p className="w-full text-sm text-red-600">{estado.erro}</p>}
    </form>
  );
}
