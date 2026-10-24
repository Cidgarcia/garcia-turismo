import {
  FIREBASE_COMPANY_ID,
  FIREBASE_CONFIG,
  firebaseConfigurationError,
  isFirebaseConfigReady,
} from "../config/firebase-config.js";

const SDK_VERSION = "12.17.1";
let firebaseContextPromise;
let cachedProfile = null;

function normalizeDocument(snapshot) {
  const data = { id: snapshot.id, ...snapshot.data() };
  if (data.vehicleId && !data.veiculoId) data.veiculoId = data.vehicleId;
  if (data.employeeId && !data.funcionarioId) data.funcionarioId = data.employeeId;
  if (data.vehicleId && !Array.isArray(data.vehicleIds) && data.vehicleIds === undefined) {
    data.vehicleIds = [data.vehicleId];
  }
  return data;
}

function documentPayload(payload = {}) {
  const { id, companyId, createdAt, updatedAt, createdBy, recordType, isIllustrative, ...raw } = payload;
  const data = {};
  for (const [key, val] of Object.entries(raw)) {
    if (val !== undefined) data[key] = val;
  }
  if (data.veiculoId && !data.vehicleId) data.vehicleId = data.veiculoId;
  if (data.funcionarioId && !data.employeeId) data.employeeId = data.funcionarioId;
  if (Array.isArray(data.vehicleIds) && !data.vehicleId) data.vehicleId = data.vehicleIds[0] || "";
  return data;
}

export function formatFirestoreError(error, actionLabel = "salvar os dados") {
  const code = String(error?.code || "");
  const message = String(error?.message || "");

  if (code === "unauthenticated" || message.includes("unauthenticated")) {
    return "Você não está autenticado. Faça login novamente para continuar.";
  }

  if (code === "permission-denied" || message.includes("Missing or insufficient permissions")) {
    const role = cachedProfile?.role || "desconhecido";
    const company = cachedProfile?.companyId || "não vinculada";
    console.error("[Diagnóstico Firestore Permission Denied]", {
      actionLabel,
      uid: cachedProfile?.uid,
      email: cachedProfile?.email,
      role,
      companyId: company,
      expectedCompanyId: FIREBASE_COMPANY_ID,
      originalError: error,
    });
    if (company !== FIREBASE_COMPANY_ID) {
      return `Sem permissão para ${actionLabel}: seu usuário está vinculado à empresa "${company}" e não a "${FIREBASE_COMPANY_ID}".`;
    }
    if (role !== "admin" && role !== "operador" && role !== "operator") {
      return `Sem permissão para ${actionLabel}: seu perfil atual (${role}) não possui autorização para esta operação.`;
    }
    return `Permissão negada pelo Firestore ao ${actionLabel}. Verifique se todos os campos são válidos e se o seu perfil (${role}) possui autorização.`;
  }

  if (code === "unavailable" || message.includes("offline")) {
    return `Falha de conexão com o servidor ao ${actionLabel}. Verifique sua internet e tente novamente.`;
  }

  return message || `Não foi possível ${actionLabel}.`;
}

