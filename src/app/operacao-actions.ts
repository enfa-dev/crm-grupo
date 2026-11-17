"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { reaisParaCentavos } from "@/lib/formato";

const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const digitos = (f: FormData, k: string) => txt(f, k).replace(/\D/g, "");

export type Estado = { erro?: string } | undefined;

export async function criarItem(empresaId: string, _: Estado, f: FormData): Promise<Estado> {
  const supabase = await createClient();
  const tipo = txt(f, "tipo");
  const { error } = await supabase.from("itens_catalogo").insert({
    empresa_id: empresaId,
    tipo,
    nome: txt(f, "nome"),
    preco_centavos: reaisParaCentavos(f.get("preco")),
    ncm: tipo === "produto" ? digitos(f, "ncm") || null : null,
    cfop: tipo === "produto" ? digitos(f, "cfop") || "5102" : "5102",
    codigo_servico: tipo === "servico" ? txt(f, "codigo_servico") || null : null,
    aliquota_iss: tipo === "servico" && txt(f, "aliquota_iss") ? Number(txt(f, "aliquota_iss").replace(",", ".")) : null,
  });
  if (error) {
    if (error.message.includes("ncm")) return { erro: "Produto precisa de NCM com 8 dígitos." };
    if (error.message.includes("codigo_servico")) return { erro: "Serviço precisa do código de serviço (LC 116)." };
    return { erro: error.message };
  }
  revalidatePath(`/empresas/${empresaId}/catalogo`);
  return undefined;
}

export async function criarCliente(empresaId: string, _: Estado, f: FormData): Promise<Estado> {
  const supabase = await createClient();
  const documento = digitos(f, "documento");
  if (documento && documento.length !== 11 && documento.length !== 14) return { erro: "CPF ou CNPJ inválido." };
  const { error } = await supabase.from("clientes").insert({
    empresa_id: empresaId,
    nome: txt(f, "nome"),
    documento: documento || null,
    email: txt(f, "email") || null,
    telefone: txt(f, "telefone") || null,
    cidade: txt(f, "cidade") || null,
    uf: txt(f, "uf").toUpperCase() || null,
  });
  if (error) return { erro: error.message };
  revalidatePath(`/empresas/${empresaId}/clientes`);
  return undefined;
}

export async function criarPedido(empresaId: string, f: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pedidos")
    .insert({
      empresa_id: empresaId,
      cliente_id: txt(f, "cliente_id") || null,
      consumidor_final: f.get("consumidor_final") === "on",
      observacoes: txt(f, "observacoes") || null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Não foi possível criar o pedido.");
  redirect(`/pedidos/${data.id}`);
}

export async function adicionarItemPedido(pedidoId: string, _: Estado, f: FormData): Promise<Estado> {
  const supabase = await createClient();
  const itemId = txt(f, "item_id");
  const { data: item } = await supabase.from("itens_catalogo").select("preco_centavos, empresa_id, tipo, nome").eq("id", itemId).single();
  if (!item) return { erro: "Item não encontrado." };
  const preco = txt(f, "preco") ? reaisParaCentavos(f.get("preco")) : item.preco_centavos;
  const { error } = await supabase.from("pedido_itens").insert({
    pedido_id: pedidoId,
    item_id: itemId,
    empresa_id: item.empresa_id,
    tipo: item.tipo,
    descricao: item.nome,
    quantidade: Number(txt(f, "quantidade").replace(",", ".")) || 1,
    preco_unit_centavos: preco,
  });
  if (error) return { erro: error.message };
  revalidatePath(`/pedidos/${pedidoId}`);
  return undefined;
}

export async function removerItemPedido(pedidoId: string, itemPedidoId: string) {
  const supabase = await createClient();
  await supabase.from("pedido_itens").delete().eq("id", itemPedidoId);
  revalidatePath(`/pedidos/${pedidoId}`);
}

export async function faturarPedido(pedidoId: string): Promise<Estado> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("faturar_pedido", { alvo: pedidoId });
  if (error) return { erro: error.message };
  revalidatePath(`/pedidos/${pedidoId}`);
  revalidatePath("/");
  return undefined;
}

export async function cancelarPedido(pedidoId: string) {
  const supabase = await createClient();
  await supabase.from("pedidos").update({ status: "cancelado" }).eq("id", pedidoId).eq("status", "rascunho");
  revalidatePath(`/pedidos/${pedidoId}`);
}

export async function atualizarExpedicao(expedicaoId: string, f: FormData) {
  const supabase = await createClient();
  await supabase
    .from("expedicoes")
    .update({
      status: txt(f, "status"),
      transportadora: txt(f, "transportadora") || null,
      codigo_rastreio: txt(f, "codigo_rastreio") || null,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", expedicaoId);
  revalidatePath("/expedicao");
}
