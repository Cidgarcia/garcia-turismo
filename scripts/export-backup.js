import { createCipheriv, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import fetch from "node-fetch";

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

async function fetchState() {
  const supabaseUrl = required("SUPABASE_URL").replace(/\/$/, "");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const stateId = process.env.SUPABASE_STATE_ID || "garcia_turismo_main";
  const url = new URL(`${supabaseUrl}/rest/v1/app_states`);
  url.searchParams.set("id", `eq.${stateId}`);
  url.searchParams.set("select", "id,data,updated_at");

  const response = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Accept: "application/json",
      "User-Agent": "garcia-turismo-backup/1.0",
    },
  });
  if (!response.ok) throw new Error(`Supabase respondeu ${response.status}: ${await response.text()}`);

  const row = (await response.json())?.[0];
  if (!row) throw new Error(`Estado ${stateId} não encontrado.`);
  return row;
}

function encrypt(payload, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const compressed = gzipSync(Buffer.from(JSON.stringify(payload), "utf8"));
  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    format: "garcia-turismo-backup",
    version: 1,
    algorithm: "aes-256-gcm+gzip",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  });
}

async function main() {
  const row = await fetchState();
  const exportedAt = new Date().toISOString();
  const safeTimestamp = exportedAt.replace(/[:.]/g, "-");
  const outputDir = process.env.BACKUP_OUTPUT_DIR || "backups";
  const output = `${outputDir}/garcia-turismo-${safeTimestamp}.json.enc`;

  await mkdir(outputDir, { recursive: true });
  await writeFile(output, encrypt({ schemaVersion: 1, exportedAt, row }, encryptionKey()), {
    mode: 0o600,
  });

  console.log(`Backup criptografado criado: ${output}`);
  if (process.env.GITHUB_OUTPUT) {
    await writeFile(process.env.GITHUB_OUTPUT, `backup_file=${output}\n`, { flag: "a" });
  }
}

main().catch((error) => {
  console.error("Erro ao criar backup:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
