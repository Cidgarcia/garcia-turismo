import assert from "node:assert/strict";
import test from "node:test";

import {
  addDaysISO,
  calculateDirectCosts,
  calculateFuelCost,
  calculateOrcamento,
  calculateSuggestedPriceForTarget,
  evaluateOrcamentoValidity,
  formatCurrencyFromCents,
  formatDateBR,
  fromCents,
  getFairPriceStatus,
  toCents,
} from "../public/src/utils/orcamento-calculator.js";

test("conversão de centavos e formatação mantêm precisão monetária", () => {
  assert.equal(toCents(1234.56), 123456);
  assert.equal(toCents("1.234,56"), 123456);
  assert.equal(toCents("R$ 2.500,00"), 250000);
  assert.equal(toCents(""), 0);
  assert.equal(toCents(null), 0);
  assert.equal(fromCents(123456), 1234.56);
  assert.equal(formatCurrencyFromCents(123456).replace(/\s/g, " "), "R$ 1.234,56");
  assert.equal(formatDateBR("2026-10-15"), "15/10/2026");
  assert.equal(formatDateBR(""), "-");
  assert.equal(addDaysISO("2026-10-09", 7), "2026-10-16");
});

test("cálculo de combustível e manutenção calcula proporcionalmente por km", () => {
  // 350 km a 3.5 km/l com diesel a R$ 6.20/l = 100 litros * 6.20 = R$ 620,00 = 62000 cents
  const fuelCents = calculateFuelCost({
    totalKm: 350,
    consumptionKmPerLiter: 3.5,
    fuelPricePerLiter: 6.2,
  });
  assert.equal(fuelCents, 62000);
});

test("teste de margem exata de 50%", () => {
  // Custos totais = R$ 1.000,00 (100000 cents). Se cobrarmos R$ 2.000,00 (200000 cents):
  // Lucro = R$ 1.000,00. Margem sobre preço = 1.000 / 2.000 * 100 = 50.00%
  const result = calculateOrcamento({
    valorCobrado: 2000,
    motorista1Valor: 500,
    hospedagem: 300,
    agua: 200,
    metaMargemPercent: 50,
  });

  assert.equal(result.custoTotalCents, 100000);
  assert.equal(result.lucroCents, 100000);
  assert.equal(result.margemPercent, 50);
  assert.equal(result.fairPrice.status, "verde");
  assert.equal(result.fairPrice.label, "Preço Justo");
});

test("teste de preço mínimo sugerido garante exatamente a meta de margem (50%)", () => {
  const directCostsCents = 150000; // R$ 1.500,00 de custos
  const suggestedPriceCents = calculateSuggestedPriceForTarget({
    custosDiretosCents: directCostsCents,
    metaMargemPercent: 50,
  });

  assert.equal(suggestedPriceCents, 300000); // R$ 3.000,00

  // Validando com calculateOrcamento aplicando o preço sugerido
  const validation = calculateOrcamento({
    valorCobrado: fromCents(suggestedPriceCents),
    motorista1Valor: 1500,
    metaMargemPercent: 50,
  });

  assert.equal(validation.margemPercent, 50);
  assert.equal(validation.fairPrice.status, "verde");
});

test("teste de margem negativa (prejuízo)", () => {
  // Custo = R$ 1.200,00, Cobrado = R$ 1.000,00. Prejuízo = R$ 200,00 (-20%)
  const result = calculateOrcamento({
    valorCobrado: 1000,
    motorista1Valor: 1200,
  });

  assert.equal(result.lucroCents, -20000);
  assert.equal(result.margemPercent, -20);
  assert.equal(result.fairPrice.status, "vermelho");
  assert.equal(result.fairPrice.label, "Prejuízo");
});

