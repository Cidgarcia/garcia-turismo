import { readFile } from "node:fs/promises";
import { after, before, test } from "node:test";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

const PROJECT_ID = process.env.FIREBASE_RULES_TEST_PROJECT || "garciaturismopnz";
const COMPANY_ID = "garcia-turismo";
let environment;

function metadata(uid) {
  return {
    companyId: COMPANY_ID,
    createdBy: uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function vehicle(uid, suffix = "") {
  return {
    ...metadata(uid),
    modelo: `Veículo de teste ${suffix}`,
    ano: 2020,
    cor: "Branco",
    placa: "ABC1D23",
    kmAtual: 100,
    lugares: 20,
    status: "ativo",
  };
}

function expense(uid) {
  return {
    ...metadata(uid),
    data: "2026-08-01",
    categoria: "manutencao",
    descricao: "Manutenção de teste",
    descricaoGasto: "",
    valor: 100,
    veiculoId: "vehicle-seed",
    vehicleId: "vehicle-seed",
    funcionarioId: "",
    employeeId: "",
    paymentMethod: "pix",
    status: "pago",
    comprovanteUrl: "",
    paymentDetails: { tipo: "pix", instantaneo: true, vencimento: "2026-08-01" },
  };
}

function employeePaymentExpense(uid, overrides = {}) {
  const type = overrides.employeePaymentType || "advance";
  const category = ["advance", "salary"].includes(type)
    ? "salarios_adiantamentos"
    : "viagens_extras";
  return {
    ...expense(uid),
    categoria: category,
    veiculoId: "",
    vehicleId: "",
    funcionarioId: "employee-seed",
    employeeId: "employee-seed",
    employeePaymentType: type,
    competenceMonth: "2026-08",
    ...overrides,
  };
}

function alexandreAdvance(uid, overrides = {}) {
  return employeePaymentExpense(uid, {
    data: "2026-08-10",
    categoria: "salarios_adiantamentos",
    descricao: "ADIANTAMENTO BRAGA",
    valor: 80,
    paymentMethod: "pix",
    paymentDetails: { tipo: "pix", instantaneo: true, vencimento: "2026-08-10" },
    status: "pago",
    employeePaymentType: "advance",
    competenceMonth: "2026-08",
    veiculoId: "",
    vehicleId: "",
    ...overrides,
  });
}

function trip(uid) {
  return {
    ...metadata(uid),
    responsible: "Responsável de teste",
    client: "Cliente de teste",
    origin: "Origem",
    destination: "Destino",
    stops: [],
    itinerary: ["Origem", "Destino"],
    vehicleIds: ["vehicle-seed"],
    vehicleId: "vehicle-seed",
    departureDate: "2026-08-10",
    returnDate: "2026-08-11",
    durationDays: 2,
    vehiclesQty: 1,
    oneWayKm: 50,
    totalKm: 100,
    pricePerKm: 5,
    baseValue: 500,
    discount: 0,
    finalValue: 500,
    status: "Proposta",
    emissionDate: "2026-08-01",
  };
}

function fueling(uid) {
  return {
    ...metadata(uid),
    data: "2026-08-02",
    fuelingDate: "2026-08-02",
    veiculoId: "vehicle-seed",
    vehicleId: "vehicle-seed",
    ultimoKm: 100,
    kmAtual: 200,
    litros: 20,
    valorTotal: 120,
    distanciaPercorrida: 100,
    mediaKmLitro: 5,
    precoLitro: 6,
    paymentMethod: "dinheiro",
    status: "pago",
    paymentDetails: { tipo: "dinheiro", instantaneo: true, vencimento: "2026-08-02" },
  };
}

function employee(uid) {
  return {
    ...metadata(uid),
    nome: "ALEXANDRE BRAGA",
    cargo: "Motorista",
    telefone: "11999999999",
    salarioBase: 3000,
    status: "ativo",
  };
}

function dbFor(uid, claims = {}) {
  return environment.authenticatedContext(uid, claims).firestore();
}

before(async () => {
  environment = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: await readFile("firestore.rules", "utf8") },
  });

  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await Promise.all([
      setDoc(doc(db, "users", "admin"), { role: "admin", companyId: COMPANY_ID, active: true }),
      setDoc(doc(db, "users", "finance"), { role: "financeiro", companyId: COMPANY_ID, active: true }),
      setDoc(doc(db, "users", "operator"), { role: "operador", companyId: COMPANY_ID, active: true }),
      setDoc(doc(db, "users", "member"), { role: "member", companyId: COMPANY_ID, active: true }),
      setDoc(doc(db, "users", "inactive"), { role: "admin", companyId: COMPANY_ID, active: false }),
      setDoc(doc(db, "users", "other-company"), { role: "admin", companyId: "outra-empresa", active: true }),
      setDoc(doc(db, "vehicles", "vehicle-seed"), vehicle("admin", "seed")),
      setDoc(doc(db, "employees", "employee-seed"), employee("admin")),
      setDoc(doc(db, "trips", "trip-seed"), trip("admin")),
    ]);
  });
});

