// Recebe do provedor o resultado da autorização das notas.
// Configure no provedor a URL: <projeto>/functions/v1/webhook-fiscal?segredo=<WEBHOOK_FISCAL_SEGREDO>
import { createClient } from "jsr:@supabase/supabase-js@2";
import { traduzirStatus } from "../_shared/focus.ts";

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  const segredo = new URL(req.url).searchParams.get("segredo");
  if (!segredo || segredo !== Deno.env.get("WEBHOOK_FISCAL_SEGREDO")) {
    return new Response("não autorizado", { status: 401 });
  }

  const evento = await req.json().catch(() => null);
  if (!evento?.ref || !evento?.status) return new Response("evento inválido", { status: 400 });

  const status = traduzirStatus(String(evento.status));
  const { error } = await supabase
    .from("notas_fiscais")
    .update({
      status,
      numero: evento.numero ?? evento.numero_rps ?? null,
      chave_acesso: evento.chave_nfe ?? evento.codigo_verificacao ?? null,
      xml_url: evento.caminho_xml_nota_fiscal ?? null,
      pdf_url: evento.caminho_danfe ?? evento.url ?? null,
      motivo: status === "rejeitada" ? (evento.mensagem_sefaz ?? JSON.stringify(evento.erros ?? "Rejeitada")) : null,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", evento.ref);

  if (error) return new Response(error.message, { status: 500 });
  return new Response("ok");
});
