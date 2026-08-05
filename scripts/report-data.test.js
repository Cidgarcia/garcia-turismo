import assert from "node:assert/strict";
import test from "node:test";
import { buildReportRows, getRecordVehicleId } from "../public/src/report/report-data.js";

const period = { start: "2026-07-01", end: "2026-07-31" };
const data = {
  vehicles: [
    { id: "scania", modelo: "Scania", ano: 2003, cor: "Preto" },
    { id: "ducato", modelo: "Ducato", ano: 2020, cor: "Cinza" },
    { id: "mercedes", modelo: "Mercedes", ano: 2006, cor: "Branco" },
  ],
  expenses: [
    { data: "2026-07-03", descricao: "Oficina", valor: 100, veiculoId: "scania" },
    { data: "2026-07-04", descricao: "Peças", valor: 200, vehicleId: "ducato" },
    { data: "2026-07-05", descricao: "Seguro", valor: 300, veiculo_id: "mercedes" },
  ],
  fuelings: [
    { data: "2026-07-06", litros: 50, valorTotal: 400, veiculoId: "scania" },
  ],
  cardSchedules: [
    { vencimento: "2026-07-07", description: "Parcela", valor: 75, veiculoId: "ducato", sourceType: "expense" },
  ],
};

test("lê identificadores de veículo atuais e legados", () => {
  assert.equal(getRecordVehicleId({ veiculoId: "a" }), "a");
  assert.equal(getRecordVehicleId({ vehicleId: "b" }), "b");
  assert.equal(getRecordVehicleId({ veiculo_id: "c" }), "c");
  assert.equal(getRecordVehicleId({ veiculoId: "", vehicleId: "d" }), "d");
});

test("isola o relatório individual pelo id do veículo", () => {
  const scania = buildReportRows(data, period, { id: "scania", name: "Scania 2003 Preto" });
  const ducato = buildReportRows(data, period, { id: "ducato", name: "Ducato 2020 Cinza" });
  const mercedes = buildReportRows(data, period, { id: "mercedes", name: "Mercedes 2006 Branco" });

  assert.equal(scania.length, 2);
  assert.equal(scania.reduce((total, row) => total + row.valor, 0), 500);
  assert.equal(ducato.length, 2);
  assert.equal(ducato.reduce((total, row) => total + row.valor, 0), 275);
  assert.equal(mercedes.length, 1);
  assert.equal(mercedes[0].valor, 300);
});

test("mantém todos os lançamentos no relatório geral", () => {
  const rows = buildReportRows(data, period, null);
  assert.equal(rows.length, 5);
  assert.equal(rows.reduce((total, row) => total + row.valor, 0), 1_075);
});
