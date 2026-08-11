# 🚍 Garcia Turismo | Gestão Financeira

Aplicação web desenvolvida para o controle financeiro e operacional da **Garcia Turismo**, reunindo gestão de veículos, abastecimentos, viagens, despesas, pagamentos de funcionários, relatórios mensais e backups automatizados.

---

## 🏗️ Arquitetura

| Camada          | Tecnologia                                                 |
| --------------- | ---------------------------------------------------------- |
| 🌐 Frontend     | HTML, CSS e JavaScript modular                             |
| 🔐 Autenticação | Firebase Authentication (e-mail e senha)                   |
| 🗄️ Dados       | Cloud Firestore, com documentos independentes por registro |
| 📄 Relatórios   | Playwright e template HTML                                 |
| ✉️ E-mail       | Resend                                                     |
| ⚙️ Automação    | GitHub Actions                                             |

Os dados operacionais pertencem à empresa `garcia-turismo`.

Cada documento criado contém metadados como:

```text
companyId
createdAt
updatedAt
createdBy
```

Esses campos ajudam no isolamento dos dados, rastreabilidade e auditoria das operações.

---

## 💻 Configuração local

### 1. 📦 Instale as dependências

```bash
npm install
```

### 2. 🔥 Configuração do Firebase

A configuração pública do aplicativo Web já está em:

```text
public/src/config/firebase-config.js
```

Ao registrar outro aplicativo Firebase, atualize apenas os valores públicos do SDK.

> ⚠️ Nunca utilize uma conta de serviço ou chave privada no frontend.

### 3. 🔑 Configure a autenticação

Ative o provedor **E-mail/senha** no Firebase Authentication.

Depois, confira se o usuário possui um perfil correspondente em:

```text
users/{uid}
```

Exemplo:

```json
{
  "role": "admin",
  "companyId": "garcia-turismo",
  "active": true
}
```

### 4. 🔒 Configure as variáveis de ambiente

Copie:

```text
.env.example
```

para:

```text
.env
```

Use esse arquivo apenas para execução local dos scripts.

> 🚫 Nunca versione `.env`, contas de serviço ou credenciais privadas.

### 5. 🛡️ Publique regras e índices do Firestore

Após revisar as regras:

```bash
npx firebase-tools deploy --only firestore:rules,firestore:indexes --project garciaturismopnz
```

### 6. ▶️ Execute o frontend localmente

```bash
npx serve public -l 5500
```

Depois acesse:

```text
http://localhost:5500
```

---

## 🔐 GitHub Actions e Secrets

Configure os seguintes secrets no repositório:

* 🔥 `FIREBASE_PROJECT_ID`: `garciaturismopnz`
* 🔑 `FIREBASE_SERVICE_ACCOUNT`: JSON completo da conta de serviço
* ✉️ `RESEND_API_KEY`
* 📤 `REPORT_FROM`
* 📥 `REPORT_TO`
* ↩️ `REPORT_REPLY_TO` — opcional
* 🔒 `BACKUP_ENCRYPTION_KEY`: chave aleatória de 32 bytes em Base64

> ⚠️ O conteúdo de `FIREBASE_SERVICE_ACCOUNT` nunca deve ser exibido em logs ou colocado no código do frontend.

Os workflows automatizados utilizam o **Firebase Admin SDK** exclusivamente no ambiente backend do GitHub Actions.

---

## 🧪 Scripts disponíveis

| Comando                                                 | Finalidade                                                                    |
| ------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 🩺 `npm run check`                                      | Valida a sintaxe dos scripts e módulos críticos                               |
| 📊 `npm run test:reports`                               | Executa os testes dos relatórios                                              |
| 🧰 `npm run test:utils`                                 | Executa os testes dos utilitários ativos                                      |
| 👨‍💼 `npm run test:employee-payments`                  | Testa os cálculos de pagamentos de funcionários                               |
| 🔌 `npm run test:services`                              | Testa a integração do adaptador de dados com Firebase mockado                 |
| 🛡️ `npm run test:rules`                                | Inicia o Firestore Emulator, executa os testes de regras e encerra o ambiente |
| 📧 `npm run send-report`                                | Gera os PDFs do período e envia os relatórios pelo Resend                     |
| 💾 `npm run backup:export`                              | Exporta documentos do Firestore, compacta e criptografa o backup              |
| ♻️ `npm run backup:restore -- arquivo.json.enc --apply` | Restaura um backup após validação explícita                                   |

