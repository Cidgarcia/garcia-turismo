import {
  $,
  categoryLabel,
  currency,
  formatDate,
  monthNow,
} from "./controller-helpers.js";

const BAR_GRADIENT_STOPS = {
  Manutenção: {
    top: "#ff5c6c",
    mid: "#e11d48",
    bottom: "#991b1b",
    hoverTop: "#ff7583",
    hoverMid: "#f43f5e",
    hoverBottom: "#b91c1c",
    border: "rgba(225, 29, 72, 0.5)",
  },
  Salários: {
    top: "#60a5fa",
    mid: "#2563eb",
    bottom: "#1e3a8a",
    hoverTop: "#93c5fd",
    hoverMid: "#3b82f6",
    hoverBottom: "#1d4ed8",
    border: "rgba(37, 99, 235, 0.5)",
  },
  Combustível: {
    top: "#fb923c",
    mid: "#ea580c",
    bottom: "#9a3412",
    hoverTop: "#fdba74",
    hoverMid: "#f97316",
    hoverBottom: "#c2410c",
    border: "rgba(234, 88, 12, 0.5)",
  },
  Limpeza: {
    top: "#34d399",
    mid: "#10b981",
    bottom: "#047857",
    hoverTop: "#6ee7b7",
    hoverMid: "#34d399",
    hoverBottom: "#059669",
    border: "rgba(16, 185, 129, 0.5)",
  },
  Extras: {
    top: "#c084fc",
    mid: "#9333ea",
    bottom: "#581c87",
    hoverTop: "#d8b4fe",
    hoverMid: "#a855f7",
    hoverBottom: "#6b21a8",
    border: "rgba(147, 51, 234, 0.5)",
  },
  Impostos: {
    top: "#38bdf8",
    mid: "#0284c7",
    bottom: "#075985",
    hoverTop: "#7dd3fc",
    hoverMid: "#0ea5e9",
    hoverBottom: "#0369a1",
    border: "rgba(2, 132, 199, 0.5)",
  },
};

const FALLBACK_BAR_PALETTE = [
  BAR_GRADIENT_STOPS.Manutenção,
  BAR_GRADIENT_STOPS.Salários,
  BAR_GRADIENT_STOPS.Combustível,
  BAR_GRADIENT_STOPS.Limpeza,
  BAR_GRADIENT_STOPS.Extras,
  {
    top: "#94a3b8",
    mid: "#475569",
    bottom: "#0f172a",
    hoverTop: "#cbd5e1",
    hoverMid: "#64748b",
    hoverBottom: "#1e293b",
    border: "rgba(71, 85, 105, 0.45)",
  },
];

const DOUGHNUT_PALETTE = [
  ["#f87171", "#dc2626", "#7f1d1d"],
  ["#475569", "#1e293b", "#090d16"],
  ["#60a5fa", "#2563eb", "#172554"],
  ["#fb923c", "#ea580c", "#7c2d12"],
  ["#34d399", "#0d9488", "#134e4a"],
  ["#c084fc", "#7c3aed", "#3b0764"],
];

function createBarGradient(context, isHover = false) {
  const { chart, dataIndex } = context;
  const { ctx, chartArea } = chart;
  const label = chart.data?.labels?.[dataIndex] || "";
  const stops =
    BAR_GRADIENT_STOPS[label] ||
    FALLBACK_BAR_PALETTE[dataIndex % FALLBACK_BAR_PALETTE.length];

  if (!chartArea) {
    return isHover ? stops.hoverMid : stops.mid;
  }

  const yScale = chart.scales?.y;
  const rawVal = Number(context.raw ?? chart.data?.datasets?.[0]?.data?.[dataIndex] ?? 0);
  const scaleTopY = yScale ? yScale.getPixelForValue(rawVal) : chartArea.top;
  const topY = Number.isFinite(scaleTopY)
    ? Math.min(scaleTopY, chartArea.bottom - 20)
    : chartArea.top;

  const gradient = ctx.createLinearGradient(0, topY, 0, chartArea.bottom);
  gradient.addColorStop(0, isHover ? stops.hoverTop : stops.top);
  gradient.addColorStop(0.52, isHover ? stops.hoverMid : stops.mid);
  gradient.addColorStop(1, isHover ? stops.hoverBottom : stops.bottom);
  return gradient;
}

function createDoughnutGradient(context) {
  const { chart, dataIndex } = context;
  const { ctx, chartArea } = chart;
  const [c1, c2, c3] = DOUGHNUT_PALETTE[dataIndex % DOUGHNUT_PALETTE.length];
  if (!chartArea) return c2;
  const gradient = ctx.createLinearGradient(
    chartArea.left,
    chartArea.top,
    chartArea.right,
    chartArea.bottom,
  );
  gradient.addColorStop(0, c1);
  gradient.addColorStop(0.55, c2);
  gradient.addColorStop(1, c3);
  return gradient;
}

