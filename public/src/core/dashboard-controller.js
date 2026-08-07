import {
  $,
  categoryLabel,
  currency,
  formatDate,
  monthNow,
} from "./controller-helpers.js";

export function createDashboardController({ state, getVehicleName }) {
  function getOperationalCategoryTotals() {
    const totals = {};
    state.data.expenses.forEach((item) => {
      const label = categoryLabel(item.categoria);
      totals[label] = (totals[label] || 0) + Number(item.valor || 0);
    });
    state.data.fuelings.forEach((item) => {
      totals.Abastecimento =
        (totals.Abastecimento || 0) + Number(item.valorTotal || 0);
    });
    return totals;
  }

  function getVehicleTotals() {
    const totals = {};
    state.data.expenses.forEach((item) => {
      const label = getVehicleName(item.veiculoId);
      totals[label] = (totals[label] || 0) + Number(item.valor || 0);
    });
    state.data.fuelings.forEach((item) => {
      const label = getVehicleName(item.veiculoId);
      totals[label] = (totals[label] || 0) + Number(item.valorTotal || 0);
    });
    return totals;
  }

  function renderKPIs() {
    const currentMonth = monthNow();
    const directExpenses = state.data.expenses
      .filter((item) => item.paymentMethod !== "cartao_credito")
      .filter((item) => (item.data || "").startsWith(currentMonth))
      .reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const fuelExpenses = state.data.fuelings
      .filter((item) => item.paymentMethod !== "cartao_credito")
      .filter((item) => (item.data || "").startsWith(currentMonth))
      .reduce((sum, item) => sum + Number(item.valorTotal || 0), 0);
    const cardExpenses = state.data.cardSchedules
      .filter((item) => (item.vencimento || "").startsWith(currentMonth))
      .reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const monthTrips = state.data.trips.filter(
      (item) =>
        (item.departureDate || "").startsWith(currentMonth) &&
        item.status !== "Cancelada",
    );
    const expectedRevenue = monthTrips.reduce(
      (sum, item) => sum + Number(item.finalValue || 0),
      0,
    );
    const monthExpenses = directExpenses + fuelExpenses + cardExpenses;
    const activeVehicles = state.data.vehicles.filter(
      (vehicle) => vehicle.status !== "inativo",
    ).length;
    const activeEmployees = state.data.employees.filter(
      (employee) => employee.status !== "inativo",
    ).length;
    const lastFuel = [...state.data.fuelings].sort((a, b) =>
      (b.data || "").localeCompare(a.data || ""),
    )[0];
    $("#kpiReceitas").textContent = currency(expectedRevenue);
    $("#kpiDespesas").textContent = currency(monthExpenses);
    $("#kpiSaldo").textContent = currency(expectedRevenue - monthExpenses);
    $("#kpiViagens").textContent = monthTrips.length;
    $("#resumoVeiculos").textContent = activeVehicles;
    $("#resumoFuncionarios").textContent = activeEmployees;
    $("#resumoUltimoAbastecimento").textContent = lastFuel
      ? `${getVehicleName(lastFuel.veiculoId)} • ${formatDate(lastFuel.data)}`
      : "Sem registro";
  }

  function destroyCharts() {
    if (state.charts.categories) state.charts.categories.destroy();
    if (state.charts.vehicles) state.charts.vehicles.destroy();
  }

  function shortCategoryLabel(label = "") {
    const map = {
      "Peças e manutenção": "Manutenção",
      "Materiais de limpeza": "Limpeza",
      "Salários / Adiantamentos": "Salários",
      "Impostos, taxas": "Impostos",
      "Viagens por fora (Extras)": "Extras",
      Abastecimento: "Combustível",
    };

    return map[label] || label;
  }

  function renderCharts() {
    destroyCharts();

    const byCategory = getOperationalCategoryTotals();
    const byVehicle = getVehicleTotals();

    const categoryLabels = Object.keys(byCategory);
    const categoryValues = Object.values(byCategory);

    const vehicleLabels = Object.keys(byVehicle);
    const vehicleValues = Object.values(byVehicle);

    state.charts.categories = new Chart($("#chartCategorias"), {
      type: "bar",
      data: {
        labels: categoryLabels.length
          ? categoryLabels.map(shortCategoryLabel)
          : ["Sem dados"],
        datasets: [
          {
            label: "Gastos",
            data: categoryValues.length ? categoryValues : [0],
            borderRadius: 16,
            borderSkipped: false,
            backgroundColor: "rgba(17, 17, 19, 0.88)",
            maxBarThickness: 54,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: 8 },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "#111113",
            padding: 12,
            cornerRadius: 12,
            callbacks: {
              label(context) {
                return currency(context.raw || 0);
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: "#64748b", font: { size: 12, weight: "500" } },
          },
          y: {
            beginAtZero: true,
            grid: { color: "rgba(148, 163, 184, 0.18)" },
            ticks: {
              color: "#64748b",
              callback(value) {
                return currency(value);
              },
            },
          },
        },
      },
    });

    state.charts.vehicles = new Chart($("#chartVeiculos"), {
      type: "doughnut",
      data: {
        labels: vehicleLabels.length ? vehicleLabels : ["Sem dados"],
        datasets: [
          {
            label: "Gastos",
            data: vehicleValues.length ? vehicleValues : [1],
            backgroundColor: [
              "rgba(17, 17, 19, 0.92)",
              "rgba(204, 31, 31, 0.86)",
              "rgba(71, 85, 105, 0.78)",
              "rgba(148, 163, 184, 0.78)",
              "rgba(30, 41, 59, 0.78)",
            ],
            borderColor: "#ffffff",
            borderWidth: 6,
            hoverOffset: 8,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "72%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              usePointStyle: true,
              pointStyle: "circle",
              padding: 18,
              color: "#334155",
              font: { size: 12, weight: "500" },
            },
          },
          tooltip: {
            backgroundColor: "#111113",
            padding: 12,
            cornerRadius: 12,
            callbacks: {
              label(context) {
                return `${context.label}: ${currency(context.raw || 0)}`;
              },
            },
          },
        },
      },
    });
  }

  return { renderKPIs, renderCharts };
}
