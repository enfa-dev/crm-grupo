// Envia ao provedor as notas pendentes. Chamada por agendamento (pg_cron) ou
// manualmente. Usa a service role: nunca exposta ao navegador.
import { createClient } from "jsr:@supabase/supabase-js@2";
import { enviar, montarPayload, type Cliente, type Empresa, type Item, type Nota } from "../_shared/focus.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const MAX_TENTATIVAS = 5;

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-segredo") !== Deno.env.get("EMISSOR_SEGREDO")) {
    return new Response("não autorizado", { status: 401 });
  }

  const { data: notas, error } = await supabase
    .from("notas_fiscais")
    .select("id, tipo, ambiente, empresa_id, pedido_id, tentativas")
    .eq("status", "pendente")
    .lt("tentativas", MAX_TENTATIVAS)
    .order("criado_em")
    .limit(20);
  if (error) return Response.json({ erro: error.message }, { status: 500 });

  const resultado: Record<string, string> = {};
  for (const nota of notas ?? []) {
    // Marca como processando antes de enviar: outra execução não pega a mesma nota.
    const { data: travada } = await supabase
      .from("notas_fiscais")
      .update({ status: "processando", tentativas: nota.tentativas + 1, atualizado_em: new Date().toISOString() })
      .eq("id", nota.id)
      .eq("status", "pendente")
      .select("id")
      .maybeSingle();
    if (!travada) continue;

    const voltar = async (motivo: string) => {
      await supabase.from("notas_fiscais").update({ status: "pendente", motivo }).eq("id", nota.id);
      resultado[nota.id] = motivo;
    };

    const [{ data: empresa }, { data: fiscal }, { data: token }, { data: pedido }, { data: itens }] = await Promise.all([
      supabase.from("empresas").select("cnpj, razao_social, nome_fantasia, inscricao_municipal, codigo_municipio_ibge").eq("id", nota.empresa_id).single(),
      supabase.from("empresa_fiscal").select("provedor").eq("empresa_id", nota.empresa_id).maybeSingle(),
      supabase.rpc("token_fiscal", { alvo: nota.empresa_id }),
      supabase.from("pedidos").select("clientes(nome, documento, email)").eq("id", nota.pedido_id).single(),
      supabase
        .from("pedido_itens")
        .select("descricao, quantidade, preco_unit_centavos, total_centavos, tipo, itens_catalogo(id, ncm, cfop, unidade, codigo_servico, aliquota_iss)")
        .eq("pedido_id", nota.pedido_id),
    ]);

    if (!empresa?.cnpj) { await voltar("Empresa sem CNPJ cadastrado."); continue; }
    if (fiscal?.provedor !== "focus" || !token) { await voltar("Provedor fiscal não configurado para esta empresa."); continue; }

    const doTipo = (itens ?? []).filter((i) => (nota.tipo === "nfse") === (i.tipo === "servico")) as unknown as Item[];
    const payload = montarPayload(nota as Nota, empresa as Empresa, (pedido?.clientes ?? null) as unknown as Cliente, doTipo);
    const envio = await enviar(nota as Nota, token as string, payload);

    if (envio.ok) {
      await supabase.from("notas_fiscais").update({ provedor_ref: nota.id, motivo: null }).eq("id", nota.id);
      resultado[nota.id] = "enviada";
    } else if (envio.status >= 500) {
      await voltar(`Provedor indisponível (${envio.status}), nova tentativa depois.`);
    } else {
      const motivo = (envio.corpo as { mensagem?: string }).mensagem ?? `Recusada pelo provedor (${envio.status}).`;
      await supabase.from("notas_fiscais").update({ status: "rejeitada", motivo }).eq("id", nota.id);
      resultado[nota.id] = motivo;
    }
  }

  return Response.json({ processadas: Object.keys(resultado).length, resultado });
});
