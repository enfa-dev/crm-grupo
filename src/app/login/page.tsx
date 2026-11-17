"use client";

import { useActionState, useState } from "react";
import { entrar } from "./actions";

const campo = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2";

export default function Login() {
  const [estado, acao, enviando] = useActionState(entrar, undefined);
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const criar = modo === "criar";
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form action={acao} className="w-full max-w-sm space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">CRM do Grupo</h1>
        <input type="hidden" name="modo" value={modo} />
        {criar && (
          <label className="block text-sm">Nome<input name="nome" required className={campo} /></label>
        )}
        <label className="block text-sm">E-mail<input name="email" type="email" required className={campo} /></label>
        <label className="block text-sm">Senha<input name="senha" type="password" required minLength={8} className={campo} /></label>
        {estado?.erro && <p className="text-sm text-red-600">{estado.erro}</p>}
        {estado?.aviso && <p className="text-sm text-emerald-700">{estado.aviso}</p>}
        <button disabled={enviando} className="w-full rounded-md bg-slate-900 py-2 text-white disabled:opacity-60">
          {enviando ? "Aguarde..." : criar ? "Criar conta" : "Entrar"}
        </button>
        <button type="button" onClick={() => setModo(criar ? "entrar" : "criar")} className="w-full text-sm text-slate-600 underline">
          {criar ? "Já tenho conta" : "Criar conta"}
        </button>
      </form>
    </main>
  );
}