---

## 💾 Backup

O sistema possui rotina de backup criptografado dos dados armazenados no Firestore.

O processo segue, de forma simplificada:

```text
Firestore
   ↓
Exportação JSON
   ↓
Compactação
   ↓
Criptografia
   ↓
Backup seguro
```

As seguintes coleções fazem parte do backup:

```text
users
vehicles
expenses
trips
fuelings
employees
cards
```

> 🔐 As contas do Firebase Authentication, incluindo senhas, **não fazem parte desse backup**.

A recuperação de usuários do Authentication exige procedimento administrativo separado.

---

## 🧪 Como rodar os testes

Após instalar as dependências:

```bash
npm install
```

Execute as validações:

```bash
npm run check
npm run test:reports
npm run test:utils
npm run test:employee-payments
npm run test:services
npm run test:rules
```

O pacote `firebase-tools` está declarado como dependência de desenvolvimento.

O comando:

```bash
npm run test:rules
```

faz todo o processo automaticamente:

```text
🚀 inicia o Firestore Emulator
        ↓
🧪 executa os testes das regras
        ↓
✅ finaliza o Emulator
```

Não é necessário:

* abrir outro terminal;
* iniciar o Emulator manualmente;
* definir `FIRESTORE_EMULATOR_HOST`.

---

## 🔥 Firebase

O sistema utiliza:

* 🔐 **Firebase Authentication** para login;
* 🗄️ **Cloud Firestore** para persistência;
* 🛡️ **Firestore Security Rules** para controle de acesso;
* 🤖 **Firebase Admin SDK** nos scripts automatizados.

A configuração Web do Firebase presente no frontend identifica o aplicativo cliente e não substitui as regras de segurança.

A proteção dos dados depende principalmente de:

```text
Authentication
+
Firestore Security Rules
+
companyId
+
perfis de acesso
```

---

## ✉️ Relatórios automáticos

Os relatórios mensais são gerados automaticamente utilizando:

```text
Firestore
   ↓
Playwright
   ↓
HTML
   ↓
PDF
   ↓
Resend
   ↓
E-mail
```

O sistema pode gerar relatórios gerais e individuais por veículo.

---

## ⚙️ Automação

O projeto utiliza **GitHub Actions** para tarefas automáticas, incluindo:

* 📧 geração e envio de relatórios;
* 💾 criação de backups;
* 🔐 utilização segura de secrets;
* 🧪 execução de rotinas automatizadas.

---

## 🛡️ Segurança

Algumas das medidas adotadas no projeto:

* 🔐 Firebase Authentication;
* 🧱 Firestore Security Rules;
* 🏢 isolamento por `companyId`;
* 📝 registros de auditoria;
* 🔑 credenciais armazenadas em GitHub Secrets;
* 🚫 ausência de Service Account no frontend;
* 💾 backups criptografados;
* 🧪 testes automatizados de permissões;
* 🧼 renderização segura de conteúdo HTML.

---

## 📌 Tecnologias utilizadas

```text
HTML
CSS
JavaScript
Node.js
Firebase Authentication
Cloud Firestore
Firebase Admin SDK
GitHub Actions
Playwright
Resend
Firebase Emulator
```

---

## 🚀 Garcia Turismo

Sistema desenvolvido para centralizar e automatizar a gestão financeira e operacional da **Garcia Turismo**, reduzindo controles manuais e facilitando o acompanhamento de despesas, veículos, viagens, funcionários e relatórios.
