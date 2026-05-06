# 🚍 Garcia Turismo | Gestão Financeira

Sistema completo de gestão financeira para controle de despesas, veículos, funcionários e geração automática de relatórios em PDF.

---

## Funcionalidades

- 📊 Dashboard financeiro
- 🚗 Controle por veículo
- 👨‍💼 Controle por funcionário
- ⛽ Controle de combustível
- 📅 Filtros por período
- 📄 Geração de relatórios em PDF (automático)
- ☁️ Persistência em nuvem (Supabase)
- 📧 Envio automático de relatórios por email (Resend)
- ⚙️ Automação mensal (GitHub Actions)

---

## 🏗️ Arquitetura

| Camada     | Tecnologia           |
| ---------- | -------------------- |
| Frontend   | HTML + JS + Tailwind |
| Backend    | Supabase (BaaS)      |
| Automação  | GitHub Actions       |
| PDF Engine | Playwright           |
| Email      | Resend API           |

---

## 📁 Estrutura do Projeto

garcia-turismo/
│
├── public/ # Frontend
│ ├── index.html
│ ├── report.html
│ ├── assets/
│ ├── styles/
│ └── src/
│
├── scripts/ # Automação (PDF + envio)
│ └── send-report.js
│
├── .github/
│ └── workflows/
│ └── monthly-report.yml
│
├── package.json
└── README.md

---
