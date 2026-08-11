# Garcia Turismo | Gestão Financeira

Aplicação web para o controle financeiro, de veículos, abastecimentos, viagens e relatórios mensais da Garcia Turismo.

## Arquitetura

| Camada | Tecnologia |
| --- | --- |
| Frontend | HTML, CSS e JavaScript modular |
| Autenticação | Firebase Authentication (e-mail e senha) |
| Dados | Cloud Firestore, com documentos independentes por registro |
| Relatórios | Playwright e template HTML |
| E-mail | Resend |
| Automação | GitHub Actions |

Os dados operacionais pertencem à empresa `garcia-turismo`. Cada documento criado contém `companyId`, `createdAt`, `updatedAt` e `createdBy`.

## Configuração local

1. Instale as dependências:

   ```bash
   npm install
   ```

2. A configuração pública do aplicativo Web já está em [firebase-config.js](public/src/config/firebase-config.js). Ao registrar outro aplicativo, atualize apenas os valores públicos do SDK; nunca use uma conta de serviço no frontend.

3. Ative o provedor **E-mail/senha** no Firebase Authentication e confira o perfil em `users/{uid}`:

   ```json
   {
     "role": "admin",
     "companyId": "garcia-turismo",
     "active": true
   }
   ```

4. Copie `.env.example` para `.env` para executar scripts locais. Nunca versione `.env` nem a conta de serviço.

5. Publique regras e índices após revisar:

   ```bash
   npx firebase-tools deploy --only firestore:rules,firestore:indexes --project garciaturismopnz
   ```

6. Sirva o frontend:

   ```bash
   npx serve public -l 5500
   ```

## GitHub Actions e secrets

Configure os seguintes secrets do repositório:

- `FIREBASE_PROJECT_ID`: `garciaturismopnz`.
- `FIREBASE_SERVICE_ACCOUNT`: JSON completo da conta de serviço, em uma linha, sem imprimi-lo em logs.
- `RESEND_API_KEY`, `REPORT_FROM`, `REPORT_TO` e, se necessário, `REPORT_REPLY_TO`.
- `BACKUP_ENCRYPTION_KEY`: 32 bytes aleatórios em Base64.

Os workflows mensais usam o Firebase Admin SDK exclusivamente no backend. O JSON da conta de serviço nunca é usado pelo navegador.

## Scripts

| Comando | Finalidade |
| --- | --- |
| `npm run check` | Valida a sintaxe dos scripts e módulos críticos. |
| `npm run test:reports` | Executa testes dos relatórios. |
| `npm run test:utils` | Executa testes dos utilitários ativos. |
| `npm run test:employee-payments` | Executa testes do cálculo de pagamentos de funcionários. |
| `npm run test:services` | Executa o teste de integração do adaptador de dados com Firebase mockado. |
| `npm run test:rules` | Inicia o Firestore Emulator, executa os testes de regras e o encerra. |
| `npm run send-report` | Gera os PDFs do período e os envia pelo Resend. |
| `npm run backup:export` | Exporta documentos do Firestore, compacta e criptografa. |
| `npm run backup:restore -- arquivo.json.enc --apply` | Restaura um backup após validação explícita. |

O backup contém as coleções `users`, `vehicles`, `expenses`, `trips`, `fuelings`, `employees` e `cards`. Contas do Firebase Authentication, inclusive senhas, exigem procedimento administrativo separado e não fazem parte do backup.

## Como rodar os testes

Após instalar as dependências, execute cada validação:

```bash
npm install
npm run check
npm run test:reports
npm run test:utils
npm run test:employee-payments
npm run test:services
npm run test:rules
```

`firebase-tools` está declarado como dependência de desenvolvimento. O comando `npm run test:rules` inicia e encerra o Firestore Emulator automaticamente; não é necessário abrir outro terminal nem definir `FIRESTORE_EMULATOR_HOST` manualmente.
