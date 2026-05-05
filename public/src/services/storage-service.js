
import { APP_CONFIG, INITIAL_DATA } from '../config/app-config.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function mergeDefaultCards(cards = [], defaults = []) {
  const byId = new Map((cards || []).map((card) => [card.id, card]));
  defaults.forEach((card) => {
    if (!byId.has(card.id)) byId.set(card.id, card);
  });
  return [...byId.values()];
}

function normalizeData(data = {}) {
  const base = clone(INITIAL_DATA);
  const cards = Array.isArray(data.cards) && data.cards.length
    ? mergeDefaultCards(data.cards, base.cards || [])
    : base.cards || [];

  return {
    ...base,
    ...data,
    vehicles: (data.vehicles || base.vehicles || []).map((vehicle) => ({
      ...vehicle,
      lugares: Number(vehicle.lugares || (String(vehicle.modelo || '').toLowerCase().includes('ducato') ? 15 : 46))
    })),
    buyers: data.buyers || base.buyers || [],
    employees: data.employees || base.employees || [],
    cards,
    expenses: data.expenses || base.expenses || [],
    fuelings: data.fuelings || base.fuelings || [],
    cardSchedules: data.cardSchedules || base.cardSchedules || [],
    trips: data.trips || base.trips || []
  };
}

export const storageService = {
  load() {
    const raw = localStorage.getItem(APP_CONFIG.storageKey);
    if (!raw) return normalizeData();
    try {
      return normalizeData(JSON.parse(raw));
    } catch (error) {
      console.warn('Falha ao ler localStorage, restaurando seed.', error);
      return normalizeData();
    }
  },
  save(data) {
    const normalized = normalizeData(data);
    localStorage.setItem(APP_CONFIG.storageKey, JSON.stringify(normalized));
    return normalized;
  },
  exportJson(data) {
    return JSON.stringify(normalizeData(data), null, 2);
  },
  downloadBackup(data, fileName = APP_CONFIG.backupFileName) {
    const blob = new Blob([this.exportJson(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  },
  maybeAutoBackup(data) {
    const now = new Date().toISOString();
    localStorage.setItem(APP_CONFIG.autoBackupKey, now);
    return now;
  }
};
