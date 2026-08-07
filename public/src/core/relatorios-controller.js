import {
  $,
  categoryLabel,
  currency,
  escapeHtml,
  formatDate,
  paymentLabel,
  rowStatusBadge,
} from "./controller-helpers.js";

export function createRelatoriosController({
  state,
  databaseService,
  getBuyerName,
  getCardName,
  getEmployeeName,
  getVehicleName,
  logoPath,
  onRenderAll,
  showToast,
  today,
}) {
  function getFilteredReportRows() {
    const month = $("#reportMonth").value;
    const vehicleId = $("#reportVehicle").value;
    const employeeId = $("#reportEmployee").value;

    const expenseRows = state.data.expenses
      .filter((item) => item.paymentMethod !== "cartao_credito")
      .map((item) => ({
        sourceRowType: "expense",
        sourceId: item.id,
        data: item.data,
        type: "Despesa",
        category: categoryLabel(item.categoria),
        description: item.descricao + (item.descricaoGasto ? ` • ${item.descricaoGasto}` : ""),
        veiculoId: item.veiculoId || "",
        vehicle: getVehicleName(item.veiculoId),
        funcionarioId: item.funcionarioId || "",
        employee: getEmployeeName(item.funcionarioId),
        payment: paymentLabel(item.paymentMethod),
        status: item.status === "pago" ? "Pago" : "A pagar",
        value: Number(item.valor || 0),
      }));

    const fuelRows = state.data.fuelings
      .filter((item) => item.paymentMethod !== "cartao_credito")
      .map((item) => ({
        sourceRowType: "fuel",
        sourceId: item.id,
        data: item.data,
        type: "Combustível",
        category: "Abastecimento",
        description: `${item.litros} L • ${item.mediaKmLitro.toFixed(2)} km/l`,
        veiculoId: item.veiculoId || "",
        vehicle: getVehicleName(item.veiculoId),
        funcionarioId: "",
        employee: "-",
        payment: paymentLabel(item.paymentMethod),
        status: item.status === "pago" ? "Pago" : "A pagar",
        value: Number(item.valorTotal || 0),
      }));

    const scheduleRows = state.data.cardSchedules.map((item) => ({
      sourceRowType: "schedule",
      sourceId: item.id,
      data: item.vencimento,
      type: item.sourceType === "fuel" ? "Combustível" : "Despesa",
      category: item.sourceType === "fuel" ? "Abastecimento" : categoryLabel(item.category),
      description: `${item.description} • ${item.parcela}/${item.totalParcelas}`,
      veiculoId: item.veiculoId || "",
      vehicle: getVehicleName(item.veiculoId),
      funcionarioId: item.funcionarioId || "",
      employee: getEmployeeName(item.funcionarioId),
      payment: `Cartão ${getCardName(item.cardId)} • ${item.totalParcelas}x`,
      status: item.status === "pago" ? "Pago" : "Futuro",
      value: Number(item.valor || 0),
    }));

    return [...expenseRows, ...fuelRows, ...scheduleRows]
      .filter((item) => {
        const okMonth = !month || (item.data || "").startsWith(month);
        const okVehicle = !vehicleId || item.veiculoId === vehicleId;
        const okEmployee = !employeeId || item.funcionarioId === employeeId;
        return okMonth && okVehicle && okEmployee;
      })
      .sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }

  function reportActions(item) {
    const canUndo = item.status === "Pago";
    return `
          <div class="flex justify-end gap-2 no-print">
            ${canUndo ? `<button class="rounded-xl px-3 py-2 btn-secondary text-sm font-semibold" data-action="undo-report-payment" data-row-type="${escapeHtml(item.sourceRowType)}" data-id="${escapeHtml(item.sourceId)}">Estornar baixa</button>` : ""}
            <button class="rounded-xl px-3 py-2 btn-secondary text-sm font-semibold text-red-600" data-action="delete-report-entry" data-row-type="${escapeHtml(item.sourceRowType)}" data-id="${escapeHtml(item.sourceId)}">Excluir</button>
          </div>`;
  }

  function renderReport() {
    const rows = getFilteredReportRows();
    $("#reportTable").innerHTML =
      rows
        .map(
          (item) => `
          <tr>
            <td>${formatDate(item.data)}</td>
            <td>${escapeHtml(item.type)}</td>
            <td>${escapeHtml(item.category)}</td>
            <td>${escapeHtml(item.description)}</td>
            <td>${escapeHtml(item.vehicle)}</td>
            <td>${escapeHtml(item.employee)}</td>
            <td>${escapeHtml(item.payment)}</td>
            <td>${rowStatusBadge(item.status)}</td>
            <td class="text-right">${currency(item.value)}</td>
            <td class="text-right no-print">${reportActions(item)}</td>
          </tr>`,
        )
        .join("") ||
      '<tr><td colspan="10" class="text-center muted py-6">Nenhum lançamento encontrado.</td></tr>';
    $("#reportTotal").textContent = currency(
      rows.reduce((accumulator, item) => accumulator + Number(item.value || 0), 0),
    );
    $("#reportCount").textContent = rows.length;
    $("#reportGeneratedAt").textContent = new Date().toLocaleString("pt-BR");
  }

  function getPendingRows() {
    const directExpenses = state.data.expenses
      .filter((item) => item.paymentMethod !== "cartao_credito" && item.status === "a_pagar")
      .map((item) => ({
        id: item.id,
        rowType: "expense",
        vencimento: item.paymentDetails?.dataCompensacao || item.data,
        kind: "Conta",
        descricao: item.descricao,
        origem: paymentLabel(item.paymentMethod),
        valor: Number(item.valor || 0),
      }));
    const directFuel = state.data.fuelings
      .filter((item) => item.paymentMethod !== "cartao_credito" && item.status === "a_pagar")
      .map((item) => ({
        id: item.id,
        rowType: "fuel",
        vencimento: item.paymentDetails?.dataCompensacao || item.data,
        kind: "Combustível",
        descricao: `${getVehicleName(item.veiculoId)} • ${item.litros} L`,
        origem: paymentLabel(item.paymentMethod),
        valor: Number(item.valorTotal || 0),
      }));
    const cardSchedules = state.data.cardSchedules
      .filter((item) => item.status === "a_pagar")
      .map((item) => ({
        id: item.id,
        rowType: "schedule",
        vencimento: item.vencimento,
        kind: item.sourceType === "fuel" ? "Parcela combustível" : "Parcela despesa",
        descricao: `${item.description} • ${item.parcela}/${item.totalParcelas}`,
        origem: `${getCardName(item.cardId)} • ${getBuyerName(item.buyerId)}`,
        valor: Number(item.valor || 0),
      }));
    return [...directExpenses, ...directFuel, ...cardSchedules].sort((a, b) =>
      (a.vencimento || "").localeCompare(b.vencimento || ""),
    );
  }

  function renderPending() {
    const rows = getPendingRows();
    $("#pendingTable").innerHTML =
      rows
        .map(
          (item) => `
          <tr>
            <td>${formatDate(item.vencimento)}</td>
            <td>${escapeHtml(item.kind)}</td>
            <td>${escapeHtml(item.descricao)}</td>
            <td>${escapeHtml(item.origem)}</td>
            <td>${currency(item.valor)}</td>
            <td class="text-right">
              <button class="rounded-xl px-3 py-2 btn-primary text-sm font-semibold" data-action="mark-pending-paid" data-row-type="${escapeHtml(item.rowType)}" data-id="${escapeHtml(item.id)}">Dar baixa</button>
            </td>
          </tr>`,
        )
        .join("") ||
      '<tr><td colspan="6" class="text-center muted py-6">Nenhuma pendência no momento.</td></tr>';
  }

  async function deleteReportEntry(rowType, id) {
    if (!confirm("Tem certeza que deseja excluir este lançamento do relatório? Essa ação não pode ser desfeita.")) return;
    const configuration = {
      expense: { recordType: "Expense", listName: "expenses" },
      fuel: { recordType: "Fueling", listName: "fuelings" },
      schedule: { recordType: "CardSchedule", listName: "cardSchedules" },
    }[rowType];
    if (!configuration || !state.data[configuration.listName].some((item) => item.id === id)) {
      showToast("Lançamento não encontrado.", "error");
      return;
    }
    try {
      const schedules = rowType === "schedule" ? [] : state.data.cardSchedules.filter(
        (item) => item.sourceType === rowType && item.sourceId === id,
      );
      await Promise.all([
        databaseService.remove(configuration.recordType, id),
        ...schedules.map((item) => databaseService.remove("CardSchedule", item.id)),
      ]);
    } catch (error) {
      console.error("Erro ao excluir lançamento:", error);
      showToast(error.message || "Não foi possível excluir o lançamento.", "error");
      return;
    }
    if (rowType === "expense") {
      state.data.expenses = state.data.expenses.filter((item) => item.id !== id);
      state.data.cardSchedules = state.data.cardSchedules.filter(
        (item) => !(item.sourceType === "expense" && item.sourceId === id),
      );
    }
    if (rowType === "fuel") {
      state.data.fuelings = state.data.fuelings.filter((item) => item.id !== id);
      state.data.cardSchedules = state.data.cardSchedules.filter(
        (item) => !(item.sourceType === "fuel" && item.sourceId === id),
      );
    }
    if (rowType === "schedule") {
      state.data.cardSchedules = state.data.cardSchedules.filter((item) => item.id !== id);
    }
    onRenderAll();
    showToast("Lançamento excluído com sucesso.", "success");
  }

  async function undoReportPayment(rowType, id) {
    if (!confirm("Tem certeza que deseja estornar esta baixa?")) return;
    const item = rowType === "expense"
      ? state.data.expenses.find((entry) => entry.id === id)
      : rowType === "fuel"
        ? state.data.fuelings.find((entry) => entry.id === id)
        : state.data.cardSchedules.find((entry) => entry.id === id);
    if (!item) {
      showToast("Lançamento não encontrado.", "error");
      return;
    }
    const recordType = rowType === "expense" ? "Expense" : rowType === "fuel" ? "Fueling" : "CardSchedule";
    const status = rowType === "schedule" ? "futuro" : "a_pagar";
    try {
      await databaseService.update(recordType, id, { ...item, status });
      item.status = status;
    } catch (error) {
      console.error("Erro ao estornar baixa:", error);
      showToast(error.message || "Não foi possível estornar a baixa.", "error");
      return;
    }
    onRenderAll();
    showToast("Baixa estornada com sucesso.", "success");
  }

  async function markPendingAsPaid(rowType, id) {
    if (!confirm("Tem certeza que deseja dar baixa nesta pendência?")) return;
    const configuration = {
      expense: { recordType: "Expense", listName: "expenses" },
      fuel: { recordType: "Fueling", listName: "fuelings" },
      schedule: { recordType: "CardSchedule", listName: "cardSchedules" },
    }[rowType];
    const item = configuration
      ? state.data[configuration.listName].find((entry) => entry.id === id)
      : null;
    if (!item || !configuration) {
      showToast("Lançamento não encontrado.", "error");
      return;
    }
    try {
      await databaseService.update(configuration.recordType, id, { ...item, status: "pago" });
      item.status = "pago";
    } catch (error) {
      console.error("Erro ao dar baixa na pendência:", error);
      showToast(error.message || "Não foi possível dar baixa na pendência.", "error");
      return;
    }
    onRenderAll();
    showToast("Pendência baixada com sucesso.", "success");
  }

  function bindReports() {
    $("#applyFiltersBtn").addEventListener("click", renderReport);
    $("#exportPdfBtn").addEventListener("click", exportPdf);
  }

  async function exportPdf() {
    renderReport();
    const source = $("#reportArea").cloneNode(true);
    source.classList.add("report-document");
    source.querySelectorAll(".no-print").forEach((element) => element.remove());
    const header = document.createElement("div");
    header.className = "report-export-header";
    header.innerHTML = `
          <div><img src="${logoPath}" alt="Garcia Turismo"></div>
          <div class="report-export-header__meta">
            <div>Relatório Garcia Turismo</div>
            <div>Emitido em ${new Date().toLocaleString("pt-BR")}</div>
          </div>`;
    source.prepend(header);
    const wrap = document.createElement("div");
    wrap.className = "report-export-shell";
    wrap.appendChild(source);
    document.body.appendChild(wrap);
    try {
      if (typeof html2pdf !== "undefined") {
        await html2pdf().set({
          margin: 0.28,
          filename: `relatorio_garcia_turismo_${today()}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
          jsPDF: { unit: "in", format: "a4", orientation: "landscape" },
          pagebreak: { mode: ["avoid-all", "css", "legacy"] },
        }).from(source).save();
      } else {
        const printWin = window.open("", "_blank");
        printWin.document.write(`<html><head><title>Relatório Garcia Turismo</title></head><body>${source.outerHTML}</body></html>`);
        printWin.document.close();
        printWin.focus();
        printWin.print();
      }
      showToast("PDF gerado com sucesso.", "success");
    } catch (error) {
      console.error(error);
      showToast("Erro ao gerar o relatório. Tente abrir com Live Server.", "error");
    } finally {
      document.body.removeChild(wrap);
    }
  }

  return {
    bindReports,
    deleteReportEntry,
    markPendingAsPaid,
    renderPending,
    renderReport,
    undoReportPayment,
  };
}
