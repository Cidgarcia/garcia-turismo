import { chromium } from "playwright";
import fetch from "node-fetch";

const SITE_BASE_URL = "http://127.0.0.1:5500";
const EMAIL = "augustjuniorleitte@gmail.com";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const STATE_ID = "garcia_turismo_main";

if (!RESEND_API_KEY) {
  throw new Error("Faltou configurar RESEND_API_KEY");
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Faltou configurar SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY",
  );
}

async function buscarDados() {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/app_states?id=eq.${STATE_ID}&select=data`,
    {
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const json = await response.json();
  return json?.[0]?.data;
}

async function gerarPdf(browser, url, nome) {
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: "networkidle" });

    // Espera a página estabilizar antes de gerar o PDF
    await page.waitForTimeout(1500);

    const pdf = await page.pdf({
      format: "A4",
      landscape: true,
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "8mm",
        right: "8mm",
        bottom: "8mm",
        left: "8mm",
      },
    });

    return {
      filename: nome,
      content: pdf.toString("base64"),
    };
  } finally {
    await page.close();
  }
}

async function enviarEmail(attachments) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "onboarding@resend.dev",
      to: EMAIL,
      subject: "Relatórios Garcia Turismo",
      html: `
        <p>Olá,</p>
        <p>Seguem em anexo os relatórios mensais da Garcia Turismo.</p>
        <p>Relatório geral + relatórios individuais por veículo.</p>
      `,
      attachments,
    }),
  });

  const result = await response.text();

  if (!response.ok) {
    throw new Error(result);
  }

  return result;
}

async function main() {
  const data = await buscarDados();

  if (!data) {
    throw new Error("Nenhum dado encontrado no Supabase.");
  }

  const vehicles = (data.vehicles || []).filter(
    (vehicle) => vehicle.status !== "inativo",
  );

  const browser = await chromium.launch();
  const arquivos = [];

  try {
    arquivos.push(
      await gerarPdf(
        browser,
        `${SITE_BASE_URL}/report.html?title=Relatório Geral`,
        "relatorio-geral.pdf",
      ),
    );

    for (const vehicle of vehicles) {
      const nomeVeiculo = `${vehicle.modelo || "veiculo"}-${vehicle.ano || ""}`
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      arquivos.push(
        await gerarPdf(
          browser,
          `${SITE_BASE_URL}/report.html?vehicleId=${vehicle.id}&title=Relatório ${encodeURIComponent(
            vehicle.modelo || "Veículo",
          )}`,
          `relatorio-${nomeVeiculo}.pdf`,
        ),
      );
    }
  } finally {
    await browser.close();
  }

  await enviarEmail(arquivos);

  console.log("Relatórios enviados!");
}

main().catch((error) => {
  console.error("Erro ao enviar relatórios:", error);
  process.exit(1);
});