const barDepthShadowPlugin = {
  id: "barDepthShadow",
  beforeDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.shadowColor = "rgba(15, 23, 42, 0.16)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 6;
  },
  afterDatasetsDraw(chart) {
    chart.ctx.restore();
  },
};

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
      const raw = item.veiculoId ? getVehicleName(item.veiculoId) : "";
      const label = !raw || raw === "-" ? "Geral / Sem veículo" : raw;
      totals[label] = (totals[label] || 0) + Number(item.valor || 0);
    });
    state.data.fuelings.forEach((item) => {
      const raw = item.veiculoId ? getVehicleName(item.veiculoId) : "";
      const label = !raw || raw === "-" ? "Geral / Sem veículo" : raw;
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
    const mappedCategoryLabels = categoryLabels.length
      ? categoryLabels.map(shortCategoryLabel)
      : ["Sem dados"];

    const vehicleLabels = Object.keys(byVehicle);
    const vehicleValues = Object.values(byVehicle);
    const totalVehicleSpend = vehicleValues.reduce((acc, v) => acc + Number(v || 0), 0);

    const doughnutCenterPlugin = {
      id: "doughnutCenterTotal",
      afterDraw(chart) {
        if (!vehicleValues.length) return;
        const meta = chart.getDatasetMeta(0);
        if (!meta?.data?.length) return;
        const { x, y } = meta.data[0];
        const { ctx } = chart;
        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#64748b";
        ctx.font = "600 11px Inter, system-ui, sans-serif";
        ctx.fillText("TOTAL ACUMULADO", x, y - 11);
        ctx.fillStyle = "#0f172a";
        ctx.font = "800 15px Inter, system-ui, sans-serif";
        ctx.fillText(currency(totalVehicleSpend), x, y + 10);
        ctx.restore();
      },
    };

    state.charts.categories = new Chart($("#chartCategorias"), {
      type: "bar",
      plugins: [barDepthShadowPlugin],
      data: {
        labels: mappedCategoryLabels,
        datasets: [
          {
            label: "Gastos",
            data: categoryValues.length ? categoryValues : [0],
            borderRadius: { topLeft: 14, topRight: 14, bottomLeft: 6, bottomRight: 6 },
            borderSkipped: false,
            backgroundColor: (ctx) => createBarGradient(ctx, false),
            hoverBackgroundColor: (ctx) => createBarGradient(ctx, true),
            borderColor: (ctx) => {
              const lbl = mappedCategoryLabels[ctx.dataIndex] || "";
              return (
                BAR_GRADIENT_STOPS[lbl]?.border ||
                FALLBACK_BAR_PALETTE[ctx.dataIndex % FALLBACK_BAR_PALETTE.length].border
              );
            },
            borderWidth: 1,
            maxBarThickness: 56,
            categoryPercentage: 0.72,
            barPercentage: 0.86,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 12, right: 8, bottom: 4, left: 4 } },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.96)",
            titleColor: "#f8fafc",
            bodyColor: "#e2e8f0",
            borderColor: "rgba(255, 255, 255, 0.12)",
            borderWidth: 1,
            padding: 12,
            cornerRadius: 12,
            displayColors: true,
            callbacks: {
              label(context) {
                return ` ${currency(context.raw || 0)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: "rgba(148, 163, 184, 0.3)" },
            ticks: { color: "#475569", font: { size: 12, weight: "600" } },
          },
          y: {
            beginAtZero: true,
            border: { display: false, dash: [4, 4] },
            grid: { color: "rgba(148, 163, 184, 0.18)" },
            ticks: {
              color: "#64748b",
              font: { size: 11.5, weight: "500" },
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
      plugins: [barDepthShadowPlugin, doughnutCenterPlugin],
      data: {
        labels: vehicleLabels.length ? vehicleLabels : ["Sem dados"],
        datasets: [
          {
            label: "Gastos",
            data: vehicleValues.length ? vehicleValues : [1],
            backgroundColor: (ctx) => createDoughnutGradient(ctx),
            borderColor: "#ffffff",
            borderWidth: 5,
            hoverOffset: 10,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "70%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              usePointStyle: true,
              pointStyle: "circle",
              padding: 16,
              color: "#334155",
              font: { size: 11.5, weight: "600" },
            },
          },
          tooltip: {
            backgroundColor: "rgba(15, 23, 42, 0.96)",
            padding: 12,
            cornerRadius: 12,
            callbacks: {
              label(context) {
                return ` ${context.label}: ${currency(context.raw || 0)}`;
              },
            },
          },
        },
      },
    });
  }

  return { renderKPIs, renderCharts };
}
