import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = resolve(__dirname, "../public");

const MIME_TYPES = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

/**
 * Cria um servidor HTTP estático temporário para o Playwright renderizar os templates
 */
export async function createStaticServer() {
  const server = createServer(async (req, res) => {
    try {
      const urlPath = req.url?.split("?")[0] || "/";
      const filePath = join(PUBLIC_DIR, urlPath === "/" ? "index.html" : urlPath);
      const ext = extname(filePath);
      const mime = MIME_TYPES[ext] || "text/plain";

      const content = await readFile(filePath);
      res.writeHead(200, {
        "Content-Type": mime,
        "Access-Control-Allow-Origin": "*",
      });
      res.end(content);
    } catch {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
  });

  return new Promise((resolveServer) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : 5500;
      resolveServer({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => new Promise((cb) => server.close(cb)),
      });
    });
  });
}

/**
 * Gera PDF do Orçamento (Cliente ou Interno)
 * @param {'cliente'|'interno'} type
 * @param {object} orcamentoData
 * @param {string} [outputPath]
 * @returns {Promise<Buffer>}
 */
export async function generateOrcamentoPdf(type, orcamentoData, outputPath = null) {
  const server = await createStaticServer();
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    const isCliente = type === "cliente";
    const templatePath = isCliente ? "/orcamento-cliente.html" : "/orcamento-interno.html";

    // Injeta os dados seguros na janela antes da execução dos scripts
    await page.addInitScript((payload) => {
      window.__GARCIA_ORCAMENTO__ = payload;
    }, orcamentoData);

    await page.goto(`${server.baseUrl}${templatePath}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForFunction(
      () => Boolean(window.__GARCIA_PDF_READY__ === true),
      undefined,
      { timeout: 15000 },
    );

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "12mm",
        bottom: "12mm",
        left: "14mm",
        right: "14mm",
      },
    });

    if (outputPath) {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(outputPath, pdfBuffer);
    }

    return pdfBuffer;
  } finally {
    await browser.close();
    await server.close();
  }
}

// Se executado diretamente como script de linha de comando
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const typeArg = process.argv.find((arg) => arg.startsWith("--type="))?.split("=")[1] || "cliente";
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="))?.split("=")[1] || `orcamento-${typeArg}.pdf`;

  console.log(`Gerando PDF de teste (${typeArg})...`);
  const mockOrcamento = {
    id: "orc-sample-01",
    numeroSequencial: "ORC-001",
    versao: 1,
    cliente: "Associação de Estudantes Univasf",
    clienteTelefone: "(87) 98888-7777",
    clienteEmail: "contato@estudantes.org.br",
    numeroPassageiros: 44,
    origem: "Petrolina-PE",
    destino: "Salvador-BA",
    paradas: "Feira de Santana-BA (Almoço)",
    dataHoraIda: "2026-11-15T06:00",
    dataHoraVolta: "2026-11-18T20:00",
    veiculoId: "veh-01",
    veiculo: {
      nome: "Ônibus Executivo G7",
      modelo: "Marcopolo Paradiso 1200",
      ano: 2022,
      capacidade: 46,
      tipo: "onibus",
      layout: "onibus_46",
      consumoKmPorLitro: 3.2,
      custoManutencaoKm: 0.45,
    },
    distanciaKmPassageiros: 1040,
    distanciaKmDeslocamentoVazio: 60,
    distanciaTotalKm: 1100,
    custoCombustivelLitro: 6.29,
    custoCombustivelConsumo: 3.2,
    custos: {
      motorista1Valor: 900,
      motorista2Valor: 600,
      hospedagem: 500,
      antt: 180,
      agua: 120,
      stilmill: 150,
      pedagios: 240,
    },
    outrosCustos: [{ nome: "Estacionamento Salvador", valor: 120 }],
    aliquotaImpostoPercent: 6.0,
    valorCobrado: 11500,
    dataEmissao: "2026-10-09",
    diasValidade: 7,
    dataValidade: "2026-10-16",
    condicoesComerciais: {
      formaPagamento: "50% de sinal na reserva e 50% até 24h antes do embarque",
      incluso: "Transporte executivo com ar-condicionado, motoristas, combustível, taxas e seguro",
      naoIncluso: "Hospedagem e alimentação dos passageiros",
    },
    regrasViagem: "Bagagem permitida: até 20kg no bagageiro + 5kg de mão. Tolerância máxima no embarque: 15 minutos. Proibido fumar a bordo.",
  };

  generateOrcamentoPdf(typeArg, mockOrcamento, outputArg)
    .then(() => {
      console.log(`✅ PDF ${typeArg} gerado com sucesso em: ${outputArg}`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Erro ao gerar PDF:", err);
      process.exit(1);
    });
}
