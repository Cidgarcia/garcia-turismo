import { safeHTML } from "../utils/dom.js";

export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => [...document.querySelectorAll(selector)];
export const currency = (value = 0) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
export const today = () => new Date().toISOString().slice(0, 10);
export const monthNow = () => new Date().toISOString().slice(0, 7);
export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
export const formatDate = (value) =>
  value ? new Date(value + "T00:00:00").toLocaleDateString("pt-BR") : "-";

export function escapeHtml(value = "") {
  return safeHTML(value);
}

export function slugify(value = "garcia_turismo") {
  return (
    String(value)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "garcia_turismo"
  );
}

export function categoryLabel(value) {
  return (
    {
      pecas_manutencao: "Peças e manutenção",
      materiais_limpeza: "Materiais de limpeza",
      salarios_adiantamentos: "Salários / Adiantamentos",
      viagens_extras: "Viagens por fora (Extras)",
      outros: "Outros",
      combustivel: "Abastecimento",
    }[value] ||
    value ||
    "-"
  );
}

export function paymentLabel(value) {
  return (
    {
      pix: "PIX",
      dinheiro: "Dinheiro",
      cartao_credito: "Cartão de crédito",
      cheque: "Cheque",
    }[value] ||
    value ||
    "-"
  );
}

export function getVehicleBaseName(vehicle) {
  if (!vehicle) return "-";
  return `${vehicle.modelo} ${vehicle.ano} - ${vehicle.cor}`;
}

export function getVehicleDisplayName(vehicle) {
  if (!vehicle) return "-";
  const seats = Number(vehicle.lugares || 0);
  return seats > 0
    ? `${getVehicleBaseName(vehicle)} (${seats} lugares)`
    : getVehicleBaseName(vehicle);
}

export function createStateLookups(state) {
  return {
    getVehicleName(id) {
      const item = state.data.vehicles.find((vehicle) => vehicle.id === id);
      return item ? getVehicleBaseName(item) : "-";
    },
    getEmployeeName(id) {
      const item = state.data.employees.find((employee) => employee.id === id);
      return item ? item.nome : "-";
    },
    getBuyerName(id) {
      const item = state.data.buyers.find((buyer) => buyer.id === id);
      return item ? item.nome : "-";
    },
    getCardName(id) {
      const item = state.data.cards.find((card) => card.id === id);
      return item ? item.nome : "-";
    },
  };
}

export function rowStatusBadge(status) {
  if (status === "Pago")
    return '<span class="status-badge status-paid">Pago</span>';
  if (status === "A pagar")
    return '<span class="status-badge status-pending">A pagar</span>';
  if (status === "Futuro")
    return '<span class="status-badge status-future">Futuro</span>';
  return `<span class="status-badge status-scheduled">${escapeHtml(status)}</span>`;
}
