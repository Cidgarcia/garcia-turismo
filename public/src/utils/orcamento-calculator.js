/**
 * Motor de cálculos financeiros para orçamentos da Garcia Turismo.
 * Todas as operações monetárias são processadas em centavos (inteiros) para precisão decimal absoluta.
 */

export const DEFAULT_THRESHOLDS = {
  redMax: 30, // Margem < 30%: Vermelho (prejuízo ou defasado)
  greenMin: 50, // Margem >= 50%: Verde (preço justo / meta atingida)
  targetMargin: 50, // Meta padrão de margem: 50%
  defaultValidityDays: 7, // Validade padrão do orçamento: 7 dias
};

/**
 * Converte valor em reais (número ou string) para centavos inteiros.
 * @param {number|string} val
 * @returns {number} centavos inteiros
 */
export function toCents(val) {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : Math.round(val * 100);

  let str = String(val).trim();
  if (str.includes(",")) {
    str = str.replace(/\./g, "").replace(",", ".");
  }
  str = str.replace(/[^\d.-]/g, "");
  const num = parseFloat(str);
  return isNaN(num) ? 0 : Math.round(num * 100);
}

/**
 * Converte centavos inteiros para número em reais.
 * @param {number} cents
 * @returns {number}
 */
export function fromCents(cents) {
  return (Number(cents) || 0) / 100;
}

/**
 * Formata centavos em string de moeda brasileira (R$ 1.234,50).
 * @param {number} cents
 * @returns {string}
 */
export function formatCurrencyFromCents(cents) {
  const value = fromCents(cents);
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/**
 * Formata data ISO (YYYY-MM-DD) para padrão brasileiro (DD/MM/AAAA).
 * @param {string} isoDate
 * @returns {string}
 */
export function formatDateBR(isoDate) {
  if (!isoDate || typeof isoDate !== "string") return "-";
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return "-";
  return `${day.padStart(2, "0")}/${month.padStart(2, "0")}/${year}`;
}

/**
 * Adiciona dias a uma data no formato YYYY-MM-DD.
 * @param {string} isoDate
 * @param {number} days
 * @returns {string}
 */
export function addDaysISO(isoDate, days = 7) {
  if (!isoDate || typeof isoDate !== "string") return "";
  const parts = isoDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return "";
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + Number(days));
  return date.toISOString().slice(0, 10);
}

/**
 * Calcula custo de combustível em centavos.
 * Fórmula: (km ÷ consumo km/l) × preço do litro
 */
export function calculateFuelCost({ totalKm, consumptionKmPerLiter, fuelPricePerLiter }) {
  const km = Number(totalKm) || 0;
  const consumption = Number(consumptionKmPerLiter) || 0;
  const price = Number(fuelPricePerLiter) || 0;

  if (km <= 0 || consumption <= 0 || price <= 0) return 0;
  const liters = km / consumption;
  return Math.round(liters * price * 100);
}

/**
 * Consolida a soma dos custos diretos da viagem em centavos.
 */
export function calculateDirectCosts({
  totalKm = 0,
  consumptionKmPerLiter = 0,
  fuelPricePerLiter = 0,
  motorista1Valor = 0,
  motorista2Valor = 0,
  hospedagem = 0,
  antt = 0,
  agua = 0,
  seguro = 0,
  outrosCustos = [],
}) {
  const combustivelCents = calculateFuelCost({ totalKm, consumptionKmPerLiter, fuelPricePerLiter });
  const motorista1Cents = toCents(motorista1Valor);
  const motorista2Cents = toCents(motorista2Valor);
  const hospedagemCents = toCents(hospedagem);
  const anttCents = toCents(antt);
  const aguaCents = toCents(agua);
  const seguroCents = toCents(seguro);

  const outrosCents = Array.isArray(outrosCustos)
    ? outrosCustos.reduce((acc, item) => acc + toCents(item?.valor), 0)
    : 0;

  const totalDiretoCents =
    combustivelCents +
    motorista1Cents +
    motorista2Cents +
    hospedagemCents +
    anttCents +
    aguaCents +
    seguroCents +
    outrosCents;

  return {
    combustivelCents,
    motorista1Cents,
    motorista2Cents,
    motoristasTotalCents: motorista1Cents + motorista2Cents,
    hospedagemCents,
    anttCents,
    aguaCents,
    seguroCents,
    outrosCents,
    totalDiretoCents,
  };
}

