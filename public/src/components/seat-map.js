/**
 * Gerador de Mapa de Poltronas em SVG dinâmico para Garcia Turismo.
 * Renderiza ônibus, micro-ônibus e vans com portas, cabine do motorista,
 * numeração e categorização visual de poltronas (Janela, Corredor, Frente).
 */

export function generateSeatMapSVG({
  tipo = "onibus",
  layout = "onibus_46",
  capacidade = 46,
  corTema = "#2563eb",
  showLegend = true,
}) {
  const totalSeats = Math.max(Number(capacidade) || 46, 1);
  const isVan = tipo === "van" || layout.startsWith("van");
  const isMicro = tipo === "microonibus" || layout.startsWith("micro");

  // Parâmetros de grade
  let cols = 4; // 2x2 padrão
  let rows = Math.ceil(totalSeats / 4);
  if (isVan) {
    cols = 3;
    rows = Math.ceil(totalSeats / 3);
  }

  const seatWidth = 38;
  const seatHeight = 36;
  const aisleWidth = isVan ? 24 : 32;
  const paddingX = 40;
  const headerHeight = 110;
  const rowGap = 10;
  const seatGap = 8;

  const contentWidth = isVan
    ? paddingX * 2 + seatWidth * 3 + aisleWidth
    : paddingX * 2 + seatWidth * 4 + aisleWidth;
  const contentHeight = headerHeight + rows * (seatHeight + rowGap) + 80;

  let seatsSVG = "";
  let seatNumber = 1;

  for (let r = 0; r < rows; r++) {
    const y = headerHeight + r * (seatHeight + rowGap);

    if (!isVan) {
      // Ônibus / Micro 2x2: Poltronas Esquerda (Janela, Corredor) - Corredor - Poltronas Direita (Corredor, Janela)
      const positions = [
        { colIndex: 0, x: paddingX, isWindow: true },
        { colIndex: 1, x: paddingX + seatWidth + seatGap, isWindow: false },
        { colIndex: 2, x: paddingX + seatWidth * 2 + seatGap + aisleWidth, isWindow: false },
        { colIndex: 3, x: paddingX + seatWidth * 3 + seatGap * 2 + aisleWidth, isWindow: true },
      ];

      for (const pos of positions) {
        if (seatNumber > totalSeats) break;

        const isFrontRow = r === 0;
        const fill = isFrontRow
          ? "#e0f2fe"
          : pos.isWindow
          ? "#f0fdf4"
          : "#f8fafc";
        const stroke = isFrontRow
          ? "#0284c7"
          : pos.isWindow
          ? "#16a34a"
          : "#64748b";
        const textColor = isFrontRow ? "#0369a1" : pos.isWindow ? "#15803d" : "#334155";

        seatsSVG += `
          <g class="seat-node" transform="translate(${pos.x}, ${y})">
            <rect width="${seatWidth}" height="${seatHeight}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />
            <rect x="3" y="${seatHeight - 6}" width="${seatWidth - 6}" height="4" rx="2" fill="${stroke}" opacity="0.3"/>
            <text x="${seatWidth / 2}" y="${seatHeight / 2 + 5}" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="${textColor}" text-anchor="middle">${seatNumber}</text>
          </g>
        `;
        seatNumber++;
      }
    } else {
      // Van (1x2 ou 2x1)
      const positions = [
        { colIndex: 0, x: paddingX, isWindow: true },
        { colIndex: 1, x: paddingX + seatWidth + aisleWidth, isWindow: false },
        { colIndex: 2, x: paddingX + seatWidth * 2 + aisleWidth + seatGap, isWindow: true },
      ];

      for (const pos of positions) {
        if (seatNumber > totalSeats) break;
        const fill = pos.isWindow ? "#f0fdf4" : "#f8fafc";
        const stroke = pos.isWindow ? "#16a34a" : "#64748b";
        const textColor = pos.isWindow ? "#15803d" : "#334155";

        seatsSVG += `
          <g class="seat-node" transform="translate(${pos.x}, ${y})">
            <rect width="${seatWidth}" height="${seatHeight}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="1.5" />
            <text x="${seatWidth / 2}" y="${seatHeight / 2 + 5}" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="${textColor}" text-anchor="middle">${seatNumber}</text>
          </g>
        `;
        seatNumber++;
      }
    }
  }

  // Legenda
  let legendSVG = "";
  if (showLegend) {
    const legendY = contentHeight - 45;
    legendSVG = `
      <g transform="translate(${paddingX}, ${legendY})" font-family="Arial, sans-serif" font-size="11" fill="#475569">
        <rect x="0" y="0" width="14" height="14" rx="3" fill="#f0fdf4" stroke="#16a34a" stroke-width="1.2"/>
        <text x="20" y="11">Janela</text>

        <rect x="75" y="0" width="14" height="14" rx="3" fill="#f8fafc" stroke="#64748b" stroke-width="1.2"/>
        <text x="95" y="11">Corredor</text>

        <rect x="160" y="0" width="14" height="14" rx="3" fill="#e0f2fe" stroke="#0284c7" stroke-width="1.2"/>
        <text x="180" y="11">Frente</text>
      </g>
    `;
  }

  const busRadius = isVan ? 24 : 32;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${contentWidth} ${contentHeight}" width="100%" height="auto" class="seat-map-svg" style="max-width: ${contentWidth}px; margin: 0 auto; display: block;">
      <defs>
        <linearGradient id="bodyBg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="100%" stop-color="#f8fafc"/>
        </linearGradient>
      </defs>

      <!-- Chassis do Veículo -->
      <rect x="15" y="10" width="${contentWidth - 30}" height="${contentHeight - 20}" rx="${busRadius}" fill="url(#bodyBg)" stroke="#cbd5e1" stroke-width="2" />
      
      <!-- Para-brisa dianteiro -->
      <path d="M 30 45 Q ${contentWidth / 2} 18 ${contentWidth - 30} 45" fill="none" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/>
      
      <!-- Cabine / Motorista -->
      <g transform="translate(${paddingX}, 55)">
        <rect width="40" height="36" rx="6" fill="#1e293b" />
        <circle cx="20" cy="18" r="8" fill="none" stroke="#94a3b8" stroke-width="2.5" />
        <path d="M 20 10 L 20 26 M 12 18 L 28 18" stroke="#94a3b8" stroke-width="2" />
        <text x="20" y="48" font-family="Arial, sans-serif" font-size="9" font-weight="600" fill="#64748b" text-anchor="middle">MOTORISTA</text>
      </g>

      <!-- Porta de Entrada -->
      <g transform="translate(${contentWidth - paddingX - 44}, 55)">
        <rect width="44" height="26" rx="4" fill="#f1f5f9" stroke="#0284c7" stroke-width="1.5" stroke-dasharray="3 2" />
        <text x="22" y="17" font-family="Arial, sans-serif" font-size="10" font-weight="700" fill="#0284c7" text-anchor="middle">PORTA 🚪</text>
      </g>

      <!-- Poltronas -->
      ${seatsSVG}

      <!-- Legenda -->
      ${legendSVG}
    </svg>
  `;
}

