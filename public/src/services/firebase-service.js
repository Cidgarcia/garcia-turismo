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
  const { id, companyId, createdAt, updatedAt, createdBy, recordType, ...data } = payload;
  if (data.veiculoId && !data.vehicleId) data.vehicleId = data.veiculoId;
  if (data.funcionarioId && !data.employeeId) data.employeeId = data.funcionarioId;
  if (Array.isArray(data.vehicleIds) && !data.vehicleId) data.vehicleId = data.vehicleIds[0] || "";
  return data;
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
  const user = auth.currentUser;
  if (!user) throw new Error("Sua sessão expirou. Entre novamente.");

  if (cachedProfile?.uid === user.uid) return cachedProfile;
  const profileSnapshot = await firestoreSdk.getDoc(firestoreSdk.doc(db, "users", user.uid));
  if (!profileSnapshot.exists()) throw new Error("Perfil de usuário não encontrado.");

  const profile = { uid: user.uid, email: user.email || "", ...profileSnapshot.data() };
  if (profile.active !== true || profile.companyId !== FIREBASE_COMPANY_ID) {
    throw new Error("Este usuário não possui acesso ativo à Garcia Turismo.");
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
  const batch = firestoreSdk.writeBatch(db);
  batch.set(recordRef, {
    ...documentPayload(payload),
    ...(recordType ? { recordType } : {}),
    companyId: profile.companyId,
    createdBy: profile.uid,
    createdAt: firestoreSdk.serverTimestamp(),
    updatedAt: firestoreSdk.serverTimestamp(),
  });
  await writeAudit(batch, "create", collectionName, id, profile, firestoreSdk, db);
  await batch.commit();
  return { id, ...documentPayload(payload), ...(recordType ? { recordType } : {}) };
}

async function updateRecord(collectionName, id, payload, recordType = "") {
  const profile = await currentProfile();
  const { db, firestoreSdk } = await firebaseContext();
  const recordRef = firestoreSdk.doc(db, collectionName, String(id));
  const batch = firestoreSdk.writeBatch(db);
  batch.update(recordRef, {
    ...documentPayload(payload),
    ...(recordType ? { recordType } : {}),
    updatedAt: firestoreSdk.serverTimestamp(),
  });
  await writeAudit(batch, "update", collectionName, String(id), profile, firestoreSdk, db);
  await batch.commit();
  return { id: String(id), ...documentPayload(payload), ...(recordType ? { recordType } : {}) };
}

async function deleteRecord(collectionName, id) {
  const profile = await currentProfile();
  const { db, firestoreSdk } = await firebaseContext();
  const batch = firestoreSdk.writeBatch(db);
  batch.delete(firestoreSdk.doc(db, collectionName, String(id)));
  await writeAudit(batch, "delete", collectionName, String(id), profile, firestoreSdk, db);
  await batch.commit();
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

  async loadOperationalData() {
    const [vehiclesData, expensesData, tripsData, fuelingsData, employeesData, cardsData, buyersData, schedulesData] = await Promise.all([
      this.listVehicles(),
      this.listExpenses(),
      this.listTrips(),
      this.listFuelings(),
      this.listEmployees(),
      this.listCards(),
      this.listBuyers(),
      this.listCardSchedules(),
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
    };
  },
};