/**
 * Calcula preço mínimo necessário para atingir a meta de margem desejada.
 * Fórmula purificada de impostos:
 *   lucro = valorCobrado - custosDiretos
 *   metaMargem = lucro / valorCobrado
 *   valorCobrado * (1 - metaMargem) = custosDiretos
 *   valorCobrado = custosDiretos / (1 - metaMargem)
 */
export function calculateSuggestedPriceForTarget({
  custosDiretosCents,
  metaMargemPercent = 50,
}) {
  const directCents = Number(custosDiretosCents) || 0;
  if (directCents <= 0) return 0;

  const metaDecimal = (Number(metaMargemPercent) || 0) / 100;
  const divisor = 1 - metaDecimal;

  if (divisor <= 0) return 0;
  return Math.round(directCents / divisor);
}

/**
 * Classifica a faixa de Preço Justo com base na margem obtida.
 */
export function getFairPriceStatus(marginPercent, thresholds = DEFAULT_THRESHOLDS) {
  const margin = Number(marginPercent) || 0;
  const redMax = thresholds.redMax ?? DEFAULT_THRESHOLDS.redMax;
  const greenMin = thresholds.greenMin ?? DEFAULT_THRESHOLDS.greenMin;

  if (margin < redMax) {
    return {
      status: "vermelho",
      label: margin < 0 ? "Prejuízo" : "Viagem Defasada",
      badgeClass: "badge-fair-danger",
      color: "#ef4444",
      descricao: "Margem abaixo de 30%. O valor cobrado compromete a sustentabilidade da viagem.",
    };
  }

  if (margin < greenMin) {
    return {
      status: "amarelo",
      label: "Abaixo da Meta",
      badgeClass: "badge-fair-warning",
      color: "#f59e0b",
      descricao: "Margem entre 30% e 49,9%. Cobre os custos, mas fica abaixo da meta de 50%.",
    };
  }

  return {
    status: "verde",
    label: "Preço Justo",
    badgeClass: "badge-fair-success",
    color: "#10b981",
    descricao: "Margem igual ou superior a 50%. Preço competitivo com lucratividade ideal.",
  };
}

/**
 * Avalia o status e a expiração do orçamento.
 */
export function evaluateOrcamentoValidity({
  dataEmissao,
  diasValidade = DEFAULT_THRESHOLDS.defaultValidityDays,
  status = "rascunho",
  dataReferencia = new Date().toISOString().slice(0, 10),
}) {
  const validadeCalculada = addDaysISO(dataEmissao, diasValidade);
  const isExpirado =
    Boolean(validadeCalculada) &&
    dataReferencia > validadeCalculada &&
    status !== "Confirmada" &&
    status !== "Realizada" &&
    status !== "Cancelada";

  return {
    dataEmissao,
    diasValidade,
    dataValidade: validadeCalculada,
    isExpirado,
    statusExibicao: isExpirado ? "Expirada" : status,
  };
}

/**
 * Função principal de cálculo do orçamento.
 * Retorna todos os indicadores financeiros e operacionais com tratamento de divisão por zero.
 */
