export const EMPLOYEE_PAYMENT_TYPES = Object.freeze({
  advance: "Vale / Adiantamento",
  salary: "Pagamento de salário",
  daily: "Diária de viagem",
  other: "Outro pagamento ao funcionário",
});

export function getEmployeePaymentTypeLabel(type) {
  return EMPLOYEE_PAYMENT_TYPES[type] || "Não classificado";
}

export function getExpenseEmployeeId(expense = {}) {
  return String(expense.employeeId || expense.funcionarioId || "");
}

export function getExpenseCompetenceMonth(expense = {}) {
  if (/^\d{4}-\d{2}$/.test(expense.competenceMonth || "")) {
    return expense.competenceMonth;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(expense.data || "")
    ? expense.data.slice(0, 7)
    : "";
}

export function isExpensePaid(expense = {}) {
  return String(expense.status || "").toLowerCase() === "pago";
}

function positiveAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export function buildEmployeeMonthlyPayment(employee = {}, expenses = [], competenceMonth = "") {
  const employeeId = String(employee.id || "");
  const plannedSalary = positiveAmount(employee.salarioBase ?? employee.monthlySalary);
  const rows = expenses
    .filter(
      (expense) =>
        getExpenseEmployeeId(expense) === employeeId &&
        getExpenseCompetenceMonth(expense) === competenceMonth,
    )
    .map((expense) => ({
      ...expense,
      employeePaymentType: expense.employeePaymentType || "",
      isPaid: isExpensePaid(expense),
      value: positiveAmount(expense.valor),
    }))
    .sort((first, second) =>
      `${first.data || ""}:${first.id || ""}`.localeCompare(
        `${second.data || ""}:${second.id || ""}`,
      ),
    );

  const sumPaidByType = (types) =>
    rows.reduce(
      (total, row) =>
        row.isPaid && types.includes(row.employeePaymentType)
          ? total + row.value
          : total,
      0,
    );
  const salaryPaid = sumPaidByType(["advance", "salary"]);
  const dailyTotal = sumPaidByType(["daily"]);
  const otherPaymentsTotal = sumPaidByType(["other"]);
  const salaryRemaining = Math.max(plannedSalary - salaryPaid, 0);
  const salaryExtraPaid = Math.max(salaryPaid - plannedSalary, 0);
  const salaryProgressPercent = plannedSalary > 0
    ? Math.min((salaryPaid / plannedSalary) * 100, 100)
    : 0;
  const scheduledRows = rows.filter((row) => !row.isPaid);

  return {
    plannedSalary,
    salaryPaid,
    salaryRemaining,
    salaryExtraPaid,
    salaryProgressPercent,
    dailyTotal,
    otherPaymentsTotal,
    totalReceived: salaryPaid + dailyTotal + otherPaymentsTotal,
    scheduledTotal: scheduledRows.reduce((total, row) => total + row.value, 0),
    scheduledCount: scheduledRows.length,
    rows,
  };
}
