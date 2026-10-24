/**
 * Motor centralizado de cálculos financeiros e operacionais para propostas e viagens da Garcia Turismo.
 * Todas as operações monetárias são processadas em centavos (inteiros) para precisão decimal absoluta.
 */

export const DEFAULT_THRESHOLDS = {
  redMax: 30, // Margem < 30%: Vermelho (prejuízo ou defasado)
  greenMin: 50, // Margem >= 50%: Verde (preço justo / meta atingida)
  targetMargin: 50, // Meta padrão de margem: 50%
  defaultValidityDays: 7, // Validade padrão do orçamento: 7 dias
};

/**
 * Verifica se um valor de input está vazio (não preenchido).
 */
export function isFieldBlank(val) {
  return val === null || val === undefined || (typeof val === "string" && val.trim() === "");
}

/**
 * Converte valor em reais (número ou string) para centavos inteiros.
 * @param {number|string} val
 * @returns {number} centavos inteiros
 */
export function toCents(val) {
  if (val === null || val === undefined || val === "") return 0;
  if (typeof val === "number") return Number.isNaN(val) ? 0 : Math.round(val * 100);

  let str = String(val).trim();
  if (str.includes(",")) {
    str = str.replace(/\./g, "").replace(",", ".");
  }
  str = str.replace(/[^\d.-]/g, "");
  const num = parseFloat(str);
  return Number.isNaN(num) ? 0 : Math.round(num * 100);
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
  if (parts.length !== 3 || parts.some(Number.isNaN)) return "";
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + Number(days));
  return date.toISOString().slice(0, 10);
}

/**
 * Calcula o KM operacional por veículo sem duplicar o total de ida e volta.
 * Km operacional = km total da viagem (ida e volta) + km vazio + deslocamentos no destino.
 */
export function calculateOperationalKm({
  totalKm = 0,
  emptyKm = 0,
  localDisplacementKm = 0,
} = {}) {
  const mainKm = Math.max(0, Number(totalKm) || 0);
  const deadheadKm = Math.max(0, Number(emptyKm) || 0);
  const localKm = Math.max(0, Number(localDisplacementKm) || 0);
  return Number((mainKm + deadheadKm + localKm).toFixed(2));
}

/**
 * Calcula custo de combustível de um único veículo em centavos.
 * Fórmula: (km operacional ÷ consumo km/l) × preço do litro
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
 * Calcula litros e custo de combustível separadamente para cada veículo selecionado,
 * somando os custos individuais sem usar média aritmética simples de consumo
 * e sem multiplicar novamente pela quantidade de veículos.
 */
export function calculateVehiclesFuel({
  operationalKm = 0,
  fuelPricePerLiter = 0,
  vehicles = [],
  consumptionKmPerLiter = 0,
  vehiclesQty = 1,
} = {}) {
  const baseKm = Math.max(0, Number(operationalKm) || 0);
  const dieselPrice = Math.max(0, Number(fuelPricePerLiter) || 0);
  const fallbackConsumption = Number(consumptionKmPerLiter) || 0;

  const effectiveVehicles =
    Array.isArray(vehicles) && vehicles.length > 0
      ? vehicles
      : Array.from({ length: Math.max(1, Number(vehiclesQty) || 1) }, (_, idx) => ({
          id: `v-${idx + 1}`,
          nome: `Veículo ${idx + 1}`,
          consumoKmPorLitro: fallbackConsumption,
          operationalKm: baseKm,
        }));

  let totalLitersExact = 0;
  let totalFuelCents = 0;
  let totalOperationalKm = 0;
  const invalidVehicles = [];

  const breakdowns = effectiveVehicles.map((vehicle, index) => {
    const vehicleKm =
      vehicle.operationalKm !== undefined && vehicle.operationalKm !== null && vehicle.operationalKm !== ""
        ? Math.max(0, Number(vehicle.operationalKm) || 0)
        : baseKm;
    const rawConsumption =
      vehicle.consumoKmPorLitro !== undefined && vehicle.consumoKmPorLitro !== null && vehicle.consumoKmPorLitro !== ""
        ? Number(vehicle.consumoKmPorLitro)
        : Number(vehicle.averageConsumption || vehicle.consumptionKmPerLiter || fallbackConsumption || 0);

    totalOperationalKm += vehicleKm;

    if (!Number.isFinite(rawConsumption) || rawConsumption <= 0) {
      invalidVehicles.push(vehicle.nome || vehicle.modelo || `Veículo ${index + 1}`);
      return {
        id: vehicle.id || `v-${index + 1}`,
        nome: vehicle.nome || vehicle.modelo || `Veículo ${index + 1}`,
        operationalKm: vehicleKm,
        consumoKmPorLitro: 0,
        liters: 0,
        fuelCostCents: 0,
        validConsumption: false,
      };
    }

    const litersExact = vehicleKm > 0 ? vehicleKm / rawConsumption : 0;
    const fuelCostCents = vehicleKm > 0 && dieselPrice > 0 ? Math.round(litersExact * dieselPrice * 100) : 0;

    totalLitersExact += litersExact;
    totalFuelCents += fuelCostCents;

    return {
      id: vehicle.id || `v-${index + 1}`,
      nome: vehicle.nome || vehicle.modelo || `Veículo ${index + 1}`,
      operationalKm: vehicleKm,
      consumoKmPorLitro: rawConsumption,
      liters: Number(litersExact.toFixed(2)),
      fuelCostCents,
      validConsumption: true,
    };
  });

  return {
    breakdowns,
    totalLiters: Number(totalLitersExact.toFixed(2)),
    totalFuelCents,
    totalOperationalKm: Number(totalOperationalKm.toFixed(2)),
    hasInvalidConsumption: invalidVehicles.length > 0,
    invalidVehicles,
  };
}

