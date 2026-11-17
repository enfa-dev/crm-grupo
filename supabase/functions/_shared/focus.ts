// Adaptador do provedor Focus NFe (https://focusnfe.com.br/doc/).
// ATENÇÃO: o mapeamento de campos abaixo é o ponto de partida. Antes de ligar
// em produção, validar com a contabilidade (CFOP, CST/CSOSN, alíquotas, ISS)
// e com a documentação do provedor escolhido.

export type Nota = {
  id: string;
  tipo: "nfse" | "nfe" | "nfce";
  ambiente: "homologacao" | "producao";
};

export type Empresa = {
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string;
  inscricao_municipal: string | null;
  codigo_municipio_ibge: string | null;
};

export type Cliente = { nome: string; documento: string | null; email: string | null } | null;

export type Item = {
  descricao: string;
  quantidade: number;
  preco_unit_centavos: number;
  total_centavos: number;
  itens_catalogo: {
    id: string;
    ncm: string | null;
    cfop: string;
    unidade: string;
    codigo_servico: string | null;
    aliquota_iss: number | null;
  };
};

const reais = (c: number) => Number((c / 100).toFixed(2));
const base = (amb: Nota["ambiente"]) =>
  amb === "producao" ? "https://api.focusnfe.com.br" : "https://homologacao.focusnfe.com.br";

export function montarPayload(nota: Nota, empresa: Empresa, cliente: Cliente, itens: Item[]) {
  const agora = new Date().toISOString();
  const doc = cliente?.documento ?? null;
  const destinatario = doc
    ? doc.length === 14 ? { cnpj_destinatario: doc } : { cpf_destinatario: doc }
    : {};

  if (nota.tipo === "nfse") {
    const total = itens.reduce((s, i) => s + i.total_centavos, 0);
    const primeiro = itens[0].itens_catalogo;
    return {
      data_emissao: agora,
      prestador: {
        cnpj: empresa.cnpj,
        inscricao_municipal: empresa.inscricao_municipal,
        codigo_municipio: empresa.codigo_municipio_ibge,
      },
      tomador: doc
        ? { ...(doc.length === 14 ? { cnpj: doc } : { cpf: doc }), razao_social: cliente?.nome, email: cliente?.email }
        : undefined,
      servico: {
        valor_servicos: reais(total),
        discriminacao: itens.map((i) => `${i.quantidade} x ${i.descricao}`).join("; "),
        item_lista_servico: primeiro.codigo_servico,
        aliquota: primeiro.aliquota_iss,
        iss_retido: false,
      },
      optante_simples_nacional: true,
    };
  }

  return {
    natureza_operacao: "Venda de mercadoria",
    data_emissao: agora,
    tipo_documento: 1,
    finalidade_emissao: 1,
    cnpj_emitente: empresa.cnpj,
    nome_destinatario: cliente?.nome,
    ...destinatario,
    presenca_comprador: nota.tipo === "nfce" ? 1 : 2,
    modalidade_frete: 9,
    items: itens.map((i, n) => ({
      numero_item: n + 1,
      codigo_produto: i.itens_catalogo.id.slice(0, 8),
      descricao: i.descricao,
      cfop: i.itens_catalogo.cfop,
      unidade_comercial: i.itens_catalogo.unidade,
      quantidade_comercial: i.quantidade,
      valor_unitario_comercial: reais(i.preco_unit_centavos),
      valor_bruto: reais(i.total_centavos),
      codigo_ncm: i.itens_catalogo.ncm,
      icms_origem: 0,
      icms_situacao_tributaria: "102", // CSOSN Simples Nacional sem crédito
      pis_situacao_tributaria: "07",
      cofins_situacao_tributaria: "07",
    })),
  };
}

export async function enviar(nota: Nota, token: string, payload: unknown) {
  const resp = await fetch(`${base(nota.ambiente)}/v2/${nota.tipo}?ref=${nota.id}`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${token}:`)}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const corpo = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, corpo };
}

// Status do provedor -> status interno
export function traduzirStatus(s: string): "processando" | "autorizada" | "rejeitada" | "cancelada" {
  if (s === "autorizado") return "autorizada";
  if (s === "cancelado") return "cancelada";
  if (s.startsWith("erro")) return "rejeitada";
  return "processando";
}
