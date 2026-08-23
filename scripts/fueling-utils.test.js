import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateFuelMetrics,
  filterFuelings,
  getFuelingDate,
  getPreviousFueling,
  summarizeFuelings,
} from "../public/src/utils/fueling-utils.js";

const augustFuelings = [
  {
    id: "fuel-1",
    fuelingDate: "2026-08-01",
    veiculoId: "scania",
    kmAtual: 100000,
    litros: 100,
    valorTotal: 600,
    distanciaPercorrida: 500,
    createdAt: { seconds: 1785589200 },
  },
  {
    id: "fuel-2",
    fuelingDate: "2026-08-10",
    veiculoId: "scania",
    kmAtual: 100600,
    litros: 100,
    valorTotal: 700,
    distanciaPercorrida: 700,
    createdAt: { seconds: 1786366800 },
  },
  {
    id: "fuel-3",
    fuelingDate: "2026-08-11",
    veiculoId: "mercedes",
    kmAtual: 50000,
    litros: 50,
    valorTotal: 350,
    distanciaPercorrida: 250,
  },
];

test("calcula distância, média km/L e preço por litro", () => {
  const metrics = calculateFuelMetrics({ lastKm: 100000, currentKm: 100600, liters: 100, total: 600 });

  assert.equal(metrics.distance, 600);
  assert.equal(metrics.average, 6);
  assert.equal(metrics.pricePerLiter, 6);
  assert.equal(metrics.validKm, true);
});

test("não calcula média negativa quando o KM atual é menor ou igual ao anterior", () => {
  const metrics = calculateFuelMetrics({ lastKm: 100600, currentKm: 100500, liters: 100, total: 600 });

  assert.equal(metrics.validKm, false);
  assert.equal(metrics.distance, 0);
  assert.equal(metrics.average, 0);
});

test("usa somente um abastecimento cronologicamente anterior do mesmo veículo", () => {
  const previous = getPreviousFueling({
    fuelings: augustFuelings,
    vehicleId: "scania",
    fuelingDate: "2026-08-05",
  });

  assert.equal(previous.id, "fuel-1");
  assert.equal(previous.kmAtual, 100000);
});

test("não usa lançamento futuro como anterior em inclusão retroativa", () => {
  const previous = getPreviousFueling({
    fuelings: augustFuelings,
    vehicleId: "scania",
    fuelingDate: "2026-07-31",
  });

  assert.equal(previous, null);
});

test("usa createdAt como desempate para abastecimentos na mesma data", () => {
  const previous = getPreviousFueling({
    fuelings: [{
      id: "fuel-same-day",
      fuelingDate: "2026-08-05",
      veiculoId: "scania",
      kmAtual: 100300,
      createdAt: { seconds: 1785931200 },
    }],
    vehicleId: "scania",
    fuelingDate: "2026-08-05",
    createdAt: 1785942000000,
  });

  assert.equal(previous.id, "fuel-same-day");
});

test("calcula a média do período pela distância e litros totais", () => {
  const summary = summarizeFuelings(augustFuelings.slice(0, 2));

  assert.equal(summary.distance, 1200);
  assert.equal(summary.liters, 200);
  assert.equal(summary.averageConsumption, 6);
  assert.equal(summary.averagePricePerLiter, 6.5);
});

test("filtra por data real e veículo, sem incluir lançamento de julho cadastrado em agosto", () => {
  const records = [
    ...augustFuelings,
    {
      id: "fuel-legacy-july",
      data: "2026-07-31",
      createdAt: { seconds: 1785675600 },
      veiculoId: "scania",
    },
  ];

  const filtered = filterFuelings({
    fuelings: records,
    startDate: "2026-08-01",
    endDate: "2026-08-31",
    vehicleId: "scania",
  });

  assert.deepEqual(filtered.map((item) => item.id), ["fuel-1", "fuel-2"]);
});

test("mantém compatibilidade com registros antigos sem fuelingDate", () => {
  assert.equal(getFuelingDate({ data: "2026-08-03" }), "2026-08-03");
  assert.equal(getFuelingDate({ createdAt: { seconds: 1785848400 } }), "2026-08-04");
});
