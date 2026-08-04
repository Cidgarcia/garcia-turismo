# Auditoria técnica — Garcia Turismo

Data da revisão: 03/08/2026

## Resultado geral

O projeto tem separação razoável entre componentes, serviços, configuração e automações para o seu tamanho. A base é compatível com um projeto de desenvolvedor júnior em evolução, mas ainda não estava pronta para produção financeira sem ajustes de autenticação, RLS, backup e confiabilidade do envio mensal.

## Achados prioritários

### Críticos

1. **Leitura do relatório fora da sessão autenticada**  
   `scripts/send-report.js` carregava o estado com `service_role`, porém `public/src/report/report.js` descartava esse resultado e consultava o banco novamente com a chave pública. Com RLS restritivo, a página falha; com acesso anônimo liberado, o estado financeiro pode ser lido sem login. A correção injeta o estado já obtido no contexto isolado do Playwright.

2. **Controle de acesso do banco não versionado**  
   Não havia migration ou política RLS no repositório. A configuração real do dashboard não pode ser confirmada apenas pelo código. Foi incluída uma migration que revoga `anon` e autoriza apenas `authenticated` no registro principal.

3. **Backup automático inexistente**  
   `maybeAutoBackup()` apenas registrava uma data no `localStorage`; nenhuma cópia era criada. Foi incluído backup diário criptografado, validação e restauração do registro principal.

### Altos

4. **Remetente e destinatário fixos no código**  
   O e-mail pessoal e `onboarding@resend.dev` estavam versionados. Agora remetente, destinatários e resposta são definidos por secrets.

5. **Envio Resend pouco observável**  
   Faltavam `User-Agent` explícito, idempotência, retentativa seletiva, identificação do status HTTP e divisão por limite de anexos. O novo script cobre esses pontos.

6. **Possível XSS armazenado no PDF**  
   Campos do banco eram interpolados diretamente em `innerHTML`. A versão corrigida escapa todos os valores dinâmicos e usa `textContent` para mensagens de erro.

7. **Sessão Supabase não persistida**  
   O cliente usava `persistSession: false` e `autoRefreshToken: false`, ao mesmo tempo que a aplicação mantinha um indicador próprio de login. Após recarregar a página, a interface podia considerar o usuário logado sem JWT válido. A configuração foi alterada para persistir e renovar a sessão real.

### Médios

8. **Estado inteiro em uma única coluna JSON**  
   É simples, mas reduz integridade referencial, auditoria, consultas, controle de concorrência e recuperação granular. Para o volume atual pode permanecer; a próxima evolução deve separar despesas, abastecimentos, veículos e usuários em tabelas relacionadas.

9. **Dependências de frontend carregadas por CDN**  
   Tailwind, Supabase e outras bibliotecas remotas aumentam dependência externa e dificultam CSP estrita. A correção fixa uma versão do cliente Supabase, mas o ideal futuro é introduzir um build local com Vite e lockfile.

10. **Ausência de testes automatizados e lint**  
    Foi adicionado `npm run check` para sintaxe. Ainda faltam testes unitários para período mensal, filtros, totalização, backup e integração Resend simulada.

11. **Dados seed reais no repositório público**  
    O arquivo `recovered-data.js` contém nomes, modelos de veículos e instituições financeiras. Hoje não há despesas no seed, mas ele deve usar dados fictícios para evitar exposição futura.

## Variáveis e segredos

### Podem ficar no frontend

- URL do projeto Supabase.
- Chave `anon`/publishable.
- ID lógico do estado.

Esses valores identificam o projeto, mas não devem autorizar acesso sozinhos. RLS e grants são obrigatórios.

### Devem ficar apenas em secrets/backend

- `SUPABASE_SERVICE_ROLE_KEY`.
- `RESEND_API_KEY`.
- URL direta do PostgreSQL e senha do banco.
- `BACKUP_ENCRYPTION_KEY`.

Nunca devem ser colocados em `public/`, commits, screenshots ou logs.

## Estratégia de recuperação recomendada

1. Backup criptografado diário do registro `app_states` — incluído neste pacote.
2. Backup gerenciado do Supabase/PITR conforme criticidade e plano.
3. Exportação completa periódica do PostgreSQL para armazenamento externo privado.
4. Teste trimestral de restauração em outro projeto Supabase.
5. Guardar a chave de criptografia fora do GitHub, preferencialmente em gerenciador de senhas corporativo.

## Próxima evolução arquitetural

Depois destas correções leves, a mudança de maior valor seria criar um backend pequeno ou Supabase Edge Functions para relatórios, exportações e operações administrativas. Isso reduziria a superfície do frontend, centralizaria autorização e permitiria logs/auditoria melhores sem reescrever toda a interface.
