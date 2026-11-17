"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const digitos = (v: FormDataEntryValue | null) => String(v ?? "").replace(/\D/g, "");

export async function criarEmpresa(_: { erro?: string } | undefined, form: FormData) {
  const supabase = await createClient();
  const cnpj = digitos(form.get("cnpj"));
  if (cnpj && cnpj.length !== 14) return { erro: "CNPJ deve ter 14 dígitos." };

  const { data: empresa, error } = await supabase
    .from("empresas")
    .insert({
      nome_fantasia: String(form.get("nome_fantasia") ?? "").trim(),
      razao_social: String(form.get("razao_social") ?? "").trim() || null,
      cnpj: cnpj || null,
      regime: String(form.get("regime") ?? "simples_nacional"),
      anexo_simples: String(form.get("anexo_simples") ?? "") || null,
      municipio: String(form.get("municipio") ?? "").trim() || null,
      uf: String(form.get("uf") ?? "").trim().toUpperCase() || null,
    })
    .select("id")
    .single();
  if (error || !empresa) return { erro: error?.message ?? "Não foi possível salvar." };

  const cnae = digitos(form.get("cnae"));
  if (cnae) {
    const { error: erroCnae } = await supabase.from("empresa_cnaes").insert({
      empresa_id: empresa.id,
      codigo: cnae,
      descricao: String(form.get("cnae_descricao") ?? "").trim(),
      principal: true,
      operacao: String(form.get("operacao") ?? "servico"),
    });
    if (erroCnae) return { erro: `Empresa criada, mas o CNAE falhou: ${erroCnae.message}` };
  }

  revalidatePath("/");
  redirect(`/empresas/${empresa.id}`);
}

export async function adicionarCnae(empresaId: string, form: FormData) {
  const supabase = await createClient();
  await supabase.from("empresa_cnaes").insert({
    empresa_id: empresaId,
    codigo: digitos(form.get("codigo")),
    descricao: String(form.get("descricao") ?? "").trim(),
    principal: false,
    operacao: String(form.get("operacao") ?? "servico"),
  });
  revalidatePath(`/empresas/${empresaId}`);
}