/**
 * Calcula o custo de um motorista respeitando cobrança por viagem ou por diária explícita.
 */
export function calculateDriverCostCents({
  type = "viagem",
  value = 0,
  days = 1,
} = {}) {
  const unitCents = toCents(value);
  if (unitCents <= 0) return 0;
  const normalizedType = String(type || "viagem").toLowerCase();
  if (normalizedType === "dia" || normalizedType === "diaria" || normalizedType === "diária") {
    const qtyDays = Math.max(0, Number(days) || 0);
    return Math.round(unitCents * qtyDays);
  }
  return unitCents;
}

/**
 * Consolida a soma dos custos diretos da viagem em centavos.
 */
export function calculateDirectCosts({
  totalKm = 0,
  emptyKm = 0,
  localDisplacementKm = 0,
  consumptionKmPerLiter = 0,
  fuelPricePerLiter = 0,
  vehicles = [],
  vehiclesQty = 1,
  motorista1Tipo = "viagem",
  motorista1Valor = 0,
  motorista1Diarias = 1,
  motorista2Tipo = "viagem",
  motorista2Valor = 0,
  motorista2Diarias = 1,
  hospedagem = 0,
  pedagios = 0,
  estacionamento = 0,
  alimentacaoMotoristas = 0,
  antt = 0,
  agua = 0,
  seguro = 0,
  outrosCustos = [],
}) {
  const operationalKm = calculateOperationalKm({ totalKm, emptyKm, localDisplacementKm });
  const fuelData = calculateVehiclesFuel({
    operationalKm,
    fuelPricePerLiter,
    vehicles,
    consumptionKmPerLiter,
    vehiclesQty,
  });

  const combustivelCents = fuelData.totalFuelCents;
  const motorista1Cents = calculateDriverCostCents({
    type: motorista1Tipo,
    value: motorista1Valor,
    days: motorista1Diarias,
  });
  const motorista2Cents = calculateDriverCostCents({
    type: motorista2Tipo,
    value: motorista2Valor,
    days: motorista2Diarias,
  });
  const hospedagemCents = toCents(hospedagem);
  const pedagiosCents = toCents(pedagios);
  const estacionamentoCents = toCents(estacionamento);
  const alimentacaoMotoristasCents = toCents(alimentacaoMotoristas);
  const anttCents = toCents(antt);
  const aguaCents = toCents(agua);
  const seguroCents = toCents(seguro);

  const outrosCents = Array.isArray(outrosCustos)
    ? outrosCustos.reduce((acc, item) => acc + toCents(typeof item === "object" ? item?.valor : item), 0)
    : toCents(outrosCustos);

  const totalDiretoCents =
    combustivelCents +
    motorista1Cents +
    motorista2Cents +
    hospedagemCents +
    pedagiosCents +
    estacionamentoCents +
    alimentacaoMotoristasCents +
    anttCents +
    aguaCents +
    seguroCents +
    outrosCents;

  return {
    combustivelCents,
    litrosCombustivel: fuelData.totalLiters,
    operationalKmPerVehicle: operationalKm,
    totalOperationalKm: fuelData.totalOperationalKm,
    vehicleFuelBreakdowns: fuelData.breakdowns,
    hasInvalidConsumption: fuelData.hasInvalidConsumption,
    invalidVehicles: fuelData.invalidVehicles,
    motorista1Cents,
    motorista2Cents,
    motoristasTotalCents: motorista1Cents + motorista2Cents,
    hospedagemCents,
    pedagiosCents,
    estacionamentoCents,
    alimentacaoMotoristasCents,
    anttCents,
    aguaCents,
    seguroCents,
    outrosCents,
    totalDiretoCents,
  };
}

