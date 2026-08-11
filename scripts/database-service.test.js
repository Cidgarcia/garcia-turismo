import assert from "node:assert/strict";
import test from "node:test";

import { createDatabaseService } from "../public/src/services/database-service.js";

function createFirebaseExpenseStub() {
  const expenses = [];
  const calls = [];

  return {
    calls,
    isConfigured: () => true,
    async createExpense(payload) {
      calls.push({ method: "createExpense", payload });
      const savedExpense = {
        id: "expense-mock-1",
        ...payload,
        companyId: "garcia-turismo",
        createdBy: "admin-test",
      };

      expenses.push(savedExpense);
      return savedExpense;
    },
    async loadOperationalData() {
      calls.push({ method: "loadOperationalData" });
      return {
        vehicles: [],
        expenses: [...expenses],
        trips: [],
        fuelings: [],
        employees: [],
        cards: [],
        buyers: [],
        cardSchedules: [],
      };
    },
  };
}

test("database service persiste e recupera uma despesa pelo adaptador Firebase", async () => {
  const firebaseAdapter = createFirebaseExpenseStub();
  const service = createDatabaseService(firebaseAdapter);
  const expense = {
    data: "2026-08-10",
    categoria: "pecas_manutencao",
    descricao: "Troca de óleo",
    descricaoGasto: "",
    valor: 100,
    veiculoId: "vehicle-1",
    vehicleId: "vehicle-1",
    funcionarioId: "",
    employeeId: "",
    paymentMethod: "pix",
    status: "pago",
    comprovanteUrl: "",
    paymentDetails: {
      tipo: "pix",
      instantaneo: true,
      vencimento: "2026-08-10",
    },
  };

  const savedExpense = await service.create("Expense", expense);
  const operationalData = await service.loadRemote();

  assert.deepEqual(firebaseAdapter.calls, [
    { method: "createExpense", payload: expense },
    { method: "loadOperationalData" },
  ]);
  assert.deepEqual(savedExpense, {
    id: "expense-mock-1",
    ...expense,
    companyId: "garcia-turismo",
    createdBy: "admin-test",
  });
  assert.deepEqual(operationalData.expenses, [savedExpense]);
  assert.equal(operationalData.expenses[0].companyId, "garcia-turismo");
  assert.equal(operationalData.expenses[0].createdBy, "admin-test");
});

test("database service propaga permission-denied retornado pelo adaptador Firebase", async () => {
  const permissionError = Object.assign(
    new Error("Missing or insufficient permissions."),
    { code: "permission-denied" },
  );
  const service = createDatabaseService({
    isConfigured: () => true,
    createExpense: async () => {
      throw permissionError;
    },
  });

  await assert.rejects(
    service.create("Expense", { valor: 100 }),
    (error) => error === permissionError && error.code === "permission-denied",
  );
});
