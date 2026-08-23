# Notas de schema: abastecimentos

Levantamento feito antes de incluir `fuelingDate` em `fuelings`.

- Banco alvo configurado: `(default)` em `southamerica-east1`; o projeto usa o Firestore Standard.
- Coleção: `fuelings`.
- Escritas do frontend passam por `firebase-service.js`, que adiciona `companyId`, `createdBy`, `createdAt`, `updatedAt` e o `auditLog` no mesmo batch.
- O campo legado `data` é uma string ISO e continuará sendo gravado com o mesmo valor de `fuelingDate` para manter compatibilidade.
- `fuelingDate` será a fonte principal da data real de abastecimento. Leituras de documentos antigos usam `data` e, em último caso, `createdAt` somente para exibição/ordenação.
- As regras mantêm validação estrita de campos, metadados imutáveis e permissões atuais de admin/operador; será incluído somente `fuelingDate` no schema validado.
