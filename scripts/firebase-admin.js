import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

export const FIREBASE_COMPANY_ID = String(
  process.env.FIREBASE_COMPANY_ID || "garcia-turismo",
).trim();

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Variável obrigatória não configurada: ${name}`);
  return value;
}

function parseServiceAccount() {
  const raw = requireEnv("FIREBASE_SERVICE_ACCOUNT");
  let serviceAccount;

  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT deve conter um JSON válido da conta de serviço.");
  }

  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT não contém os campos obrigatórios da conta de serviço.");
  }

  const projectId = requireEnv("FIREBASE_PROJECT_ID");
  if (serviceAccount.project_id !== projectId) {
    throw new Error("FIREBASE_PROJECT_ID não corresponde ao project_id da conta de serviço.");
  }

  return { projectId, serviceAccount };
}

export function getFirebaseAdminDb() {
  const { projectId, serviceAccount } = parseServiceAccount();
  const app = getApps().length
    ? getApps()[0]
    : initializeApp({ credential: cert(serviceAccount), projectId });
  return getFirestore(app);
}

export function timestampToBackupValue(value) {
  if (value instanceof Timestamp) {
    return { __garciaType: "timestamp", value: value.toDate().toISOString() };
  }
  if (Array.isArray(value)) return value.map(timestampToBackupValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, timestampToBackupValue(item)]),
    );
  }
  return value;
}

export function timestampFromBackupValue(value) {
  if (Array.isArray(value)) return value.map(timestampFromBackupValue);
  if (value && typeof value === "object") {
    if (value.__garciaType === "timestamp" && typeof value.value === "string") {
      return Timestamp.fromDate(new Date(value.value));
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, timestampFromBackupValue(item)]),
    );
  }
  return value;
}
