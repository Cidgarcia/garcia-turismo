import assert from "node:assert/strict";
import test from "node:test";

import {
  categoryLabel,
  currentDateISO,
  currentMonthISO,
  formatCurrency,
  formatDate,
  paymentLabel,
} from "../public/src/utils/formatters.js";
import {
  positiveNumber,
  required,
  validDate,
  validateRequiredFields,
} from "../public/src/utils/validators.js";

test("validators distinguem campos obrigatórios, números positivos e formato ISO", () => {
  assert.equal(required("  motorista "), true);
  assert.equal(required("   "), false);
  assert.equal(positiveNumber("0.01"), true);
  assert.equal(positiveNumber(0), false);
  assert.equal(validDate("2026-08-07"), true);
  assert.equal(validDate("07/08/2026"), false);
  assert.deepEqual(
    validateRequiredFields({ cliente: "Garcia", destino: "", responsavel: "  " }),
    { valid: false, missing: ["destino", "responsavel"] },
  );
});

test("formatters mantêm formato brasileiro, rótulos e retornos de borda", () => {
  assert.equal(formatCurrency(1234.5).replace(/\s/g, " "), "R$ 1.234,50");
  assert.equal(formatDate("2026-08-07"), "07/08/2026");
  assert.equal(formatDate(""), "-");
  assert.equal(formatDate("data-inválida"), "-");
  assert.equal(categoryLabel("combustivel"), "Abastecimento");
  assert.equal(categoryLabel("categoria_legada"), "categoria_legada");
  assert.equal(paymentLabel("cartao_credito"), "Cartão de crédito");
  assert.equal(paymentLabel(""), "-");
  assert.match(currentDateISO(), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(currentMonthISO(), /^\d{4}-\d{2}$/);
});