after(async () => {
  await environment?.cleanup();
});

test("admin executa CRUD de vehicles, expenses, trips, fuelings e employees", async () => {
  const db = dbFor("admin");
  const cases = [
    ["vehicles", "vehicle-admin", vehicle("admin", "admin"), { kmAtual: 150 }],
    ["expenses", "expense-admin", expense("admin"), { status: "a_pagar" }],
    ["trips", "trip-admin", trip("admin"), { status: "Confirmada" }],
    ["fuelings", "fuel-admin", fueling("admin"), { kmAtual: 220, distanciaPercorrida: 120 }],
    ["employees", "employee-admin", employee("admin"), { cargo: "Motorista líder" }],
  ];

  for (const [collectionName, id, data, update] of cases) {
    const reference = doc(db, collectionName, id);
    await assertSucceeds(setDoc(reference, data));
    await assertSucceeds(updateDoc(reference, { ...update, updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(reference));
  }
});

test("abastecimento legado sem fuelingDate continua atualizável", async () => {
  const admin = dbFor("admin");
  const legacyFueling = fueling("admin");
  delete legacyFueling.fuelingDate;
  const reference = doc(admin, "fuelings", "fuel-legacy");

  await assertSucceeds(setDoc(reference, legacyFueling));
  await assertSucceeds(updateDoc(reference, {
    status: "a_pagar",
    updatedAt: serverTimestamp(),
  }));
});

test("gravação operacional e auditLog passam juntas no mesmo batch", async () => {
  const db = dbFor("admin");
  const batch = writeBatch(db);
  batch.set(doc(db, "vehicles", "vehicle-audited"), vehicle("admin", "audited"));
  batch.set(doc(db, "auditLogs", "audit-vehicle-audited"), {
    action: "create",
    collection: "vehicles",
    documentId: "vehicle-audited",
    companyId: COMPANY_ID,
    createdBy: "admin",
    createdAt: serverTimestamp(),
  });
  await assertSucceeds(batch.commit());
});

test("admin grava o vale de R$ 80 do Alexandre junto com auditLog", async () => {
  const admin = dbFor("admin");
  const expenseId = "alexandre-advance-80";
  const batch = writeBatch(admin);
  batch.set(doc(admin, "expenses", expenseId), alexandreAdvance("admin"));
  batch.set(doc(admin, "auditLogs", "audit-alexandre-advance-80"), {
    action: "create",
    collection: "expenses",
    documentId: expenseId,
    companyId: COMPANY_ID,
    createdBy: "admin",
    createdAt: serverTimestamp(),
  });
  await assertSucceeds(batch.commit());
});

test("dar baixa preserva metadados do pagamento e grava auditLog", async () => {
  const finance = dbFor("finance");
  const expenseId = "alexandre-pending-80";
  const expenseRef = doc(finance, "expenses", expenseId);
  await assertSucceeds(setDoc(expenseRef, alexandreAdvance("finance", { status: "a_pagar" })));

  const batch = writeBatch(finance);
  batch.update(expenseRef, { status: "pago", updatedAt: serverTimestamp() });
  batch.set(doc(finance, "auditLogs", "audit-alexandre-pending-80"), {
    action: "update",
    collection: "expenses",
    documentId: expenseId,
    companyId: COMPANY_ID,
    createdBy: "finance",
    createdAt: serverTimestamp(),
  });
  await assertSucceeds(batch.commit());
});

test("financeiro somente altera despesas", async () => {
  const finance = dbFor("finance");
  const expenseRef = doc(finance, "expenses", "expense-finance");
  await assertSucceeds(setDoc(expenseRef, expense("finance")));
  await assertSucceeds(updateDoc(expenseRef, { status: "a_pagar", updatedAt: serverTimestamp() }));
  await assertSucceeds(deleteDoc(expenseRef));
  await assertFails(setDoc(doc(finance, "vehicles", "vehicle-finance"), vehicle("finance", "finance")));
  await assertFails(setDoc(doc(finance, "fuelings", "fuel-finance"), fueling("finance")));
});

test("financeiro grava apenas classificações válidas de pagamentos de funcionários", async () => {
  const finance = dbFor("finance");
  await assertSucceeds(setDoc(
    doc(finance, "expenses", "employee-payment-valid"),
    employeePaymentExpense("finance"),
  ));
  await assertSucceeds(setDoc(
    doc(finance, "expenses", "employee-payment-daily-trip"),
    employeePaymentExpense("finance", { employeePaymentType: "daily", tripId: "trip-seed" }),
  ));
  await assertFails(setDoc(
    doc(finance, "expenses", "employee-payment-invalid-type"),
    employeePaymentExpense("finance", { employeePaymentType: "bonus" }),
  ));
  await assertFails(setDoc(
    doc(finance, "expenses", "employee-payment-invalid-month"),
    employeePaymentExpense("finance", { competenceMonth: "08-2026" }),
  ));
  await assertFails(setDoc(
    doc(finance, "expenses", "employee-payment-invalid-calendar-month"),
    employeePaymentExpense("finance", { competenceMonth: "2026-13" }),
  ));
  await assertFails(setDoc(
    doc(finance, "expenses", "employee-payment-invalid-trip-type"),
    employeePaymentExpense("finance", { employeePaymentType: "salary", tripId: "trip-seed" }),
  ));
  await assertFails(setDoc(
    doc(finance, "expenses", "employee-payment-without-employee"),
    employeePaymentExpense("finance", { funcionarioId: "", employeeId: "" }),
  ));
  await assertFails(setDoc(
    doc(finance, "expenses", "employee-payment-unknown-employee"),
    employeePaymentExpense("finance", { funcionarioId: "employee-unknown", employeeId: "employee-unknown" }),
  ));
  await assertFails(setDoc(
    doc(finance, "expenses", "employee-payment-extra-field"),
    employeePaymentExpense("finance", { unexpected: "schema fechado" }),
  ));
});

test("admin cria vale e categorias incoerentes de pagamento sao bloqueadas", async () => {
  const admin = dbFor("admin");
  const finance = dbFor("finance");
  await assertSucceeds(setDoc(
    doc(admin, "expenses", "employee-payment-admin-advance"),
    employeePaymentExpense("admin"),
  ));
  await assertSucceeds(setDoc(
    doc(finance, "expenses", "employee-payment-salary"),
    employeePaymentExpense("finance", { employeePaymentType: "salary" }),
  ));
  await assertSucceeds(setDoc(
    doc(finance, "expenses", "employee-payment-daily-no-trip"),
    employeePaymentExpense("finance", { employeePaymentType: "daily" }),
  ));
  await assertSucceeds(setDoc(
    doc(finance, "expenses", "employee-payment-other"),
    employeePaymentExpense("finance", { employeePaymentType: "other" }),
  ));
  await assertFails(setDoc(
    doc(finance, "expenses", "employee-payment-invalid-salary-category"),
    employeePaymentExpense("finance", { employeePaymentType: "salary", categoria: "viagens_extras" }),
  ));
  await assertFails(setDoc(
    doc(finance, "expenses", "employee-payment-invalid-daily-category"),
    employeePaymentExpense("finance", { employeePaymentType: "daily", categoria: "salarios_adiantamentos" }),
  ));
});

test("pagamento de funcionario nao permite trocar a empresa", async () => {
  const finance = dbFor("finance");
  const reference = doc(finance, "expenses", "employee-payment-company-lock");
  await assertSucceeds(setDoc(reference, employeePaymentExpense("finance")));
  await assertFails(updateDoc(reference, {
    companyId: "outra-empresa",
    updatedAt: serverTimestamp(),
  }));
});

test("operador somente altera viagens e abastecimentos", async () => {
  const operator = dbFor("operator");
  const tripRef = doc(operator, "trips", "trip-operator");
  const fuelRef = doc(operator, "fuelings", "fuel-operator");
  await assertSucceeds(setDoc(tripRef, trip("operator")));
  await assertSucceeds(updateDoc(tripRef, { status: "Realizada", updatedAt: serverTimestamp() }));
  await assertSucceeds(deleteDoc(tripRef));
  await assertSucceeds(setDoc(fuelRef, fueling("operator")));
  await assertSucceeds(updateDoc(fuelRef, { kmAtual: 250, distanciaPercorrida: 150, updatedAt: serverTimestamp() }));
  await assertSucceeds(deleteDoc(fuelRef));
  await assertFails(setDoc(doc(operator, "expenses", "expense-operator"), expense("operator")));
  await assertFails(setDoc(doc(operator, "employees", "employee-operator"), employee("operator")));
});

test("membro ativo da empresa pode ler, mas não escrever", async () => {
  const member = dbFor("member");
  await assertSucceeds(getDocs(query(collection(member, "vehicles"), where("companyId", "==", COMPANY_ID))));
  await assertSucceeds(getDoc(doc(member, "employees", "employee-seed")));
  await assertFails(setDoc(doc(member, "expenses", "expense-member"), expense("member")));
});

test("acessos sem perfil, inativos, de outra empresa e anônimos são negados", async () => {
  const target = "vehicle-seed";
  const unauthenticated = environment.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(unauthenticated, "vehicles", target)));
  await assertFails(getDoc(doc(dbFor("inactive"), "vehicles", target)));
  await assertFails(getDoc(doc(dbFor("other-company"), "vehicles", target)));
  await assertFails(getDoc(doc(dbFor("without-profile"), "vehicles", target)));
});

