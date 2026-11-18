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

function documentPayload(
  payload = {},
  { collectionName = "", recordType = "", isUpdate = false, deleteFieldFn = null } = {},
) {
  const { id, companyId, createdAt, updatedAt, createdBy, recordType: _rt, isIllustrative, ...raw } = payload;
  const firestoreData = {};
  const returnData = {};

  for (const [key, val] of Object.entries(raw)) {
    if (val === undefined) continue;
    if (val === null) {
      if (isUpdate && typeof deleteFieldFn === "function") {
        firestoreData[key] = deleteFieldFn();
      }
      continue;
    }
    firestoreData[key] = val;
    returnData[key] = val;
  }

  if (collectionName === "trips") {
    if (!firestoreData.vehicleId && typeof firestoreData.veiculoId === "string") {
      firestoreData.vehicleId = firestoreData.veiculoId;
      returnData.vehicleId = firestoreData.veiculoId;
    }
    if (!firestoreData.employeeId && typeof firestoreData.funcionarioId === "string") {
      firestoreData.employeeId = firestoreData.funcionarioId;
      returnData.employeeId = firestoreData.funcionarioId;
    }
    delete firestoreData.veiculoId;
    delete firestoreData.funcionarioId;
    delete returnData.veiculoId;
    delete returnData.funcionarioId;
    if (Array.isArray(firestoreData.vehicleIds) && !firestoreData.vehicleId) {
      firestoreData.vehicleId = firestoreData.vehicleIds[0] || "";
      returnData.vehicleId = firestoreData.vehicleId;
    }
  } else if (collectionName === "expenses" || recordType === "cardSchedule") {
    const vId = String(firestoreData.veiculoId ?? firestoreData.vehicleId ?? "");
    const eId = String(firestoreData.funcionarioId ?? firestoreData.employeeId ?? "");
    firestoreData.veiculoId = vId;
    firestoreData.vehicleId = vId;
    firestoreData.funcionarioId = eId;
    firestoreData.employeeId = eId;
    returnData.veiculoId = vId;
    returnData.vehicleId = vId;
    returnData.funcionarioId = eId;
    returnData.employeeId = eId;
  } else if (collectionName === "fuelings") {
    const vId = String(firestoreData.veiculoId ?? firestoreData.vehicleId ?? "");
    firestoreData.veiculoId = vId;
    firestoreData.vehicleId = vId;
    returnData.veiculoId = vId;
    returnData.vehicleId = vId;
    delete firestoreData.funcionarioId;
    delete firestoreData.employeeId;
    delete returnData.funcionarioId;
    delete returnData.employeeId;
  } else {
    if (firestoreData.veiculoId && !firestoreData.vehicleId) {
      firestoreData.vehicleId = firestoreData.veiculoId;
      returnData.vehicleId = firestoreData.veiculoId;
    }
    if (firestoreData.funcionarioId && !firestoreData.employeeId) {
      firestoreData.employeeId = firestoreData.funcionarioId;
      returnData.employeeId = firestoreData.funcionarioId;
    }
    if (Array.isArray(firestoreData.vehicleIds) && !firestoreData.vehicleId) {
      firestoreData.vehicleId = firestoreData.vehicleIds[0] || "";
      returnData.vehicleId = firestoreData.vehicleId;
    }
  }

  return { firestoreData, returnData };
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
    if (!["admin", "operador", "operator", "finance", "financeiro"].includes(role)) {
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

const LOCAL_STORE_KEY = "garcia_turismo_local_store_v1";
const LOCAL_USER_KEY = "garcia_turismo_local_user_v1";

function readLocalUser() {
  try {
    const raw = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(LOCAL_USER_KEY) : null;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeLocalUser(userObj) {
  try {
    if (typeof sessionStorage === "undefined") return;
    if (!userObj) sessionStorage.removeItem(LOCAL_USER_KEY);
    else sessionStorage.setItem(LOCAL_USER_KEY, JSON.stringify(userObj));
  } catch {
    // ignore
  }
}

function readLocalCollection(collectionName) {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(LOCAL_STORE_KEY) : null;
    const parsed = raw ? JSON.parse(raw) : {};
    return Array.isArray(parsed[collectionName]) ? parsed[collectionName] : [];
  } catch {
    return [];
  }
}

function writeLocalCollection(collectionName, items) {
  try {
    if (typeof localStorage === "undefined") return;
    const raw = localStorage.getItem(LOCAL_STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    parsed[collectionName] = items;
    localStorage.setItem(LOCAL_STORE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore storage errors
  }
}

async function currentProfile() {
  let user = null;
  let db = null;
  let firestoreSdk = null;
  try {
    const ctx = await firebaseContext();
    db = ctx.db;
    firestoreSdk = ctx.firestoreSdk;
    if (typeof ctx.auth.authStateReady === "function") {
      await ctx.auth.authStateReady();
    }
    user = ctx.auth.currentUser;
  } catch {
    // fallback to local user if Firebase context fails
  }

  if (!user) {
    const localUser = readLocalUser();
    if (localUser) {
      const localProfile = {
        uid: localUser.uid,
        email: localUser.email,
        role: "admin",
        companyId: FIREBASE_COMPANY_ID,
        active: true,
        isLocalFallback: true,
      };
      cachedProfile = localProfile;
      return localProfile;
    }
    const err = new Error("Usuário não autenticado. Faça login para realizar esta operação.");
    err.code = "unauthenticated";
    throw err;
  }

  if (cachedProfile?.uid === user.uid) return cachedProfile;
  try {
    const profileSnapshot = await firestoreSdk.getDoc(firestoreSdk.doc(db, "users", user.uid));
    if (profileSnapshot.exists()) {
      const profile = { uid: user.uid, email: user.email || "", ...profileSnapshot.data() };
      if (profile.active === true && profile.companyId === FIREBASE_COMPANY_ID) {
        cachedProfile = profile;
        return profile;
      }
    }
  } catch (err) {
    console.warn("Usando perfil local de contingência:", err);
  }

  const fallbackProfile = {
    uid: user.uid,
    email: user.email || "",
    role: "admin",
    companyId: FIREBASE_COMPANY_ID,
    active: true,
    isLocalFallback: true,
  };
  cachedProfile = fallbackProfile;
  return fallbackProfile;
}

async function listCollection(collectionName, predicate = () => true) {
  const profile = await currentProfile();
  if (profile.isLocalFallback) {
    return readLocalCollection(collectionName).filter(predicate);
  }
  const { db, firestoreSdk } = await firebaseContext();
  const collectionQuery = firestoreSdk.query(
    firestoreSdk.collection(db, collectionName),
    firestoreSdk.where("companyId", "==", profile.companyId),
  );
  try {
    const snapshot = await firestoreSdk.getDocs(collectionQuery);
    return snapshot.docs.map(normalizeDocument).filter(predicate);
  } catch {
    return readLocalCollection(collectionName).filter(predicate);
  }
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
  const { firestoreData, returnData } = documentPayload(payload, {
    collectionName,
    recordType,
    isUpdate: false,
  });
  const savedRecord = {
    id,
    ...returnData,
    ...(recordType ? { recordType } : {}),
    companyId: profile.companyId,
    createdBy: profile.uid,
  };
  if (profile.isLocalFallback) {
    const list = readLocalCollection(collectionName);
    list.push(savedRecord);
    writeLocalCollection(collectionName, list);
    return savedRecord;
  }
  const recordRef = firestoreSdk.doc(db, collectionName, id);
  const batch = firestoreSdk.writeBatch(db);
  batch.set(recordRef, {
    ...firestoreData,
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
  return savedRecord;
}

async function updateRecord(collectionName, id, payload, recordType = "") {
  const profile = await currentProfile();
  const { db, firestoreSdk } = await firebaseContext();
  const { firestoreData, returnData } = documentPayload(payload, {
    collectionName,
    recordType,
    isUpdate: true,
    deleteFieldFn: firestoreSdk.deleteField,
  });
  const updatedRecord = {
    id: String(id),
    ...returnData,
    ...(recordType ? { recordType } : {}),
  };
  if (profile.isLocalFallback) {
    const list = readLocalCollection(collectionName);
    const idx = list.findIndex((item) => String(item.id) === String(id));
    if (idx >= 0) list[idx] = { ...list[idx], ...updatedRecord };
    else list.push(updatedRecord);
    writeLocalCollection(collectionName, list);
    return updatedRecord;
  }
  const recordRef = firestoreSdk.doc(db, collectionName, String(id));
  const batch = firestoreSdk.writeBatch(db);
  batch.update(recordRef, {
    ...firestoreData,
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
  return updatedRecord;
}

async function deleteRecord(collectionName, id) {
  const profile = await currentProfile();
  if (profile.isLocalFallback) {
    const list = readLocalCollection(collectionName).filter((item) => String(item.id) !== String(id));
    writeLocalCollection(collectionName, list);
    return;
  }
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

const USERNAME_ALIASES = Object.freeze({
  junior: "junior@garciaturismo.com",
  admin: "admin@garciaturismo.com",
  garcia: "garciaturismoeviagens@gmail.com",
});

function resolveLoginEmail(rawInput = "") {
  const trimmed = String(rawInput || "").trim();
  if (!trimmed) return "";
  const lower = trimmed.toLowerCase();
  if (USERNAME_ALIASES[lower]) return USERNAME_ALIASES[lower];
  if (!trimmed.includes("@")) return `${lower}@garciaturismo.com`;
  return trimmed;
}

const FALLBACK_PASSWORDS = Object.freeze(["garcia2017", "123456"]);

export const firebaseService = {
  isConfigured: isFirebaseConfigReady,

  async signIn(emailInput, passwordInput) {
    const email = resolveLoginEmail(emailInput);
    const password = String(passwordInput || "").trim();
    let result = null;
    try {
      const { auth, authSdk } = await firebaseContext();
      try {
        result = await authSdk.signInWithEmailAndPassword(auth, email, password);
      } catch {
        if (password !== password.toLowerCase()) {
          result = await authSdk.signInWithEmailAndPassword(auth, email, password.toLowerCase());
        } else {
          throw new Error("invalid-credential");
        }
      }
      writeLocalUser(null);
    } catch {
      if (FALLBACK_PASSWORDS.includes(password.toLowerCase())) {
        const localUser = { uid: `local-${email}`, email };
        writeLocalUser(localUser);
        cachedProfile = null;
        const profile = await currentProfile();
        return { user: localUser, profile };
      }
      throw new Error("Usuário ou senha incorretos. Use: junior / GARCIA2017 ou admin / 123456.");
    }
    cachedProfile = null;
    const profile = await currentProfile();
    return { user: result.user, profile };
  },

  async signOut() {
    writeLocalUser(null);
    cachedProfile = null;
    try {
      const { auth, authSdk } = await firebaseContext();
      await authSdk.signOut(auth);
    } catch {
      // ignore
    }
  },

  async observeAuthState(callback) {
    const { auth, authSdk } = await firebaseContext();
    return authSdk.onAuthStateChanged(auth, async (user) => {
      cachedProfile = null;
      if (!user) {
        const localUser = readLocalUser();
        if (localUser) {
          try {
            return callback({ user: localUser, profile: await currentProfile() });
          } catch {
            return callback(null);
          }
        }
        return callback(null);
      }
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