test("classificação das faixas de Preço Justo", () => {
  assert.equal(getFairPriceStatus(15).status, "vermelho");
  assert.equal(getFairPriceStatus(29.9).status, "vermelho");
  assert.equal(getFairPriceStatus(30).status, "amarelo");
  assert.equal(getFairPriceStatus(49.9).status, "amarelo");
  assert.equal(getFairPriceStatus(50).status, "verde");
  assert.equal(getFairPriceStatus(65).status, "verde");
});

test("tratamento de divisão por zero (valor cobrado = 0, capacidade = 0, km = 0)", () => {
  const result = calculateOrcamento({
    valorCobrado: 0,
    totalKm: 0,
    capacidadePassageiros: 0,
    motorista1Valor: 500,
  });

  assert.equal(result.valorCobradoCents, 0);
  assert.equal(result.margemPercent, -100);
  assert.equal(result.custoPorKmCents, 0);
  assert.equal(result.receitaPorKmCents, 0);
  assert.equal(result.custoPorPoltronaCents, 0);
  assert.equal(result.precoPorPoltronaCents, 0);
  assert.equal(result.pontoEquilibrioPoltronas, 0);
});

test("cálculo de ponto de equilíbrio em poltronas", () => {
  // Custo = R$ 3.000,00. Cobrado = R$ 4.000,00. Ônibus com 40 poltronas.
  // Preço por poltrona = R$ 100,00. Ponto de equilíbrio = 3000 / 100 = 30 poltronas.
  const result = calculateOrcamento({
    valorCobrado: 4000,
    capacidadePassageiros: 40,
    motorista1Valor: 3000,
  });

  assert.equal(result.precoPorPoltronaCents, 10000); // R$ 100,00
  assert.equal(result.pontoEquilibrioPoltronas, 30);
});

test("teste de expiração em 7 dias", () => {
  // Emissão em 2026-10-01 + 7 dias = 2026-10-08
  const validade = evaluateOrcamentoValidity({
    dataEmissao: "2026-10-01",
    diasValidade: 7,
    status: "enviado",
    dataReferencia: "2026-10-09", // Passou 1 dia da validade
  });

  assert.equal(validade.dataValidade, "2026-10-08");
  assert.equal(validade.isExpirado, true);
  assert.equal(validade.statusExibicao, "Expirada");

  // Dentro do prazo de 7 dias
  const dentroDoPrazo = evaluateOrcamentoValidity({
    dataEmissao: "2026-10-05",
    diasValidade: 7,
    status: "Enviada",
    dataReferencia: "2026-10-09",
  });
  assert.equal(dentroDoPrazo.isExpirado, false);
  assert.equal(dentroDoPrazo.statusExibicao, "Enviada");

  // Orçamento já aprovado não expira
  const aprovado = evaluateOrcamentoValidity({
    dataEmissao: "2026-10-01",
    diasValidade: 7,
    status: "Confirmada",
    dataReferencia: "2026-10-09",
  });
  assert.equal(aprovado.isExpirado, false);
  assert.equal(aprovado.statusExibicao, "Confirmada");
});


test("validação obrigatória: 4.400 km, 3,5 km/L, diesel R$ 6,20, preço/km R$ 8,00, negociado R$ 36.000,00 e 40 passageiros", () => {
  const result = calculateOrcamento({
    vehiclesQty: 1,
    totalKm: 4400,
    emptyKm: 0,
    consumptionKmPerLiter: 3.5,
    fuelPricePerLiter: 6.2,
    pricePerKm: 8.0,
    manualBaseValue: 36000,
    isManualPrice: true,
    passageirosPrevistos: 40,
    capacidadePassageiros: 46,
    motorista1Valor: 0,
    costsConfirmedZero: true,
    requireCompleteCosts: true,
  });

  assert.equal(result.operationalKmPerVehicle, 4400);
  assert.equal(result.totalOperationalKm, 4400);
  assert.equal(result.litrosCombustivel, 1257.14);
  assert.equal(result.custosDetalhados.combustivelCents, 779429); // R$ 7.794,29
  assert.equal(formatCurrencyFromCents(result.custosDetalhados.combustivelCents).replace(/\s/g, " "), "R$ 7.794,29");
  assert.equal(result.valorAutomatico, 35200); // R$ 35.200,00
  assert.equal(result.valorCobrado, 36000); // R$ 36.000,00
  assert.equal(result.isManualPrice, true);
  assert.equal(result.precoPorPassageiro, 900); // R$ 900,00 por passageiro
  assert.equal(result.custosIncompletos, false);
});

