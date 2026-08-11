import {
  $,
  currency,
  escapeHtml,
  formatDate,
  monthNow,
} from "./controller-helpers.js";
import {
  buildEmployeeMonthlyPayment,
  getEmployeePaymentTypeLabel,
} from "../utils/employee-payments.js";

function formatCompetenceMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(value || "")) return "Mês selecionado";
  const [year, month] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function paymentStatusLabel(status) {
  return String(status || "").toLowerCase() === "pago" ? "Pago" : "Agendado / A pagar";
}

export function createEmployeePaymentsController({ state }) {
  function getTripLabel(tripId) {
    const trip = state.data.trips.find((item) => item.id === tripId);
    if (!trip) return "";
    const destination = trip.destination || trip.client || "Viagem vinculada";
    return `${destination}${trip.departureDate ? ` · ${formatDate(trip.departureDate)}` : ""}`;
  }

  function renderPaymentRows(rows) {
    if (!rows.length) {
      return '<p class="employee-payment__empty">Nenhum lançamento deste funcionário para a competência selecionada.</p>';
    }
    return `
      <div class="table-wrap employee-payment__table-wrap">
        <table class="employee-payment__table">
          <thead>
            <tr><th>Data</th><th>Tipo</th><th>Descrição</th><th class="text-right">Valor</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${rows.map((row) => {
              const tripLabel = row.tripId ? getTripLabel(row.tripId) : "";
              const description = row.descricao || row.descricaoGasto || "Sem descrição";
              return `
                <tr>
                  <td>${formatDate(row.data)}</td>
                  <td>${escapeHtml(getEmployeePaymentTypeLabel(row.employeePaymentType))}</td>
                  <td><span class="font-medium">${escapeHtml(description)}</span>${tripLabel ? `<span class="employee-payment__trip">Diária — ${escapeHtml(tripLabel)}</span>` : ""}</td>
                  <td class="text-right font-semibold">${currency(row.value)}</td>
                  <td><span class="employee-payment__status ${row.isPaid ? "is-paid" : "is-pending"}">${paymentStatusLabel(row.status)}</span></td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function renderEmployeePayments() {
    const container = $("#employeePaymentsList");
    const monthInput = $("#employeePaymentsMonth");
    if (!container || !monthInput) return;

    const competenceMonth = monthInput.value || monthNow();
    if (!monthInput.value) monthInput.value = competenceMonth;
    const activeEmployees = state.data.employees.filter(
      (employee) => employee.status !== "inativo",
    );

    if (!activeEmployees.length) {
      container.innerHTML = '<div class="empty-state">Cadastre um funcionário ativo para acompanhar os pagamentos mensais.</div>';
      return;
    }

    container.innerHTML = activeEmployees.map((employee) => {
      const payment = buildEmployeeMonthlyPayment(
        employee,
        state.data.expenses,
        competenceMonth,
      );
      const progress = Number(payment.salaryProgressPercent.toFixed(2));
      const plannedMessage = payment.plannedSalary > 0
        ? currency(payment.plannedSalary)
        : "Não informado";
      return `
        <details class="employee-payment" data-employee-id="${escapeHtml(employee.id)}">
          <summary class="employee-payment__summary">
            <div class="employee-payment__identity">
              <strong>${escapeHtml(employee.nome)}</strong>
              <span>${escapeHtml(employee.cargo || "Funcionário")}</span>
            </div>
            <div class="employee-payment__summary-values">
              <span>Planejado <strong>${plannedMessage}</strong></span>
              <span>Falta <strong>${currency(payment.salaryRemaining)}</strong></span>
            </div>
          </summary>
          <div class="employee-payment__content">
            <div class="employee-payment__salary-grid">
              <div><span>Planejado</span><strong>${plannedMessage}</strong></div>
              <div><span>Pago do salário</span><strong>${currency(payment.salaryPaid)}</strong></div>
              <div><span>Falta pagar</span><strong>${currency(payment.salaryRemaining)}</strong></div>
            </div>
            <div class="employee-payment__progress-meta"><span>Progresso do salário</span><strong>${progress}% pago</strong></div>
            <div class="employee-payment__progress" role="progressbar" aria-label="Progresso de pagamento salarial" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}">
              <span class="employee-payment__progress-fill" data-progress="${progress}%"></span>
            </div>
            <div class="employee-payment__totals">
              <div><span>Diárias</span><strong>${currency(payment.dailyTotal)}</strong></div>
              <div><span>Outros</span><strong>${currency(payment.otherPaymentsTotal)}</strong></div>
              <div><span>Total recebido</span><strong>${currency(payment.totalReceived)}</strong></div>
              ${payment.salaryExtraPaid > 0 ? `<div class="employee-payment__extra"><span>Excedente do salário</span><strong>${currency(payment.salaryExtraPaid)}</strong></div>` : ""}
            </div>
            ${payment.scheduledCount ? `<p class="employee-payment__scheduled">Agendado / A pagar: ${payment.scheduledCount} lançamento(s), ${currency(payment.scheduledTotal)}.</p>` : ""}
            <div class="employee-payment__details-title">Lançamentos de ${escapeHtml(formatCompetenceMonth(competenceMonth))}</div>
            ${renderPaymentRows(payment.rows)}
          </div>
        </details>`;
    }).join("");

    container.querySelectorAll(".employee-payment__progress-fill").forEach((element) => {
      element.style.setProperty("--employee-payment-progress", element.dataset.progress);
    });
  }

  function bindEmployeePayments() {
    const monthInput = $("#employeePaymentsMonth");
    if (!monthInput) return;
    monthInput.value = monthNow();
    monthInput.addEventListener("change", renderEmployeePayments);
  }

  return { bindEmployeePayments, renderEmployeePayments };
}
