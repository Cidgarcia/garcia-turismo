import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import fetch from "node-fetch";

const SITE_BASE_URL = process.env.SITE_BASE_URL || "http://127.0.0.1:5500";
const RESEND_API_URL = "https://api.resend.com/emails";
const STATE_ID = process.env.SUPABASE_STATE_ID || "garcia_turismo_main";
const TIME_ZONE = process.env.REPORT_TIME_ZONE || "America/Bahia";
const MAX_MESSAGE_BYTES = 35 * 1024 * 1024;
const MAX_RETRIES = 3;

let config;

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Variável obrigatória não configurada: ${name}`);
  return value;
}

function parseRecipients(value) {
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getConfig() {
  if (!config) {
    config = {
      resendApiKey: requireEnv("RESEND_API_KEY"),
      supabaseUrl: requireEnv("SUPABASE_URL").replace(/\/$/, ""),
      supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      from: requireEnv("REPORT_FROM"),
      to: parseRecipients(requireEnv("REPORT_TO")),
      replyTo: parseRecipients(process.env.REPORT_REPLY_TO || ""),
      subjectPrefix: process.env.REPORT_SUBJECT_PREFIX || "Relatórios Garcia Turismo",
    };
  }
  return config;
}

function validateConfiguration() {
  const currentConfig = getConfig();
  if (!currentConfig.to.length) throw new Error("REPORT_TO não contém destinatários válidos.");

  if (
    currentConfig.from.toLowerCase().includes("@resend.dev") &&
    process.env.ALLOW_RESEND_TEST_SENDER !== "true"
  ) {
    throw new Error(
      "REPORT_FROM usa o domínio de testes resend.dev. Verifique um domínio no Resend e configure um remetente desse domínio. Para um teste controlado, use ALLOW_RESEND_TEST_SENDER=true.",
    );
  }
}

function getYearMonthInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);

  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
  };
}

function resolveReportPeriod() {
  const requested = String(process.env.REPORT_MONTH || "").trim();
  let year;
  let month;

  if (requested) {
    const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(requested);
    if (!match) throw new Error("REPORT_MONTH deve seguir o formato YYYY-MM.");
    year = Number(match[1]);
    month = Number(match[2]);
  } else {
    const current = getYearMonthInTimeZone(new Date(), TIME_ZONE);
    year = current.year;
    month = current.month - 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthString = String(month).padStart(2, "0");
  const start = `${year}-${monthString}-01`;
  const end = `${year}-${monthString}-${String(lastDay).padStart(2, "0")}`;
  const label = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${start}T12:00:00Z`));

  return { key: `${year}-${monthString}`, start, end, label };
}

async function fetchAppState() {
  const currentConfig = getConfig();
  const url = new URL(`${currentConfig.supabaseUrl}/rest/v1/app_states`);
  url.searchParams.set("id", `eq.${STATE_ID}`);
  url.searchParams.set("select", "data");

  const response = await fetch(url, {
    headers: {
      apikey: currentConfig.supabaseServiceRoleKey,
      Authorization: `Bearer ${currentConfig.supabaseServiceRoleKey}`,
      Accept: "application/json",
      "User-Agent": "garcia-turismo-reports/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase respondeu ${response.status}: ${await response.text()}`);
  }

  const rows = await response.json();
  const data = rows?.[0]?.data;
  if (!data || typeof data !== "object") {
    throw new Error(`Nenhum estado válido encontrado no Supabase para o id ${STATE_ID}.`);
  }

  return data;
}

function slugify(value) {
  return String(value || "veiculo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "veiculo";
}

function vehicleLabel(vehicle = {}) {
  return [vehicle.modelo, vehicle.ano, vehicle.cor].filter(Boolean).join(" ").trim() || "Veículo";
}

function fileToken(value) {
  return createHash("sha256").update(String(value)).digest("hex").slice(0, 10);
}

export function buildVehicleReports(data, period) {
  const seenVehicleIds = new Set();
  const seenFilenames = new Set([`relatorio-geral-${period.key}.pdf`]);
  const vehicles = (data.vehicles || []).filter((vehicle) => vehicle.status !== "inativo");

  return vehicles.map((vehicle) => {
    const id = String(vehicle?.id || "").trim();
    const name = vehicleLabel(vehicle);

    if (!id) {
      throw new Error(`Veículo ativo sem id: ${name}. Corrija o cadastro antes de enviar relatórios.`);
    }
    if (seenVehicleIds.has(id)) {
      throw new Error(`Veículo ativo duplicado no estado: id=${id}. O envio foi interrompido.`);
    }
    seenVehicleIds.add(id);

    const filename = `relatorio-${slugify(name)}-${fileToken(id)}-${period.key}.pdf`;
    if (seenFilenames.has(filename)) {
      throw new Error(`Nome de arquivo duplicado para o veículo ${id}: ${filename}. O envio foi interrompido.`);
    }
    seenFilenames.add(filename);

    return { id, name, filename };
  });
}

export function validateAttachments(attachments) {
  const filenames = new Set();
  const vehicleIds = new Set();

  for (const attachment of attachments) {
    if (!attachment.filename || filenames.has(attachment.filename)) {
      throw new Error(`Arquivo de relatório duplicado: ${attachment.filename || "sem nome"}. O envio foi interrompido.`);
    }
    filenames.add(attachment.filename);

    if (attachment.vehicleId) {
      if (vehicleIds.has(attachment.vehicleId)) {
        throw new Error(`Veículo duplicado nos anexos: id=${attachment.vehicleId}. O envio foi interrompido.`);
      }
      vehicleIds.add(attachment.vehicleId);
    }
  }
}

async function generatePdf(browser, { data, period, vehicle = null, filename }) {
  const page = await browser.newPage();

  try {
    await page.addInitScript(
      ({ appData, reportPeriod, reportVehicle }) => {
        window.__GARCIA_REPORT_PAYLOAD__ = {
          data: appData,
          period: reportPeriod,
          vehicle: reportVehicle,
        };
      },
      {
        appData: data,
        reportPeriod: period,
        reportVehicle: vehicle ? { id: vehicle.id, name: vehicle.name } : null,
      },
    );

    const url = new URL("/report.html", SITE_BASE_URL);
    if (vehicle?.id) url.searchParams.set("vehicleId", vehicle.id);

    await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForFunction(
      () => {
        const status = window.__GARCIA_REPORT_STATUS__;
        return Boolean(status?.ready || status?.error);
      },
      undefined,
      { timeout: 30_000 },
    );

    const status = await page.evaluate(() => window.__GARCIA_REPORT_STATUS__);
    if (status?.error) throw new Error(`Falha ao renderizar ${filename}: ${status.error}`);

    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "8mm", right: "8mm", bottom: "8mm", left: "8mm" },
    });

    return {
      filename,
      content: pdf.toString("base64"),
      vehicleId: vehicle?.id || "",
      vehicleName: vehicle?.name || "Relatório geral",
    };
  } finally {
    await page.close();
  }
}

