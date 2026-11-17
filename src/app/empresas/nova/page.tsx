"use client";

import { useActionState } from "react";
import Link from "next/link";
import { criarEmpresa } from "../actions";

const campo = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2";

export default function NovaEmpresa() {
  const [estado, acao, enviando] = useActionState(criarEmpresa, undefined);
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link href="/" className="text-sm text-slate-500">← Voltar</Link>
      <h1 className="mt-2 text-2xl font-semibold">Nova empresa</h1>
      <form action={acao} className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">Nome fantasia<input name="nome_fantasia" required className={campo} /></label>
        <label className="text-sm sm:col-span-2">Razão social<input name="razao_social" className={campo} /></label>
        <label className="text-sm">CNPJ<input name="cnpj" placeholder="00.000.000/0000-00" className={campo} /></label>
        <label className="text-sm">Regime
          <select name="regime" defaultValue="simples_nacional" className={campo}>
            <option value="simples_nacional">Simples Nacional</option>
            <option value="mei">MEI</option>
            <option value="lucro_presumido">Lucro Presumido</option>
            <option value="lucro_real">Lucro Real</option>
          </select>
        </label>
        <label className="text-sm">Anexo do Simples
          <select name="anexo_simples" defaultValue="" className={campo}>
            <option value="">Não sei / não se aplica</option>
            {["I", "II", "III", "IV", "V"].map((a) => <option key={a} value={a}>Anexo {a}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-3 gap-2">
          <label className="col-span-2 text-sm">Município<input name="municipio" className={campo} /></label>
          <label className="text-sm">UF<input name="uf" maxLength={2} className={campo} /></label>
        </div>
        <fieldset className="grid gap-4 border-t border-slate-200 pt-4 sm:col-span-2 sm:grid-cols-2">
          <legend className="text-sm font-medium">CNAE principal</legend>
          <label className="text-sm">Código<input name="cnae" placeholder="0000-0/00" className={campo} /></label>
          <label className="text-sm">Vende
            <select name="operacao" className={campo}>
              <option value="servico">Serviço (NFS-e)</option>
              <option value="produto">Produto (NF-e)</option>
              <option value="ambos">Serviço e produto</option>
            </select>
          </label>
          <label className="text-sm sm:col-span-2">Descrição<input name="cnae_descricao" className={campo} /></label>
        </fieldset>
        {estado?.erro && <p className="text-sm text-red-600 sm:col-span-2">{estado.erro}</p>}
        <button disabled={enviando} className="rounded-md bg-slate-900 py-2 text-white disabled:opacity-60 sm:col-span-2">
          {enviando ? "Salvando..." : "Cadastrar empresa"}
        </button>
      </form>
    </main>
  );
}
