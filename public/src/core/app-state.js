export const state = {
  currentTab: "inicio",
  charts: { categories: null, vehicles: null },
  ui: {
    tripMonth: new Date().toISOString().slice(0, 7),
    tripSelectedDate: new Date().toISOString().slice(0, 10),
    tripEditingId: "",
    tripManualBase: false,
    tripManualFinal: false,
    tripPreviewData: null,
  },
  data: {
    employees: [],
    vehicles: [],
    buyers: [],
    cards: [],
    expenses: [],
    fuelings: [],
    cardSchedules: [],
    trips: [],
  },
};
