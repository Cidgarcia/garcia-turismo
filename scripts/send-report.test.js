import assert from "node:assert/strict";
import test from "node:test";
import { buildVehicleReports, validateAttachments } from "./send-report.js";

const period = { key: "2026-08" };

test("cria um relatório único para cada veículo ativo", () => {
  const reports = buildVehicleReports(
    {
      vehicles: [
        { id: "scan-01", modelo: "Scania", ano: 2003, cor: "Preto", status: "ativo" },
        { id: "ducato-01", modelo: "Ducato", ano: 2020, cor: "Cinza", status: "ativo" },
        { id: "mercedes-01", modelo: "Mercedes", ano: 2006, cor: "Branco", status: "ativo" },
        { id: "old-01", modelo: "Antigo", status: "inativo" },
      ],
    },
    period,
  );

  assert.equal(reports.length, 3);
  assert.equal(new Set(reports.map((report) => report.id)).size, 3);
  assert.equal(new Set(reports.map((report) => report.filename)).size, 3);
  assert.ok(reports.every((report) => report.filename.includes("2026-08.pdf")));
});

test("interrompe o envio quando houver id de veículo duplicado ou ausente", () => {
  assert.throws(
    () => buildVehicleReports({ vehicles: [{ id: "same" }, { id: "same" }] }, period),
    /Veículo ativo duplicado/,
  );
  assert.throws(
    () => buildVehicleReports({ vehicles: [{ modelo: "Sem id" }] }, period),
    /sem id/,
  );
});

test("interrompe o envio quando anexos repetem veículo ou arquivo", () => {
  assert.throws(
    () => validateAttachments([
      { filename: "a.pdf", vehicleId: "scan-01" },
      { filename: "a.pdf", vehicleId: "ducato-01" },
    ]),
    /Arquivo de relatório duplicado/,
  );
  assert.throws(
    () => validateAttachments([
      { filename: "a.pdf", vehicleId: "scan-01" },
      { filename: "b.pdf", vehicleId: "scan-01" },
    ]),
    /Veículo duplicado nos anexos/,
  );
});
