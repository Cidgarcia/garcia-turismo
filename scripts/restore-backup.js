import { createDecipheriv } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import {
  FIREBASE_COMPANY_ID,
  getFirebaseAdminDb,
  timestampFromBackupValue,
} from "./firebase-admin.js";

const BACKUP_COLLECTIONS = [
  "users",
  "vehicles",
  "expenses",
  "trips",
  "fuelings",
  "employees",
  "cards",
];

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Variável obrigatória não configurada: ${name}`);
  return value;
}

function decrypt(envelope, key) {
  if (envelope?.format !== "garcia-turismo-backup" || envelope?.version !== 2) {
    throw new Error("Formato de backup não reconhecido.");
  }
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const compressed = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(gunzipSync(compressed).toString("utf8"));
}

function validatePayload(payload) {
  if (payload?.schemaVersion !== 2 || payload.companyId !== FIREBASE_COMPANY_ID) {
    throw new Error("Backup não pertence à empresa Firebase configurada.");
  }
  if (!payload.collections || typeof payload.collections !== "object") {
    throw new Error("Backup não contém coleções válidas.");
  }

  for (const collectionName of BACKUP_COLLECTIONS) {
    const records = payload.collections[collectionName] || [];
    if (!Array.isArray(records)) throw new Error(`Coleção inválida no backup: ${collectionName}`);
    for (const record of records) {
      if (!record?.id || record?.data?.companyId !== FIREBASE_COMPANY_ID) {
        throw new Error(`Documento inválido no backup: ${collectionName}/${record?.id || "sem-id"}`);
      }
    }
  }
}

async function applyBackup(payload) {
  const db = getFirebaseAdminDb();
  const operations = BACKUP_COLLECTIONS.flatMap((collectionName) =>
    (payload.collections[collectionName] || []).map((record) => ({ collectionName, record })),
  );

  for (let offset = 0; offset < operations.length; offset += 400) {
    const batch = db.batch();
    for (const { collectionName, record } of operations.slice(offset, offset + 400)) {
      batch.set(
        db.collection(collectionName).doc(record.id),
        timestampFromBackupValue(record.data),
      );
    }
    await batch.commit();
  }
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Uso: npm run backup:restore -- caminho-do-backup.json.enc [--apply]");

  const key = Buffer.from(required("BACKUP_ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) throw new Error("BACKUP_ENCRYPTION_KEY deve conter 32 bytes em Base64.");

  const envelope = JSON.parse(await readFile(file, "utf8"));
  const payload = decrypt(envelope, key);
  validatePayload(payload);
  const recordCount = Object.values(payload.collections)
    .reduce((total, records) => total + records.length, 0);
  console.log(`Backup válido. Exportado em: ${payload.exportedAt}; documentos: ${recordCount}.`);
  console.log("Contas do Firebase Authentication não fazem parte deste backup.");

  if (process.argv.includes("--apply")) {
    await applyBackup(payload);
    console.log("Backup restaurado no Cloud Firestore.");
  } else {
    console.log("Validação concluída sem alterar o banco. Adicione --apply para restaurar.");
  }
}

main().catch((error) => {
  console.error("Erro ao restaurar backup:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
