export function formatCurrency(value = 0) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function formatDate(value) {
  if (!value) return "-";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("pt-BR");
}

export function currentDateISO() {
  return new Date().toISOString().slice(0, 10);
}

export function currentMonthISO() {
  return new Date().toISOString().slice(0, 7);
}

export function categoryLabel(value) {
  const labels = {
    pecas_manutencao: "Peças e manutenção",
    materiais_limpeza: "Materiais de limpeza",
    salarios_adiantamentos: "Salários / Adiantamentos",
    viagens_extras: "Viagens por fora (Extras)",
    alimentacao: "Alimentação",
    pedagio: "Pedágio",
    hospedagem: "Hospedagem",
    outros: "Outros",
    combustivel: "Abastecimento",
  };

  return labels[value] || value || "-";
}

export function paymentLabel(value) {
  const labels = {
    pix: "PIX",
    dinheiro: "Dinheiro",
    cartao_credito: "Cartão de crédito",
    cheque: "Cheque",
  };

  return labels[value] || value || "-";
}
