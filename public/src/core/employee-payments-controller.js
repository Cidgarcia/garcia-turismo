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

export function createEmployeePaymentsController({
  state,
  onRenderAll,
  onStartEmployeePayment,
  saveFirestoreRecord,
  showToast,
}) {
  function getTripLabel(tripId) {
    const trip = state.data.trips.find((item) => item.id === tripId);
    if (!trip) return "";
    const destination = trip.destination || trip.client || "Viagem vinculada";
    return `${destination}${trip.departureDate ? ` · ${formatDate(trip.departureDate)}` : ""}`;
  }

  function renderPaymentRows(rows, emptyMessage) {
    if (!rows.length) {
      return `<p class="employee-payment__empty">${escapeHtml(emptyMessage)}</p>`;
    }
    return `
      <div class="table-wrap employee-payment__table-wrap">
        <table class="employee-payment__table">
          <thead>
            <tr><th>Data</th><th>Tipo</th><th>Viagem / descrição</th><th class="text-right">Valor</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${rows.map((row) => {
              const tripLabel = row.tripId ? getTripLabel(row.tripId) : "";
              const description = row.descricao || row.descricaoGasto || "Sem descrição";
              const paymentAction = row.isPaid
                ? ""
                : `<button type="button" class="employee-payment__settle" data-employee-payment-action="mark-paid" data-expense-id="${escapeHtml(row.id)}">Dar baixa</button>`;
              return `
                <tr>
                  <td>${formatDate(row.data)}</td>
                  <td>${escapeHtml(getEmployeePaymentTypeLabel(row.employeePaymentType))}</td>
                  <td><span class="font-medium">${escapeHtml(description)}</span>${tripLabel ? `<span class="employee-payment__trip">Viagem — ${escapeHtml(tripLabel)}</span>` : ""}</td>
                  <td class="text-right font-semibold">${currency(row.value)}</td>
                  <td><span class="employee-payment__status ${row.isPaid ? "is-paid" : "is-pending"}">${paymentStatusLabel(row.status)}</span>${paymentAction}</td>
                </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>`;
  }

  function renderPaymentSection(title, rows, emptyMessage) {
    return `
      <section class="employee-payment__detail-section">
        <h4>${escapeHtml(title)}</h4>
        ${renderPaymentRows(rows, emptyMessage)}
      </section>`;
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
      const employeeId = escapeHtml(employee.id);
      const employeeName = escapeHtml(employee.nome || "Funcionário");
      const contentId = `employee-payment-content-${employeeId}`;
      return `
        <article class="employee-payment" data-employee-id="${employeeId}">
          <div class="employee-payment__header">
            <button type="button" class="employee-payment__expand" data-employee-payment-action="toggle" aria-expanded="false" aria-controls="${contentId}">
              <span class="employee-payment__identity">
                <strong>${employeeName}</strong>
                <span>${escapeHtml(employee.cargo || "Funcionário")}</span>
              </span>
              <span class="employee-payment__summary-values">
                <span>Salário base <strong>${plannedMessage}</strong></span>
                <span>Falta <strong>${currency(payment.salaryRemaining)}</strong></span>
              </span>
              <span class="employee-payment__chevron" aria-hidden="true">⌄</span>
            </button>
            <button type="button" class="employee-payment__new" data-employee-payment-action="new" data-employee-id="${employeeId}" aria-label="Novo pagamento para ${employeeName}" title="Novo pagamento">+</button>
          </div>
          <div id="${contentId}" class="employee-payment__content" data-employee-payment-content hidden>
            <div class="employee-payment__salary-grid">
              <div><span>Salário base</span><strong>${plannedMessage}</strong></div>
              <div><span>Pago do salário</span><strong>${currency(payment.salaryPaid)}</strong></div>
              <div><span>Falta do salário</span><strong>${currency(payment.salaryRemaining)}</strong></div>
            </div>
            <div class="employee-payment__progress-meta"><span>${currency(payment.salaryPaid)} pago</span><strong>${progress}%</strong><span>${currency(payment.salaryRemaining)} restante</span></div>
            <progress class="employee-payment__progress" aria-label="Progresso de pagamento salarial" value="${progress}" max="100">${progress}%</progress>
            <div class="employee-payment__totals">
              <div><span>Diárias</span><strong>${currency(payment.dailyTotal)}</strong></div>
              <div><span>Outros extras</span><strong>${currency(payment.otherPaymentsTotal)}</strong></div>
              <div><span>Diárias / extras</span><strong>${currency(payment.extrasTotal)}</strong></div>
              <div class="employee-payment__total-received"><span>Ganho total no mês</span><strong>${currency(payment.totalReceived)}</strong></div>
            </div>
            ${payment.scheduledCount ? `<p class="employee-payment__scheduled">Agendado / A pagar: ${payment.scheduledCount} lançamento(s), ${currency(payment.scheduledTotal)}.</p>` : ""}
            <div class="employee-payment__details-title">Lançamentos de ${escapeHtml(formatCompetenceMonth(competenceMonth))}</div>
            ${renderPaymentSection("Salário / adiantamentos", payment.salaryRows, "Nenhum vale ou pagamento de salário nesta competência.")}
            ${renderPaymentSection("Diárias / extras", payment.extraRows, "Nenhuma diária ou extra nesta competência.")}
            ${payment.unclassifiedRows.length ? renderPaymentSection("Não classificados (dados antigos)", payment.unclassifiedRows, "") : ""}
          </div>
        </article>`;
    }).join("");
  }

  async function markEmployeePaymentPaid(expenseId) {
    const expense = state.data.expenses.find((item) => item.id === expenseId);
    if (!expense) {
      showToast("Lançamento não encontrado.", "error");
      return;
    }
    if (String(expense.status || "").toLowerCase() === "pago") return;

    try {
      await saveFirestoreRecord("Expense", "expenses", { ...expense, status: "pago" });
      onRenderAll();
      showToast("Pagamento marcado como pago.", "success");
    } catch (error) {
      console.error("Erro ao dar baixa no pagamento:", error);
      showToast(error.message || "Não foi possível dar baixa no pagamento.", "error");
    }
  }

  function bindEmployeePayments() {
    const monthInput = $("#employeePaymentsMonth");
    const container = $("#employeePaymentsList");
    if (!monthInput || !container) return;
    monthInput.value = monthNow();
    monthInput.addEventListener("change", renderEmployeePayments);
    container.addEventListener("click", async (event) => {
      const actionElement = event.target.closest("[data-employee-payment-action]");
      if (!actionElement) return;
      const action = actionElement.dataset.employeePaymentAction;
      if (action === "toggle") {
        const card = actionElement.closest(".employee-payment");
        const content = card?.querySelector("[data-employee-payment-content]");
        if (!content) return;
        const expanded = actionElement.getAttribute("aria-expanded") === "true";
        actionElement.setAttribute("aria-expanded", String(!expanded));
        content.hidden = expanded;
        card.classList.toggle("is-expanded", !expanded);
      }
      if (action === "new") {
        onStartEmployeePayment({
          employeeId: actionElement.dataset.employeeId,
          competenceMonth: monthInput.value || monthNow(),
        });
      }
      if (action === "mark-paid") {
        await markEmployeePaymentPaid(actionElement.dataset.expenseId);
      }
    });
  }

  return { bindEmployeePayments, renderEmployeePayments };
}