export function calculateOrcamento({
  valorCobrado = 0,
  totalKm = 0,
  capacidadePassageiros = 0,
  consumoKmPerLiter = 0,
  consumptionKmPerLiter,
  fuelPricePerLiter = 0,
  motorista1Valor = 0,
  motorista2Valor = 0,
  hospedagem = 0,
  antt = 0,
  agua = 0,
  seguro = 0,
  outrosCustos = [],
  metaMargemPercent = DEFAULT_THRESHOLDS.targetMargin,
  thresholds = DEFAULT_THRESHOLDS,
}) {
  const valorCobradoCents = toCents(valorCobrado);
  const km = Math.max(Number(totalKm) || 0, 0);
  const capacidade = Math.max(Number(capacidadePassageiros) || 0, 0);
  const finalConsumption = consumptionKmPerLiter !== undefined ? consumptionKmPerLiter : consumoKmPerLiter;

  // Custos Diretos
  const directCosts = calculateDirectCosts({
    totalKm: km,
    consumptionKmPerLiter: finalConsumption,
    fuelPricePerLiter,
    motorista1Valor,
    motorista2Valor,
    hospedagem,
    antt,
    agua,
    seguro,
    outrosCustos,
  });

  // Custo Total = Apenas custos diretos
  const custoTotalCents = directCosts.totalDiretoCents;

  // Lucro = Valor Cobrado - Custo Total
  const lucroCents = valorCobradoCents - custoTotalCents;

  // Margem % = (Lucro / Valor Cobrado) * 100 (Margem sobre a receita, não markup)
  let margemPercent = 0;
  if (valorCobradoCents > 0) {
    margemPercent = (lucroCents / valorCobradoCents) * 100;
  } else if (custoTotalCents > 0) {
    margemPercent = -100;
  }

  // Preço mínimo sugerido para atingir a meta (ex: 50%)
  const precoSugeridoMetaCents = calculateSuggestedPriceForTarget({
    custosDiretosCents: directCosts.totalDiretoCents,
    metaMargemPercent,
  });

  // Indicadores unitários (tratam divisão por zero)
  const custoPorKmCents = km > 0 ? Math.round(custoTotalCents / km) : 0;
  const receitaPorKmCents = km > 0 ? Math.round(valorCobradoCents / km) : 0;
  const lucroPorKmCents = km > 0 ? Math.round(lucroCents / km) : 0;

  const custoPorPoltronaCents = capacidade > 0 ? Math.round(custoTotalCents / capacidade) : 0;
  const precoPorPoltronaCents = capacidade > 0 ? Math.round(valorCobradoCents / capacidade) : 0;

  // Ponto de equilíbrio em poltronas (quantas poltronas precisam ser vendidas para pagar o custo total)
  let pontoEquilibrioPoltronas = 0;
  if (precoPorPoltronaCents > 0) {
    pontoEquilibrioPoltronas = Math.ceil(custoTotalCents / precoPorPoltronaCents);
  }

  // Classificação da barra de Preço Justo
  const fairPrice = getFairPriceStatus(margemPercent, thresholds);

  return {
    // Valores absolutos em centavos
    valorCobradoCents,
    custoTotalCents,
    lucroCents,
    precoSugeridoMetaCents,
    custosDetalhados: {
      ...directCosts,
    },

    // Valores em Reais (Float para exibição formatada se necessário)
    valorCobrado: fromCents(valorCobradoCents),
    custoTotal: fromCents(custoTotalCents),
    lucro: fromCents(lucroCents),
    precoSugeridoMeta: fromCents(precoSugeridoMetaCents),

    // Margens e percentuais
    margemPercent: Number(margemPercent.toFixed(2)),
    metaMargemPercent,

    // Métricas por km e por poltrona
    custoPorKmCents,
    receitaPorKmCents,
    lucroPorKmCents,
    custoPorKm: fromCents(custoPorKmCents),
    receitaPorKm: fromCents(receitaPorKmCents),
    lucroPorKm: fromCents(lucroPorKmCents),

    custoPorPoltronaCents,
    precoPorPoltronaCents,
    custoPorPoltrona: fromCents(custoPorPoltronaCents),
    precoPorPoltrona: fromCents(precoPorPoltronaCents),
    pontoEquilibrioPoltronas,

    // Classificação da barra
    fairPrice,
  };
}