test("admin não consegue burlar metadados, schema ou empresa", async () => {
  const admin = dbFor("admin");
  await assertFails(setDoc(doc(admin, "vehicles", "vehicle-wrong-owner"), {
    ...vehicle("other-user", "wrong-owner"),
  }));
  await assertFails(setDoc(doc(admin, "vehicles", "vehicle-extra-field"), {
    ...vehicle("admin", "extra-field"),
    unexpected: "não permitido",
  }));
  await assertFails(setDoc(doc(admin, "vehicles", "vehicle-other-company"), {
    ...vehicle("admin", "other-company"),
    companyId: "outra-empresa",
  }));
  await assertFails(setDoc(doc(admin, "fuelings", "fuel-invalid-date"), {
    ...fueling("admin"),
    fuelingDate: "02/08/2026",
  }));
});

test("suporta tankCapacityL, fuelLevelL e statusOperacional em veículos e atualização por operador", async () => {
  const admin = dbFor("admin");
  const operator = dbFor("operator");
  const vehicleRef = doc(admin, "vehicles", "vehicle-tank-test");

  // Admin cria veículo com tanque e status operacional
  await assertSucceeds(setDoc(vehicleRef, {
    ...vehicle("admin", "tank"),
    tankCapacityL: 300,
    fuelLevelL: 150,
    statusOperacional: "disponivel",
  }));

  // Operador atualiza nível de combustível e odômetro após abastecer
  await assertSucceeds(updateDoc(doc(operator, "vehicles", "vehicle-tank-test"), {
    fuelLevelL: 250,
    kmAtual: 200,
    updatedAt: serverTimestamp(),
  }));

  // Operador altera status para em_viagem
  await assertSucceeds(updateDoc(doc(operator, "vehicles", "vehicle-tank-test"), {
    statusOperacional: "em_viagem",
    updatedAt: serverTimestamp(),
  }));

  // Rejeita statusOperacional inválido
  await assertFails(updateDoc(doc(admin, "vehicles", "vehicle-tank-test"), {
    statusOperacional: "invalido",
    updatedAt: serverTimestamp(),
  }));

  // Rejeita fuelLevelL negativo
  await assertFails(updateDoc(doc(admin, "vehicles", "vehicle-tank-test"), {
    fuelLevelL: -10,
    updatedAt: serverTimestamp(),
  }));

  // Operador cria veículo completo com campos operacionais, mas não pode excluir
  const operatorVehicleRef = doc(operator, "vehicles", "vehicle-operator-create");
  await assertSucceeds(setDoc(operatorVehicleRef, {
    ...vehicle("operator", "op"),
    capacidade: 46,
    consumoKmPorLitro: 3.5,
    tankCapacityL: 400,
    fuelLevelL: 280,
    statusOperacional: "disponivel",
    proximaRevisaoKm: 250000,
    proximaRevisaoTexto: "Em 5.000 km",
    motoristaPadrao: "Carlos Mendes",
    ultimaRota: "Juazeiro → Salvador",
    revisaoPendente: false,
  }));
  await assertFails(deleteDoc(operatorVehicleRef));

  // Limpeza pelo admin
  await assertSucceeds(deleteDoc(doc(admin, "vehicles", "vehicle-operator-create")));
  await assertSucceeds(deleteDoc(vehicleRef));
});