/**
 * Calcula preço mínimo necessário para atingir a meta de margem desejada.
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
  const normalizedStatus = String(status || "");
  const isExpirado =
    Boolean(validadeCalculada) &&
    dataReferencia > validadeCalculada &&
    normalizedStatus !== "Confirmada" &&
    normalizedStatus !== "Aprovada" &&
    normalizedStatus !== "Realizada" &&
    normalizedStatus !== "Cancelada";

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
 * Centraliza regras entre formulário, indicadores, dados salvos, prévia e PDFs.
 */
export function calculateOrcamento({
  valorBruto,
  desconto = 0,
  valorCobrado = 0,
  manualBaseValue,
  isManualPrice = false,
  pricePerKm = 0,
  vehiclesQty = 1,
  totalKm = 0,
  emptyKm = 0,
  localDisplacementKm = 0,
  vehicles = [],
  capacidadePassageiros = 0,
  passageirosPrevistos = 0,
  consumoKmPerLiter = 0,
  consumptionKmPerLiter,
  fuelPricePerLiter = 0,
  motorista1Tipo = "viagem",
  motorista1Valor = 0,
  motorista1Diarias = 1,
  motorista2Tipo = "viagem",
  motorista2Valor = 0,
  motorista2Diarias = 1,
  hospedagem = 0,
  pedagios = 0,
  estacionamento = 0,
  alimentacaoMotoristas = 0,
  antt = 0,
  agua = 0,
  seguro = 0,
  outrosCustos = [],
  costsConfirmedZero = false,
  requireCompleteCosts = false,
  metaMargemPercent = DEFAULT_THRESHOLDS.targetMargin,
  thresholds = DEFAULT_THRESHOLDS,
}) {
  const operationalKmPerVehicle = calculateOperationalKm({
    totalKm,
    emptyKm,
    localDisplacementKm,
  });

  const qtyVehicles =
    Array.isArray(vehicles) && vehicles.length > 0
      ? vehicles.length
      : Math.max(1, Number(vehiclesQty) || 1);

  const pricePerKmNumber = Math.max(0, Number(pricePerKm) || 0);
  // Preço automático considera a quilometragem operacional de todos os veículos
  const autoTotalKm =
    Array.isArray(vehicles) && vehicles.length > 0
      ? vehicles.reduce(
          (sum, v) =>
            sum +
            (v.operationalKm !== undefined && v.operationalKm !== null && v.operationalKm !== ""
              ? Math.max(0, Number(v.operationalKm) || 0)
              : operationalKmPerVehicle),
          0,
        )
      : operationalKmPerVehicle * qtyVehicles;

  const valorAutomaticoCents = Math.round(autoTotalKm * pricePerKmNumber * 100);
  const descontoCents = Math.max(0, toCents(desconto));

  const hasManualOverride =
    Boolean(isManualPrice) ||
    (manualBaseValue !== undefined && manualBaseValue !== null && manualBaseValue !== "");

  let valorBrutoCents = 0;
  let valorCobradoCents = 0;

  if (valorBruto !== undefined && valorBruto !== null && valorBruto !== "") {
    valorBrutoCents = Math.max(0, toCents(valorBruto));
    valorCobradoCents = Math.max(0, valorBrutoCents - descontoCents);
  } else if (hasManualOverride && manualBaseValue !== undefined && manualBaseValue !== null && manualBaseValue !== "") {
    valorBrutoCents = Math.max(0, toCents(manualBaseValue));
    valorCobradoCents = Math.max(0, valorBrutoCents - descontoCents);
  } else if (valorCobrado !== undefined && valorCobrado !== null && valorCobrado !== "" && toCents(valorCobrado) > 0) {
    valorCobradoCents = Math.max(0, toCents(valorCobrado));
    valorBrutoCents = valorCobradoCents + descontoCents;
  } else if (valorAutomaticoCents > 0) {
    valorBrutoCents = valorAutomaticoCents;
    valorCobradoCents = Math.max(0, valorBrutoCents - descontoCents);
  } else {
    valorCobradoCents = Math.max(0, toCents(valorCobrado));
    valorBrutoCents = valorCobradoCents + descontoCents;
  }

  const finalConsumption =
    consumptionKmPerLiter !== undefined ? consumptionKmPerLiter : consumoKmPerLiter;

  const capacidadeFromVehicles =
    Array.isArray(vehicles) && vehicles.length > 0
      ? vehicles.reduce((acc, v) => acc + Math.max(0, Number(v.capacidade || v.lugares || 0)), 0)
      : 0;
  const capacidade = Math.max(Number(capacidadePassageiros) || capacidadeFromVehicles || 0, 0);
  const passageiros = Math.max(Number(passageirosPrevistos) || 0, 0);

  // Custos Diretos
  const directCosts = calculateDirectCosts({
    totalKm,
    emptyKm,
    localDisplacementKm,
    consumptionKmPerLiter: finalConsumption,
    fuelPricePerLiter,
    vehicles,
    vehiclesQty: qtyVehicles,
    motorista1Tipo,
    motorista1Valor,
    motorista1Diarias,
    motorista2Tipo,
    motorista2Valor,
    motorista2Diarias,
    hospedagem,
    pedagios,
    estacionamento,
    alimentacaoMotoristas,
    antt,
    agua,
    seguro,
    outrosCustos,
  });

  // Verificação de pendências de custos essenciais
  const pendingItems = [];
  const shouldEvaluateCompleteness =
    Boolean(requireCompleteCosts) ||
    operationalKmPerVehicle > 0 ||
    (Array.isArray(vehicles) && vehicles.length > 0);

  if (shouldEvaluateCompleteness) {
    if (directCosts.totalOperationalKm <= 0) {
      pendingItems.push("Distância da viagem (km)");
    }
    if (directCosts.hasInvalidConsumption) {
      pendingItems.push(
        `Consumo (km/L) inválido ou ausente: ${directCosts.invalidVehicles.join(", ")}`,
      );
    }
    if (directCosts.totalOperationalKm > 0 && Number(fuelPricePerLiter || 0) <= 0) {
      pendingItems.push("Preço do diesel (R$/L)");
    }
    if (
      Boolean(requireCompleteCosts) &&
      !costsConfirmedZero &&
      isFieldBlank(motorista1Valor)
    ) {
      pendingItems.push("Custo do Motorista 1 (ou confirme R$ 0,00)");
    }
    if (
      (motorista1Tipo === "dia" || motorista1Tipo === "diaria") &&
      toCents(motorista1Valor) > 0 &&
      Number(motorista1Diarias || 0) <= 0
    ) {
      pendingItems.push("Quantidade de diárias do Motorista 1");
    }
    if (
      (motorista2Tipo === "dia" || motorista2Tipo === "diaria") &&
      toCents(motorista2Valor) > 0 &&
      Number(motorista2Diarias || 0) <= 0
    ) {
      pendingItems.push("Quantidade de diárias do Motorista 2");
    }
  }

  const custosIncompletos = pendingItems.length > 0;
  const custoTotalCents = directCosts.totalDiretoCents;
  const lucroCents = valorCobradoCents - custoTotalCents;

  let margemPercent = 0;
  if (valorCobradoCents > 0) {
    margemPercent = (lucroCents / valorCobradoCents) * 100;
  } else if (custoTotalCents > 0) {
    margemPercent = -100;
  }

  const precoSugeridoMetaCents = custosIncompletos
    ? 0
    : calculateSuggestedPriceForTarget({
        custosDiretosCents: directCosts.totalDiretoCents,
        metaMargemPercent,
      });

  // Base única de KM operacional (soma dos km operacionais dos veículos selecionados)
  const kmBase = directCosts.totalOperationalKm;
  const custoPorKmCents = kmBase > 0 ? Math.round(custoTotalCents / kmBase) : 0;
  const receitaPorKmCents = kmBase > 0 ? Math.round(valorCobradoCents / kmBase) : 0;
  const lucroPorKmCents = kmBase > 0 ? Math.round(lucroCents / kmBase) : 0;

  // Indicadores por poltrona disponível (capacidade total dos veículos selecionados)
  const custoPorPoltronaCents = capacidade > 0 ? Math.round(custoTotalCents / capacidade) : 0;
  const precoPorPoltronaCents = capacidade > 0 ? Math.round(valorCobradoCents / capacidade) : 0;

  // Indicadores por passageiro previsto
  const custoPorPassageiroCents = passageiros > 0 ? Math.round(custoTotalCents / passageiros) : 0;
  const precoPorPassageiroCents = passageiros > 0 ? Math.round(valorCobradoCents / passageiros) : 0;

  let pontoEquilibrioPoltronas = 0;
  if (!custosIncompletos && precoPorPoltronaCents > 0) {
    pontoEquilibrioPoltronas = Math.ceil(custoTotalCents / precoPorPoltronaCents);
  }

  // Ponto de equilíbrio em passageiros somente quando custos estiverem completos e preço unitário > 0
  let pontoEquilibrioPassageiros = 0;
  if (!custosIncompletos && precoPorPassageiroCents > 0) {
    pontoEquilibrioPassageiros = Math.ceil(custoTotalCents / precoPorPassageiroCents);
  } else if (!custosIncompletos && passageiros === 0 && precoPorPoltronaCents > 0) {
    pontoEquilibrioPassageiros = pontoEquilibrioPoltronas;
  }

  const fairPrice = custosIncompletos
    ? {
        status: "incompleto",
        label: "Custos incompletos",
        badgeClass: "badge-fair-warning",
        color: "#64748b",
        descricao: `Preencha os itens pendentes para liberar o diagnóstico de margem: ${pendingItems.join("; ")}.`,
      }
    : getFairPriceStatus(margemPercent, thresholds);

  return {
    // Quilometragem e Combustível
    operationalKmPerVehicle,
    totalOperationalKm: kmBase,
    litrosCombustivel: directCosts.litrosCombustivel,
    vehicleFuelBreakdowns: directCosts.vehicleFuelBreakdowns,

    // Valores absolutos em centavos
    valorAutomaticoCents,
    valorBrutoCents,
    descontoCents,
    valorCobradoCents,
    custoTotalCents,
    lucroCents,
    precoSugeridoMetaCents,
    isManualPrice: hasManualOverride,
    custosIncompletos,
    pendingItems,
    custosDetalhados: {
      ...directCosts,
    },

    // Valores em Reais
    valorAutomatico: fromCents(valorAutomaticoCents),
    valorBruto: fromCents(valorBrutoCents),
    desconto: fromCents(descontoCents),
    valorCobrado: fromCents(valorCobradoCents),
    custoTotal: fromCents(custoTotalCents),
    lucro: fromCents(lucroCents),
    precoSugeridoMeta: fromCents(precoSugeridoMetaCents),

    // Margens e percentuais
    margemPercent: Number(margemPercent.toFixed(2)),
    metaMargemPercent,

    // Métricas por km
    custoPorKmCents,
    receitaPorKmCents,
    lucroPorKmCents,
    custoPorKm: fromCents(custoPorKmCents),
    receitaPorKm: fromCents(receitaPorKmCents),
    lucroPorKm: fromCents(lucroPorKmCents),

    // Métricas por poltrona disponível
    custoPorPoltronaCents,
    precoPorPoltronaCents,
    custoPorPoltrona: fromCents(custoPorPoltronaCents),
    precoPorPoltrona: fromCents(precoPorPoltronaCents),
    pontoEquilibrioPoltronas,

    // Métricas por passageiro previsto
    custoPorPassageiroCents,
    precoPorPassageiroCents,
    custoPorPassageiro: fromCents(custoPorPassageiroCents),
    precoPorPassageiro: fromCents(precoPorPassageiroCents),
    pontoEquilibrioPassageiros,

    // Classificação da barra
    fairPrice,
  };
}
