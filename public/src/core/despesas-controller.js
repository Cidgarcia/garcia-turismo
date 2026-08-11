import {
  $,
  categoryLabel,
  currency,
  escapeHtml,
  formatDate,
  paymentLabel,
  rowStatusBadge,
  today,
  uid,
} from "./controller-helpers.js";
import { buildCardSchedules, togglePaymentBlocks } from "./payment-utils.js";
import {
  getAllowedEmployeePaymentTypes,
  getEmployeePaymentCategory,
  getEmployeePaymentTypeLabel,
  isEmployeePaymentCategory,
  isValidEmployeePaymentCombination,
} from "../utils/employee-payments.js";

export function createDespesasController({
  state,
  getEmployeeName,
  getVehicleName,
  onRenderAll,
  removeFirestoreRecord,
  saveFirestoreRecord,
  showToast,
}) {
  let quickEmployeePayment = false;

  function renderExpenseTable() {
    const rows = [...state.data.expenses].sort((a, b) =>
      (b.data || "").localeCompare(a.data || ""),
    );
    $("#expenseTable").innerHTML =
      rows
        .map(
          (item) => `
          <tr>
            <td>${formatDate(item.data)}</td>
            <td>${escapeHtml(categoryLabel(item.categoria))}</td>
            <td>
              <div class="font-medium">${escapeHtml(item.descricao || "-")}</div>
              <div class="muted text-xs mt-1">${escapeHtml(item.descricaoGasto || getVehicleName(item.veiculoId) || getEmployeeName(item.funcionarioId) || "-")}</div>
            </td>
            <td>${paymentLabel(item.paymentMethod)}${item.paymentMethod === "cartao_credito" ? ` • ${item.installments || 1}x` : ""}</td>
            <td>${rowStatusBadge(item.status)}</td>
            <td class="text-right">${currency(item.valor)}</td>
            <td class="text-right"><button class="rounded-xl px-3 py-2 btn-secondary text-sm font-semibold" data-action="delete-expense" data-id="${escapeHtml(item.id)}">Excluir</button></td>
          </tr>`,
        )
        .join("") ||
      '<tr><td colspan="7" class="text-center muted py-6">Nenhuma despesa lançada até agora.</td></tr>';
  }

  function setDefaultCompetenceMonth() {
    const date = $("#expenseDate").value;
    const competenceInput = $("#expenseCompetenceMonth");
    const defaultMonth = date ? date.slice(0, 7) : "";
    if (!defaultMonth) return;
    if (!competenceInput.value || competenceInput.value === competenceInput.dataset.defaultMonth) {
      competenceInput.value = defaultMonth;
    }
    competenceInput.dataset.defaultMonth = defaultMonth;
  }

  function renderTripOptions() {
    const tripInput = $("#expenseTrip");
    const selectedTripId = tripInput.value;
    const options = [...state.data.trips]
      .sort((first, second) => (second.departureDate || "").localeCompare(first.departureDate || ""))
      .map((trip) => {
        const name = trip.destination || trip.client || "Viagem sem destino";
        const date = trip.departureDate ? ` · ${formatDate(trip.departureDate)}` : "";
        return `<option value="${escapeHtml(trip.id)}">${escapeHtml(`${name}${date}`)}</option>`;
      })
      .join("");
    tripInput.innerHTML = `<option value="">Sem vínculo com viagem</option>${options}`;
    tripInput.value = selectedTripId;
  }

  function renderEmployeePaymentTypeOptions(category) {
    const typeInput = $("#expenseEmployeePaymentType");
    const selectedType = typeInput.value;
    const allowedTypes = getAllowedEmployeePaymentTypes(category);
    const options = allowedTypes
      .map((type) => `<option value="${type}">${escapeHtml(getEmployeePaymentTypeLabel(type))}</option>`)
      .join("");
    typeInput.innerHTML = `<option value="">Selecione</option>${options}`;
    if (allowedTypes.includes(selectedType)) {
      typeInput.value = selectedType;
    }
  }

  function toggleEmployeePaymentFields() {
    const category = $("#expenseCategory").value;
    const isEmployeeCategory = isEmployeePaymentCategory(category);
    const isExtrasCategory = category === "viagens_extras";
    const isEmployeeFlow = isEmployeeCategory || quickEmployeePayment;
    const typeInput = $("#expenseEmployeePaymentType");
    const employeeInput = $("#expenseEmployee");
    const competenceInput = $("#expenseCompetenceMonth");

    $("#wrapExpenseEmployee").classList.toggle("hidden-section", !isEmployeeFlow);
    $("#wrapExpenseEmployeePaymentType").classList.toggle("hidden-section", !isEmployeeCategory);
    $("#wrapExpenseCompetenceMonth").classList.toggle("hidden-section", !isEmployeeFlow);
    $("#wrapExpenseTrip").classList.toggle("hidden-section", !isExtrasCategory);
    $("#expenseEmployeeQuickTypes").classList.toggle("hidden-section", !quickEmployeePayment);

    employeeInput.required = isEmployeeCategory;
    typeInput.required = isEmployeeCategory;
    competenceInput.required = isEmployeeCategory;

    if (!isEmployeeFlow) {
      employeeInput.value = "";
      typeInput.value = "";
      competenceInput.value = "";
      $("#expenseTrip").value = "";
      return;
    }

    setDefaultCompetenceMonth();
    if (isEmployeeCategory) renderEmployeePaymentTypeOptions(category);
    if (isExtrasCategory) renderTripOptions();
  }

  function toggleExpenseFields() {
    togglePaymentBlocks("expense");
    toggleEmployeePaymentFields();
  }

  function clearExpenseForm() {
    quickEmployeePayment = false;
    $("#expenseForm").reset();
    $("#expenseDate").value = today();
    $("#expenseInstallments").value = "1";
    $("#expenseCompetenceMonth").dataset.defaultMonth = "";
    toggleExpenseFields();
  }

  function chooseQuickEmployeePayment(type) {
    const category = getEmployeePaymentCategory(type);
    if (!category) return;
    quickEmployeePayment = false;
    $("#expenseCategory").value = category;
    toggleExpenseFields();
    $("#expenseEmployeePaymentType").value = type;
    toggleEmployeePaymentFields();
    $("#expenseDescription").focus();
  }

  function startEmployeePayment({ employeeId, competenceMonth }) {
    const employee = state.data.employees.find((item) => item.id === employeeId);
    if (!employee) {
      showToast("Funcionário não encontrado para iniciar o lançamento.", "error");
      return;
    }

    $("#expenseForm").reset();
    $("#expenseDate").value = today();
    $("#expenseInstallments").value = "1";
    $("#expenseEmployee").value = employeeId;
    $("#expenseCompetenceMonth").value = competenceMonth || today().slice(0, 7);
    $("#expenseCompetenceMonth").dataset.defaultMonth = $("#expenseCompetenceMonth").value;
    quickEmployeePayment = true;
    toggleExpenseFields();
    $("#expenseForm").scrollIntoView({ behavior: "smooth", block: "start" });
    $("[data-employee-payment-quick-type]")?.focus();
  }

  function bindExpenseForm() {
    $("#expenseCategory").addEventListener("change", () => {
      quickEmployeePayment = false;
      toggleExpenseFields();
    });
    $("#expensePayment").addEventListener("change", toggleExpenseFields);
    $("#expenseEmployee").addEventListener("change", toggleEmployeePaymentFields);
    $("#expenseEmployeePaymentType").addEventListener("change", toggleEmployeePaymentFields);
    $("#expenseDate").addEventListener("change", setDefaultCompetenceMonth);
    $("#expenseClearBtn").addEventListener("click", clearExpenseForm);
    $("#expenseEmployeeQuickTypes").addEventListener("click", (event) => {
      const button = event.target.closest("[data-employee-payment-quick-type]");
      if (button) chooseQuickEmployeePayment(button.dataset.employeePaymentQuickType);
    });
    $("#openQuickExpense").addEventListener("click", () =>
      document.querySelector('[data-tab="despesas"]').click(),
    );
    $("#expenseForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const category = $("#expenseCategory").value;
      const paymentMethod = $("#expensePayment").value;
      const status = $("#expenseStatus").value;
      const value = Number($("#expenseAmount").value);
      const description = $("#expenseDescription").value.trim();
      const employeePaymentType = $("#expenseEmployeePaymentType").value;
      const competenceMonth = $("#expenseCompetenceMonth").value;
      const isEmployeePayment = isEmployeePaymentCategory(category);
      const employeeId = isEmployeePayment ? $("#expenseEmployee").value : "";

      if (isEmployeePayment && (!employeeId || !employeePaymentType || !competenceMonth)) {
        showToast("Selecione funcionário, tipo e mês de competência.", "error");
        return;
      }
      if (isEmployeePayment && !isValidEmployeePaymentCombination(category, employeePaymentType)) {
        showToast("O tipo selecionado não é permitido para esta categoria.", "error");
        return;
      }

      const payload = {
        id: uid(), data: $("#expenseDate").value, categoria: category,
        descricao: description, descricaoGasto: "",
        valor: value, veiculoId: $("#expenseVehicle").value || "",
        funcionarioId: employeeId, paymentMethod, status,
        comprovanteUrl: $("#expenseProof").value || "", paymentDetails: {},
      };
      payload.vehicleId = payload.veiculoId;
      payload.employeeId = payload.funcionarioId;

      if (isEmployeePayment) {
        payload.employeePaymentType = employeePaymentType;
        payload.competenceMonth = competenceMonth;
        const tripId = $("#expenseTrip").value;
        if (category === "viagens_extras" && tripId) payload.tripId = tripId;
      }
      if (paymentMethod === "pix" || paymentMethod === "dinheiro") {
        payload.paymentDetails = { tipo: paymentMethod, instantaneo: true, vencimento: payload.data };
      }
      if (paymentMethod === "cheque") {
        const dataCompensacao = $("#expenseChequeDate").value;
        const banco = $("#expenseChequeBank").value.trim();
        if (!dataCompensacao || !banco) {
          showToast("Cheque exige banco e data de compensação.", "error");
          return;
        }
        payload.paymentDetails = { tipo: "cheque", dataCompensacao, banco, vencimento: dataCompensacao };
      }
      let schedules = [];
      if (paymentMethod === "cartao_credito") {
        const cardId = $("#expenseCard").value;
        const buyerId = $("#expenseBuyer").value;
        const installments = Number($("#expenseInstallments").value || 1);
        if (!cardId || !buyerId) {
          showToast("Selecione cartão e comprador.", "error");
          return;
        }
        payload.cardId = cardId;
        payload.buyerId = buyerId;
        payload.installments = installments;
        payload.paymentDetails = { tipo: "cartao_credito", parcelas: installments };
        schedules = buildCardSchedules({
          cards: state.data.cards, uid, sourceType: "expense", sourceId: payload.id,
          description, cardId, buyerId, baseDate: payload.data, totalValue: value,
          parcelas: installments, firstStatus: status, vehicleId: payload.veiculoId,
          employeeId: payload.funcionarioId, category, extra: payload.descricaoGasto,
        });
      }
      try {
        await saveFirestoreRecord("Expense", "expenses", payload, { prepend: true });
        for (const schedule of schedules) {
          await saveFirestoreRecord("CardSchedule", "cardSchedules", schedule, { prepend: true });
        }
        onRenderAll();
        clearExpenseForm();
        showToast("Despesa salva com sucesso.", "success");
      } catch (error) {
        console.error("Erro ao salvar despesa:", error);
        showToast(error.message || "Não foi possível salvar a despesa.", "error");
      }
    });
  }

  async function deleteExpense(id) {
    if (!confirm("Tem certeza que deseja excluir esta despesa? Essa ação não pode ser desfeita.")) return;
    const expense = state.data.expenses.find((item) => item.id === id);
    if (!expense) {
      showToast("Despesa não encontrada.", "error");
      return;
    }
    try {
      const schedules = state.data.cardSchedules.filter(
        (item) => item.sourceType === "expense" && item.sourceId === id,
      );
      await Promise.all([
        removeFirestoreRecord("Expense", "expenses", id),
        ...schedules.map((item) => removeFirestoreRecord("CardSchedule", "cardSchedules", item.id)),
      ]);
    } catch (error) {
      console.error("Erro ao excluir despesa:", error);
      showToast(error.message || "Não foi possível excluir a despesa.", "error");
      return;
    }
    onRenderAll();
    showToast("Despesa excluída com sucesso.", "success");
  }

  return {
    bindExpenseForm,
    clearExpenseForm,
    deleteExpense,
    renderExpenseTable,
    startEmployeePayment,
    toggleExpenseFields,
  };
}
