import assert from "node:assert/strict";
import test from "node:test";

import {
  addDaysISO,
  calculateDirectCosts,
  calculateFuelCost,
  calculateMaintenanceCost,
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

  // Manutenção: 350 km * R$ 0.45/km = R$ 157.50 = 15750 cents
  const maintCents = calculateMaintenanceCost({
    totalKm: 350,
    maintenanceCostPerKm: 0.45,
  });
  assert.equal(maintCents, 15750);
});

test("teste de margem exata de 50%", () => {
  // Custos totais = R$ 1.000,00 (100000 cents). Se cobrarmos R$ 2.000,00 (200000 cents):
  // Lucro = R$ 1.000,00. Margem sobre preço = 1.000 / 2.000 * 100 = 50.00%
  const result = calculateOrcamento({
    valorCobrado: 2000,
    motorista1Valor: 500,
    hospedagem: 200,
    pedagios: 300,
    aliquotaImpostoPercent: 0,
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
    aliquotaImpostoPercent: 0,
  });

  assert.equal(suggestedPriceCents, 300000); // R$ 3.000,00

  // Validando com calculateOrcamento aplicando o preço sugerido
  const validation = calculateOrcamento({
    valorCobrado: fromCents(suggestedPriceCents),
    motorista1Valor: 1500,
    aliquotaImpostoPercent: 0,
    metaMargemPercent: 50,
  });

  assert.equal(validation.margemPercent, 50);
  assert.equal(validation.fairPrice.status, "verde");
});

test("teste de preço mínimo sugerido com alíquota de impostos (ex: 6% Simples)", () => {
  // Custo = R$ 1.000,00. Meta = 50%. Imposto = 6%.
  // Preco = 1000 / (1 - 0.50 - 0.06) = 1000 / 0.44 = 2272.727... => R$ 2.272,73
  const directCostsCents = 100000;
  const suggestedPriceCents = calculateSuggestedPriceForTarget({
    custosDiretosCents: directCostsCents,
    metaMargemPercent: 50,
    aliquotaImpostoPercent: 6,
  });

  assert.equal(suggestedPriceCents, 227273);

  // Verificando que o lucro após imposto garante 50% de margem
  const validation = calculateOrcamento({
    valorCobrado: fromCents(suggestedPriceCents),
    motorista1Valor: 1000,
    aliquotaImpostoPercent: 6,
    metaMargemPercent: 50,
  });

  assert.ok(Math.abs(validation.margemPercent - 50) < 0.05);
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
  assert.equal(validade.statusExibicao, "expirado");

  // Dentro do prazo de 7 dias
  const dentroDoPrazo = evaluateOrcamentoValidity({
    dataEmissao: "2026-10-05",
    diasValidade: 7,
    status: "enviado",
    dataReferencia: "2026-10-09",
  });
  assert.equal(dentroDoPrazo.isExpirado, false);
  assert.equal(dentroDoPrazo.statusExibicao, "enviado");

  // Orçamento já aprovado não expira
  const aprovado = evaluateOrcamentoValidity({
    dataEmissao: "2026-10-01",
    diasValidade: 7,
    status: "aprovado",
    dataReferencia: "2026-10-09",
  });
  assert.equal(aprovado.isExpirado, false);
  assert.equal(aprovado.statusExibicao, "aprovado");
});

