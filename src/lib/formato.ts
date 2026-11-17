export const reais = (centavos: number | string | null | undefined) =>
  (Number(centavos ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const cnpjFormatado = (cnpj: string | null) =>
  cnpj ? cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : "CNPJ não informado";

export const regimes: Record<string, string> = {
  simples_nacional: "Simples Nacional",
  mei: "MEI",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
};

export const etapas: Record<string, string> = {
  lead: "Lead",
  qualificado: "Qualificado",
  proposta: "Proposta",
  negociacao: "Negociação",
  ganho: "Ganho",
  perdido: "Perdido",
};

export const operacoes: Record<string, string> = { servico: "Serviço", produto: "Produto", ambos: "Serviço e produto" };

export const reaisParaCentavos = (v: FormDataEntryValue | null) =>
  Math.round(Number(String(v ?? "0").replace(/\./g, "").replace(",", ".")) * 100) || 0;
