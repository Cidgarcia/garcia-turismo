# Correções Garcia Turismo

Este pacote é um **overlay**: copie os arquivos sobre o repositório atual, execute `npm install` para atualizar o lockfile e faça os testes antes de publicar.

## 1. Configuração do Resend

1. No Resend, adicione e verifique um domínio próprio.
2. Em GitHub → Settings → Secrets and variables → Actions, crie:
   - `RESEND_API_KEY`
   - `REPORT_FROM` — exemplo: `Garcia Turismo <relatorios@seudominio.com.br>`
   - `REPORT_TO` — um ou mais e-mails separados por vírgula
   - `REPORT_REPLY_TO` — opcional
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. Execute manualmente o workflow **Relatório mensal Garcia Turismo**.
4. Para reprocessar um mês, informe `YYYY-MM` no campo `report_month`.

O novo fluxo busca o estado uma única vez com a chave administrativa, injeta-o somente no navegador isolado do Playwright e não faz leitura anônima do Supabase. Também espera a renderização terminar, divide anexos grandes, adiciona idempotência, tentativas para erros temporários e mensagens de erro melhores.

## 2. Segurança do Supabase

Execute a migration `supabase/migrations/20260803200000_secure_app_states.sql` no SQL Editor do Supabase.

Antes de aplicar, confirme que existe ao menos um usuário no Supabase Auth e que o login do site funciona. Depois da migration, usuários anônimos deixam de ler e gravar `app_states`.

A URL e a chave `anon`/publishable do Supabase podem aparecer no frontend; elas não concedem segurança por si mesmas. A proteção real deve vir de RLS. A `service_role` nunca pode aparecer em HTML, JavaScript público, logs ou commits.

## 3. Backup e restauração

Crie o secret `BACKUP_ENCRYPTION_KEY` com:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Guarde uma cópia dessa chave fora do GitHub, em um gerenciador de senhas. Sem ela, o backup não pode ser restaurado.

O workflow **Backup criptografado Garcia Turismo** cria diariamente uma cópia criptografada do registro principal e a mantém como artifact por 90 dias. Ele também pode ser executado manualmente.

Validação local, sem alterar o banco:

```bash
BACKUP_ENCRYPTION_KEY='...' npm run backup:restore -- caminho.json.enc
```

Restauração em um projeto Supabase novo ou existente:

```bash
SUPABASE_URL='...' \
SUPABASE_SERVICE_ROLE_KEY='...' \
BACKUP_ENCRYPTION_KEY='...' \
npm run backup:restore -- caminho.json.enc --apply
```

Esse backup cobre os dados de negócio armazenados em `app_states`. Ele não substitui um backup completo do PostgreSQL, das contas do Supabase Auth e da estrutura do projeto. Ative também os backups gerenciados/PITR do Supabase conforme o plano e mantenha uma cópia externa periódica.

## 4. Teste local do relatório

```bash
npm install
npx playwright install chromium
npx serve public -l 5500
```

Em outro terminal:

```bash
RESEND_API_KEY='...' \
REPORT_FROM='Garcia Turismo <relatorios@seudominio.com.br>' \
REPORT_TO='destinatario@exemplo.com' \
SUPABASE_URL='...' \
SUPABASE_SERVICE_ROLE_KEY='...' \
npm run send-report
```

Para testar o remetente de sandbox do Resend apenas com o e-mail autorizado da conta, acrescente `ALLOW_RESEND_TEST_SENDER=true` e use `REPORT_FROM=onboarding@resend.dev`.

## 5. Arquivos alterados

- `scripts/send-report.js`
- `public/src/report/report.js`
- `public/src/services/supabase-service.js`
- `.github/workflows/monthly-report.yml`
- `.github/workflows/encrypted-backup.yml`
- `scripts/export-backup.js`
- `scripts/restore-backup.js`
- `supabase/migrations/20260803200000_secure_app_states.sql`
- `package.json`, `.gitignore` e `.env.example`