test("suporta propostas/viagens completas e rascunhos com custos incompletos", async () => {
  const operator = dbFor("operator");
  const draftRef = doc(operator, "trips", "trip-draft-incomplete");
  await assertSucceeds(setDoc(draftRef, {
    ...trip("operator"),
    status: "Rascunho",
    oneWayKm: 0,
    totalKm: 0,
    baseValue: 0,
    finalValue: 0,
    clientPhone: "(74) 99999-0000",
    boardingPlace: "Terminal Rodoviário de Juazeiro",
    departureTime: "06:00",
    returnTime: "20:00",
    localDisplacementKm: 80,
    totalOperationalKm: 80,
    totalCapacity: 46,
    driver1Type: "dia",
    driver1Value: 250,
    driver1Days: 3,
    driver2Type: "viagem",
    driver2Value: 0,
    driver2Days: 0,
    tollsCost: 120,
    parkingCost: 60,
    driverMealsCost: 180,
    paymentTerms: "50% de sinal na assinatura e 50% até 48h antes do embarque.",
    included: "Transporte executivo, combustível, pedágios e motorista.",
    notIncluded: "Ingressos, refeições de passageiros e hospedagem.",
    rules: "Tolerância de atraso no embarque de 30 minutos.",
    cancellationPolicy: "Cancelamento até 7 dias antes com retenção de 20%.",
    amenities: ["Ar-condicionado", "Wi-Fi", "WC"],
    depositSignalValue: 1500,
    depositPaidValue: 1500,
    balanceDueDate: "2026-08-08",
  }));
  await assertSucceeds(deleteDoc(draftRef));

  const admin = dbFor("admin");
  const fullTripId = "trip-frontend-full-payload";
  const batch = writeBatch(admin);
  batch.set(doc(admin, "trips", fullTripId), {
    ...metadata("admin"),
    responsible: "Cid Garcia",
    client: "Faculdade São Francisco",
    clientPhone: "(74) 99988-1122",
    origin: "Juazeiro - BA",
    boardingPlace: "Praça da Catedral",
    destination: "Salvador - BA",
    stops: ["Feira de Santana - BA"],
    itinerary: ["Juazeiro - BA", "Feira de Santana - BA", "Salvador - BA"],
    vehicleIds: ["vehicle-seed"],
    vehicleId: "vehicle-seed",
    vehicleConfigs: [{ id: "vehicle-seed", nome: "Ônibus 1", capacidade: 46, consumoKmPorLitro: 3.2 }],
    departureDate: "2026-11-10",
    returnDate: "2026-11-13",
    departureTime: "06:00",
    returnTime: "20:00",
    durationDays: 4,
    vehiclesQty: 1,
    totalCapacity: 46,
    passengers: 44,
    consumptionKmPerLiter: 3.2,
    oneWayKm: 510,
    totalKm: 1020,
    emptyKm: 30,
    localDisplacementKm: 50,
    totalOperationalKm: 1100,
    pricePerKm: 8.5,
    baseValue: 9800,
    manualBaseValue: 9800,
    discount: 300,
    finalValue: 9500,
    status: "Enviado",
    emissionDate: "2026-10-26",
    emissaoDate: "2026-10-26",
    orcamentoNum: "GT-20261026-0001",
    validadeDias: 7,
    fuelPrice: 6.2,
    driver1Type: "dia",
    driver1Value: 250,
    driver1Days: 4,
    driver2Type: "viagem",
    driver2Value: 0,
    driver2Days: 0,
    tollsCost: 180,
    parkingCost: 80,
    lodgingCost: 450,
    driverMealsCost: 240,
    anttCost: 160,
    waterCost: 90,
    insuranceCost: 0,
    otherCosts: [{ nome: "Taxa de embarque turístico", valor: 120 }],
    costsConfirmedZero: true,
    depositSignalValue: 3000,
    depositPaidValue: 1500,
    balanceDueDate: "2026-11-05",
    paymentTerms: "30% de sinal e restante até 5 dias antes.",
    included: "Transporte fretado ida e volta.",
    notIncluded: "Hospedagem dos passageiros.",
    rules: "Tolerância de 15 minutos.",
    cancellationPolicy: "Devolução integral até 7 dias antes.",
  });
  batch.set(doc(admin, "auditLogs", "audit-trip-frontend-full"), {
    action: "create",
    collection: "trips",
    documentId: fullTripId,
    companyId: COMPANY_ID,
    createdBy: "admin",
    createdAt: serverTimestamp(),
  });
  await assertSucceeds(batch.commit());
  await assertSucceeds(deleteDoc(doc(admin, "trips", fullTripId)));
});


