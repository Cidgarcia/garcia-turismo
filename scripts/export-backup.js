import { createCipheriv, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import {
  FIREBASE_COMPANY_ID,
  getFirebaseAdminDb,
  timestampToBackupValue,
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

function encryptionKey() {
  const key = Buffer.from(required("BACKUP_ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) {
    throw new Error("BACKUP_ENCRYPTION_KEY deve ser uma chave aleatória de 32 bytes codificada em Base64.");
  }
  return key;
}

async function fetchCollections() {
  const db = getFirebaseAdminDb();
  const entries = await Promise.all(BACKUP_COLLECTIONS.map(async (collectionName) => {
    const snapshot = await db.collection(collectionName)
      .where("companyId", "==", FIREBASE_COMPANY_ID)
      .get();
    return [collectionName, snapshot.docs.map((document) => ({
      id: document.id,
      data: timestampToBackupValue(document.data()),
    }))];
  }));
  return Object.fromEntries(entries);
}

function encrypt(payload, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const compressed = gzipSync(Buffer.from(JSON.stringify(payload), "utf8"));
  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    format: "garcia-turismo-backup",
    version: 2,
    algorithm: "aes-256-gcm+gzip",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  });
}

async function main() {
  const collections = await fetchCollections();
  const exportedAt = new Date().toISOString();
  const safeTimestamp = exportedAt.replace(/[:.]/g, "-");
  const outputDir = process.env.BACKUP_OUTPUT_DIR || "backups";
  const output = `${outputDir}/garcia-turismo-${safeTimestamp}.json.enc`;
  const recordCount = Object.values(collections)
    .reduce((total, records) => total + records.length, 0);

  await mkdir(outputDir, { recursive: true });
  await writeFile(output, encrypt({
    schemaVersion: 2,
    exportedAt,
    companyId: FIREBASE_COMPANY_ID,
    collections,
  }, encryptionKey()), { mode: 0o600 });

  console.log(`Backup criptografado criado: ${output} (${recordCount} documentos).`);
  if (process.env.GITHUB_OUTPUT) {
    await writeFile(process.env.GITHUB_OUTPUT, `backup_file=${output}\n`, { flag: "a" });
  }
}

main().catch((error) => {
  console.error("Erro ao criar backup:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