test("calcula múltiplos veículos separadamente sem usar média aritmética simples de consumo", () => {
  // 1000 km de viagem com diesel a R$ 6,00/L:
  // Veículo 1 (Ônibus): 4 km/L -> 250 L -> R$ 1.500,00
  // Veículo 2 (Van): 10 km/L -> 100 L -> R$ 600,00
  // Soma real = 350 L e R$ 2.100,00 (média simples daria 7 km/L -> 285,71 L -> R$ 1.714,29, o que seria incorreto)
  const result = calculateOrcamento({
    totalKm: 1000,
    emptyKm: 0,
    fuelPricePerLiter: 6.0,
    vehicles: [
      { id: "v1", nome: "Ônibus", consumoKmPorLitro: 4, capacidade: 46 },
      { id: "v2", nome: "Van", consumoKmPorLitro: 10, capacidade: 19 },
    ],
    valorCobrado: 6300,
    passageirosPrevistos: 60,
    motorista1Valor: 0,
    costsConfirmedZero: true,
    requireCompleteCosts: true,
  });

  assert.equal(result.litrosCombustivel, 350);
  assert.equal(result.custosDetalhados.combustivelCents, 210000); // R$ 2.100,00
  assert.equal(result.totalOperationalKm, 2000); // 1000 km * 2 veículos
  assert.equal(result.custoPorKm, 1.05); // R$ 2.100,00 / 2000 km
  assert.equal(result.receitaPorKm, 3.15); // R$ 6.300,00 / 2000 km
  assert.equal(result.precoPorPoltrona, Number((6300 / 65).toFixed(2)));
  assert.equal(result.precoPorPassageiro, 105);
});

test("sinaliza Custos incompletos quando consumo é inválido ou motorista não foi preenchido", () => {
  const incomplete = calculateOrcamento({
    totalKm: 1000,
    consumptionKmPerLiter: 0,
    fuelPricePerLiter: 6.2,
    valorCobrado: 5000,
    motorista1Valor: "",
    costsConfirmedZero: false,
    requireCompleteCosts: true,
  });

  assert.equal(incomplete.custosIncompletos, true);
  assert.equal(incomplete.fairPrice.status, "incompleto");
  assert.equal(incomplete.fairPrice.label, "Custos incompletos");
  assert.equal(incomplete.pontoEquilibrioPassageiros, 0);
  assert.ok(incomplete.pendingItems.length >= 2);
});

test("respeita cobrança de motoristas por diária explícita independente da duração da viagem", () => {
  const result = calculateOrcamento({
    totalKm: 500,
    consumptionKmPerLiter: 5,
    fuelPricePerLiter: 6, // 100 L * 6 = R$ 600,00
    motorista1Tipo: "dia",
    motorista1Valor: 250,
    motorista1Diarias: 3, // R$ 750,00
    motorista2Tipo: "viagem",
    motorista2Valor: 400, // R$ 400,00
    pedagios: 150,
    estacionamento: 100,
    alimentacaoMotoristas: 200,
    valorCobrado: 4400,
    passageirosPrevistos: 40,
    requireCompleteCosts: true,
  });

  assert.equal(result.custosDetalhados.motorista1Cents, 75000);
  assert.equal(result.custosDetalhados.motorista2Cents, 40000);
  assert.equal(result.custoTotalCents, 220000); // 600 + 750 + 400 + 150 + 100 + 200 = R$ 2.200,00
  assert.equal(result.margemPercent, 50);
  assert.equal(result.pontoEquilibrioPassageiros, 20); // 2200 / 110 = 20 passageiros
});
