"use client";

import { useActionState } from "react";
import { entrar } from "./actions";

export default function Login() {
  const [estado, acao, enviando] = useActionState(entrar, undefined);
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form action={acao} className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">CRM do Grupo</h1>
        <label className="block text-sm">
          E-mail
          <input name="email" type="email" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        <label className="block text-sm">
          Senha
          <input name="senha" type="password" required className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
        </label>
        {estado?.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
        <button disabled={enviando} className="w-full rounded-md bg-slate-900 py-2 text-white disabled:opacity-60">
          {enviando ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </main>
  );
}