async function firebaseContext() {
  if (!isFirebaseConfigReady()) throw new Error(firebaseConfigurationError());

  if (!firebaseContextPromise) {
    firebaseContextPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`),
    ]).then(async ([appSdk, authSdk, firestoreSdk]) => {
      const app = appSdk.getApps().length
        ? appSdk.getApp()
        : appSdk.initializeApp(FIREBASE_CONFIG);
      const auth = authSdk.getAuth(app);
      await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);
      if (typeof auth.authStateReady === "function") {
        await auth.authStateReady();
      }
      return { auth, authSdk, db: firestoreSdk.getFirestore(app), firestoreSdk };
    });
  }

  return firebaseContextPromise;
}

async function currentProfile() {
  const { auth, db, firestoreSdk } = await firebaseContext();
  if (typeof auth.authStateReady === "function") {
    await auth.authStateReady();
  }
  const user = auth.currentUser;
  if (!user) {
    const err = new Error("Usuário não autenticado. Faça login para realizar esta operação.");
    err.code = "unauthenticated";
    throw err;
  }

  if (cachedProfile?.uid === user.uid) return cachedProfile;
  const profileSnapshot = await firestoreSdk.getDoc(firestoreSdk.doc(db, "users", user.uid));
  if (!profileSnapshot.exists()) {
    const err = new Error(`Perfil de autorização (users/${user.uid}) não encontrado no Firestore.`);
    err.code = "permission-denied";
    throw err;
  }

  const profile = { uid: user.uid, email: user.email || "", ...profileSnapshot.data() };
  if (profile.active !== true) {
    const err = new Error("Seu perfil de usuário está inativo no sistema.");
    err.code = "permission-denied";
    throw err;
  }
  if (profile.companyId !== FIREBASE_COMPANY_ID) {
    const err = new Error(`Usuário vinculado à empresa "${profile.companyId}" (esperado: "${FIREBASE_COMPANY_ID}").`);
    err.code = "permission-denied";
    throw err;
  }

  cachedProfile = profile;
  return profile;
}

async function listCollection(collectionName, predicate = () => true) {
  const profile = await currentProfile();
  const { db, firestoreSdk } = await firebaseContext();
  const collectionQuery = firestoreSdk.query(
    firestoreSdk.collection(db, collectionName),
    firestoreSdk.where("companyId", "==", profile.companyId),
  );
  const snapshot = await firestoreSdk.getDocs(collectionQuery);
  return snapshot.docs.map(normalizeDocument).filter(predicate);
}

async function writeAudit(batch, action, collectionName, id, profile, firestoreSdk, db) {
  const auditRef = firestoreSdk.doc(firestoreSdk.collection(db, "auditLogs"));
  batch.set(auditRef, {
    action,
    collection: collectionName,
    documentId: id,
    companyId: profile.companyId,
    createdBy: profile.uid,
    createdAt: firestoreSdk.serverTimestamp(),
  });
}

async function createRecord(collectionName, payload, recordType = "") {
  const profile = await currentProfile();
  const { db, firestoreSdk } = await firebaseContext();
  const id = String(payload?.id || firestoreSdk.doc(firestoreSdk.collection(db, collectionName)).id);
  const recordRef = firestoreSdk.doc(db, collectionName, id);
  const cleanData = documentPayload(payload);
  const batch = firestoreSdk.writeBatch(db);
  batch.set(recordRef, {
    ...cleanData,
    ...(recordType ? { recordType } : {}),
    companyId: profile.companyId,
    createdBy: profile.uid,
    createdAt: firestoreSdk.serverTimestamp(),
    updatedAt: firestoreSdk.serverTimestamp(),
  });
  await writeAudit(batch, "create", collectionName, id, profile, firestoreSdk, db);
  try {
    await batch.commit();
  } catch (error) {
    const friendly = new Error(formatFirestoreError(error, `criar registro em ${collectionName}`));
    friendly.code = error?.code;
    friendly.cause = error;
    throw friendly;
  }
  return {
    id,
    ...cleanData,
    ...(recordType ? { recordType } : {}),
    companyId: profile.companyId,
    createdBy: profile.uid,
  };
}

async function updateRecord(collectionName, id, payload, recordType = "") {
  const profile = await currentProfile();
  const { db, firestoreSdk } = await firebaseContext();
  const recordRef = firestoreSdk.doc(db, collectionName, String(id));
  const cleanData = documentPayload(payload);
  const batch = firestoreSdk.writeBatch(db);
  batch.update(recordRef, {
    ...cleanData,
    ...(recordType ? { recordType } : {}),
    updatedAt: firestoreSdk.serverTimestamp(),
  });
  await writeAudit(batch, "update", collectionName, String(id), profile, firestoreSdk, db);
  try {
    await batch.commit();
  } catch (error) {
    const friendly = new Error(formatFirestoreError(error, `atualizar registro em ${collectionName}`));
    friendly.code = error?.code;
    friendly.cause = error;
    throw friendly;
  }
  return {
    id: String(id),
    ...cleanData,
    ...(recordType ? { recordType } : {}),
  };
}

async function deleteRecord(collectionName, id) {
  const profile = await currentProfile();
  const { db, firestoreSdk } = await firebaseContext();
  const batch = firestoreSdk.writeBatch(db);
  batch.delete(firestoreSdk.doc(db, collectionName, String(id)));
  await writeAudit(batch, "delete", collectionName, String(id), profile, firestoreSdk, db);
  try {
    await batch.commit();
  } catch (error) {
    const friendly = new Error(formatFirestoreError(error, `excluir registro em ${collectionName}`));
    friendly.code = error?.code;
    friendly.cause = error;
    throw friendly;
  }
}

function recordApi(collectionName, recordType = "") {
  const predicate = recordType ? (item) => item.recordType === recordType : () => true;
  return {
    list: () => listCollection(collectionName, predicate),
    create: (payload) => createRecord(collectionName, payload, recordType),
    update: (id, payload) => updateRecord(collectionName, id, payload, recordType),
    delete: (id) => deleteRecord(collectionName, id),
  };
}

const vehicles = recordApi("vehicles");
const expenses = recordApi("expenses");
const trips = recordApi("trips");
const fuelings = recordApi("fuelings");
const employees = recordApi("employees");
const cards = recordApi("cards", "card");
const buyers = recordApi("cards", "buyer");
const cardSchedules = recordApi("cards", "cardSchedule");
const orcamentos = recordApi("orcamentos");

export const firebaseService = {
  isConfigured: isFirebaseConfigReady,

  async signIn(email, password) {
    const { auth, authSdk } = await firebaseContext();
    const result = await authSdk.signInWithEmailAndPassword(auth, email, password);
    cachedProfile = null;
    try {
      const profile = await currentProfile();
      return { user: result.user, profile };
    } catch (error) {
      await authSdk.signOut(auth);
      throw error;
    }
  },

  async signOut() {
    const { auth, authSdk } = await firebaseContext();
    cachedProfile = null;
    await authSdk.signOut(auth);
  },

  async observeAuthState(callback) {
    const { auth, authSdk } = await firebaseContext();
    return authSdk.onAuthStateChanged(auth, async (user) => {
      cachedProfile = null;
      if (!user) return callback(null);
      try {
        callback({ user, profile: await currentProfile() });
      } catch (error) {
        callback({ user, error });
      }
    });
  },

  async getCurrentUserProfile() {
    return currentProfile();
  },

  listVehicles: vehicles.list,
  createVehicle: vehicles.create,
  updateVehicle: vehicles.update,
  deleteVehicle: vehicles.delete,
  listExpenses: expenses.list,
  createExpense: expenses.create,
  updateExpense: expenses.update,
  deleteExpense: expenses.delete,
  listTrips: trips.list,
  createTrip: trips.create,
  updateTrip: trips.update,
  deleteTrip: trips.delete,
  listFuelings: fuelings.list,
  createFueling: fuelings.create,
  updateFueling: fuelings.update,
  deleteFueling: fuelings.delete,
  listEmployees: employees.list,
  createEmployee: employees.create,
  updateEmployee: employees.update,
  deleteEmployee: employees.delete,
  listCards: cards.list,
  createCard: cards.create,
  updateCard: cards.update,
  deleteCard: cards.delete,
  listBuyers: buyers.list,
  createBuyer: buyers.create,
  updateBuyer: buyers.update,
  deleteBuyer: buyers.delete,
  listCardSchedules: cardSchedules.list,
  createCardSchedule: cardSchedules.create,
  updateCardSchedule: cardSchedules.update,
  deleteCardSchedule: cardSchedules.delete,
  listOrcamentos: orcamentos.list,
  createOrcamento: orcamentos.create,
  updateOrcamento: orcamentos.update,
  deleteOrcamento: orcamentos.delete,

  async loadOperationalData() {
    const [vehiclesData, expensesData, tripsData, fuelingsData, employeesData, cardsData, buyersData, schedulesData, orcamentosData] = await Promise.all([
      this.listVehicles(),
      this.listExpenses(),
      this.listTrips(),
      this.listFuelings(),
      this.listEmployees(),
      this.listCards(),
      this.listBuyers(),
      this.listCardSchedules(),
      this.listOrcamentos().catch(() => []),
    ]);
    return {
      vehicles: vehiclesData,
      expenses: expensesData,
      trips: tripsData,
      fuelings: fuelingsData,
      employees: employeesData,
      cards: cardsData,
      buyers: buyersData,
      cardSchedules: schedulesData,
      orcamentos: orcamentosData,
    };
  },
};
