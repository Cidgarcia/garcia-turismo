import { createDecipheriv } from "node:crypto";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import fetch from "node-fetch";

function required(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Variável obrigatória não configurada: ${name}`);
  return value;
}

function decrypt(envelope, key) {
  if (envelope?.format !== "garcia-turismo-backup" || envelope?.version !== 1) {
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

async function applyBackup(payload) {
  const supabaseUrl = required("SUPABASE_URL").replace(/\/$/, "");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const row = payload?.row;
  if (!row?.id || !row?.data) throw new Error("Backup não contém um estado válido.");

  const response = await fetch(`${supabaseUrl}/rest/v1/app_states?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
      "User-Agent": "garcia-turismo-backup/1.0",
    },
    body: JSON.stringify({
      id: row.id,
      data: row.data,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error(`Supabase respondeu ${response.status}: ${await response.text()}`);
}

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Uso: npm run backup:restore -- caminho-do-backup.json.enc [--apply]");

  const key = Buffer.from(required("BACKUP_ENCRYPTION_KEY"), "base64");
  if (key.length !== 32) throw new Error("BACKUP_ENCRYPTION_KEY deve conter 32 bytes em Base64.");

  const envelope = JSON.parse(await readFile(file, "utf8"));
  const payload = decrypt(envelope, key);
  console.log(`Backup válido. Exportado em: ${payload.exportedAt}`);
  console.log(`Estado: ${payload.row.id}; atualização original: ${payload.row.updated_at || "não informada"}`);

  if (process.argv.includes("--apply")) {
    await applyBackup(payload);
    console.log("Backup restaurado no Supabase.");
  } else {
    console.log("Validação concluída sem alterar o banco. Adicione --apply para restaurar.");
  }
}

main().catch((error) => {
  console.error("Erro ao restaurar backup:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