function splitAttachments(attachments) {
  const batches = [];
  let current = [];
  let currentBytes = 0;

  for (const attachment of attachments) {
    const estimatedBytes = Buffer.byteLength(attachment.content, "utf8") +
      Buffer.byteLength(attachment.filename, "utf8") + 2_048;

    if (estimatedBytes > MAX_MESSAGE_BYTES) {
      throw new Error(`O arquivo ${attachment.filename} excede o limite seguro de envio.`);
    }

    if (current.length && currentBytes + estimatedBytes > MAX_MESSAGE_BYTES) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }

    current.push(attachment);
    currentBytes += estimatedBytes;
  }

  if (current.length) batches.push(current);
  return batches;
}

function idempotencyKey(periodKey, batchIndex, attachments) {
  const digest = createHash("sha256")
    .update(attachments.map((item) => `${item.filename}:${item.content.length}`).join("|"))
    .digest("hex")
    .slice(0, 16);
  return `garcia-turismo-${periodKey}-${batchIndex + 1}-${digest}`;
}

async function sendEmail({ attachments, period, batchIndex, batchCount }) {
  const currentConfig = getConfig();
  const complement = batchCount > 1 ? ` (${batchIndex + 1}/${batchCount})` : "";
  const body = {
    from: currentConfig.from,
    to: currentConfig.to,
    subject: `${currentConfig.subjectPrefix} — ${period.label}${complement}`,
    html: [
      "<p>Olá,</p>",
      `<p>Seguem os relatórios financeiros referentes a <strong>${period.label}</strong>.</p>`,
      "<p>O envio contém o relatório geral e os relatórios individuais dos veículos ativos.</p>",
    ].join(""),
    attachments,
  };

  if (currentConfig.replyTo.length) body.reply_to = currentConfig.replyTo;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${currentConfig.resendApiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "garcia-turismo-reports/1.0",
        "Idempotency-Key": idempotencyKey(period.key, batchIndex, attachments),
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let result;
    try {
      result = text ? JSON.parse(text) : {};
    } catch {
      result = { message: text };
    }

    if (response.ok) return result;

    const retriable = response.status === 429 || response.status >= 500;
    if (!retriable || attempt === MAX_RETRIES) {
      const requestId = response.headers.get("x-request-id");
      throw new Error(
        `Resend respondeu ${response.status}${requestId ? ` (request ${requestId})` : ""}: ${JSON.stringify(result)}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
  }

  throw new Error("Falha inesperada ao enviar e-mail.");
}

async function main() {
  validateConfiguration();
  const period = resolveReportPeriod();
  console.log(`Gerando relatórios de ${period.start} a ${period.end} (${TIME_ZONE}).`);

  const data = await fetchAppState();
  const vehicleReports = buildVehicleReports(data, period);
  const browser = await chromium.launch({ headless: true });
  const attachments = [];

  try {
    const generalAttachment = await generatePdf(browser, {
        data,
        period,
        filename: `relatorio-geral-${period.key}.pdf`,
      });
    attachments.push(generalAttachment);
    console.log(`[REPORT] veículo=geral/Relatório geral arquivo=${generalAttachment.filename}`);

    for (const vehicle of vehicleReports) {
      const attachment = await generatePdf(browser, {
          data,
          period,
          vehicle,
          filename: vehicle.filename,
        });
      attachments.push(attachment);
      console.log(`[REPORT] veículo=${attachment.vehicleId}/${attachment.vehicleName} arquivo=${attachment.filename}`);
    }
  } finally {
    await browser.close();
  }

  validateAttachments(attachments);
  const batches = splitAttachments(attachments);
  for (let index = 0; index < batches.length; index += 1) {
    const result = await sendEmail({
      attachments: batches[index],
      period,
      batchIndex: index,
      batchCount: batches.length,
    });
    console.log(`Lote ${index + 1}/${batches.length} enviado. ID: ${result.id || "não informado"}`);
  }

  console.log(`Relatórios de ${period.label} enviados com sucesso.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error("Erro ao enviar relatórios:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
