import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEmployeeMonthlyPayment,
  getEmployeePaymentCategory,
  isValidEmployeePaymentCombination,
} from "../public/src/utils/employee-payments.js";

const employee = { id: "employee-1", salarioBase: 2500 };
const payment = (overrides = {}) => ({
  id: crypto.randomUUID(),
  employeeId: "employee-1",
  funcionarioId: "employee-1",
  competenceMonth: "2026-08",
  data: "2026-08-10",
  employeePaymentType: "advance",
  status: "pago",
  valor: 1000,
  ...overrides,
});

test("calcula vale como pagamento salarial e preserva o saldo", () => {
  const result = buildEmployeeMonthlyPayment(employee, [payment()], "2026-08");
  assert.equal(result.salaryPaid, 1000);
  assert.equal(result.salaryRemaining, 1500);
  assert.equal(result.salaryProgressPercent, 40);
});

test("separa diária do saldo salarial e a inclui no total recebido", () => {
  const result = buildEmployeeMonthlyPayment(employee, [
    payment(),
    payment({ employeePaymentType: "daily", valor: 600 }),
  ], "2026-08");
  assert.equal(result.salaryPaid, 1000);
  assert.equal(result.salaryRemaining, 1500);
  assert.equal(result.dailyTotal, 600);
  assert.equal(result.totalReceived, 1600);
});

test("calcula salario, extras e ganho total do mes sem misturar categorias", () => {
  const result = buildEmployeeMonthlyPayment(
    { id: "employee-1", salarioBase: 3200 },
    [
      payment({ valor: 200, employeePaymentType: "advance" }),
      payment({ valor: 600, employeePaymentType: "daily" }),
    ],
    "2026-08",
  );
  assert.equal(result.salaryPaid, 200);
  assert.equal(result.salaryRemaining, 3000);
  assert.equal(result.extrasTotal, 600);
  assert.equal(result.totalReceived, 800);
});

test("marca salário concluído quando o planejado foi pago", () => {
  const result = buildEmployeeMonthlyPayment(employee, [payment({ valor: 2500 })], "2026-08");
  assert.equal(result.salaryRemaining, 0);
  assert.equal(result.salaryProgressPercent, 100);
});

test("mantém excedente salarial sem ultrapassar 100% na barra", () => {
  const result = buildEmployeeMonthlyPayment(employee, [payment({ valor: 3000 })], "2026-08");
  assert.equal(result.salaryRemaining, 0);
  assert.equal(result.salaryProgressPercent, 100);
  assert.equal(result.salaryExtraPaid, 500);
});

test("não inclui lançamento pendente nos valores recebidos", () => {
  const result = buildEmployeeMonthlyPayment(employee, [payment({ status: "a_pagar" })], "2026-08");
  assert.equal(result.salaryPaid, 0);
  assert.equal(result.totalReceived, 0);
  assert.equal(result.scheduledTotal, 1000);
});

test("outros pagamentos não reduzem o saldo do salário", () => {
  const result = buildEmployeeMonthlyPayment(employee, [
    payment({ employeePaymentType: "daily", valor: 600 }),
    payment({ employeePaymentType: "other", valor: 250 }),
  ], "2026-08");
  assert.equal(result.salaryRemaining, 2500);
  assert.equal(result.dailyTotal, 600);
  assert.equal(result.otherPaymentsTotal, 250);
});

test("usa competência, e não somente a data do pagamento, para filtrar o mês", () => {
  const result = buildEmployeeMonthlyPayment(employee, [
    payment({ data: "2026-09-01", competenceMonth: "2026-08", valor: 1500 }),
    payment({ data: "2026-08-15", competenceMonth: "2026-09", valor: 900 }),
  ], "2026-08");
  assert.equal(result.salaryPaid, 1500);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].data, "2026-09-01");
});

test("mantém despesa antiga visível sem classificá-la como salário", () => {
  const legacyExpense = payment({
    employeePaymentType: undefined,
    competenceMonth: undefined,
    data: "2026-08-18",
    valor: 700,
  });
  const result = buildEmployeeMonthlyPayment(employee, [legacyExpense], "2026-08");
  assert.equal(result.rows.length, 1);
  assert.equal(result.salaryPaid, 0);
  assert.equal(result.totalReceived, 0);
});

test("limita os tipos de pagamento a categoria correspondente", () => {
  assert.equal(getEmployeePaymentCategory("advance"), "salarios_adiantamentos");
  assert.equal(getEmployeePaymentCategory("daily"), "viagens_extras");
  assert.equal(isValidEmployeePaymentCombination("salarios_adiantamentos", "salary"), true);
  assert.equal(isValidEmployeePaymentCombination("salarios_adiantamentos", "daily"), false);
  assert.equal(isValidEmployeePaymentCombination("viagens_extras", "other"), true);
  assert.equal(isValidEmployeePaymentCombination("viagens_extras", "advance"), false);
});
