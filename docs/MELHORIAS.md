# Melhorias e débitos técnicos

Levantamento feito em 10/11/2026 sobre o branch atual, incluindo as alterações locais ainda não commitadas em `app/promotor/page.tsx` e `components/home/*`.

Estado na data:

- `npm test`: 9 arquivos, 62 testes passando.
- `npm run lint`: 0 erros e 2 avisos.
- `npx tsc --noEmit`: **falhando**, com 4 erros no app e 3 grupos de erros nos testes (detalhes abaixo).

Atualização (10/11/2026, FIUFIU-31): itens 1, 2 e 4 resolvidos. `npm test`: 10 arquivos, 68 testes passando · `npm run lint`: 0 erros e 1 aviso · `npx tsc --noEmit`: sem erros · `next build` compilando.

Prioridades: **P0** quebra funcionalidade ou build · **P1** risco de bug ou segurança · **P2** limpeza e manutenção.

---

## P0: quebrado agora

### 1. ✅ Typecheck falha por causa da nova assinatura do `Header` (resolvido em FIUFIU-31)

O `Header` não recebe mais `fullName`, mas quatro páginas ainda passam essa prop:

- `app/agenda/page.tsx`
- `app/comercial/page.tsx`
- `app/comercial/[id]/page.tsx`
- `app/visitas/[id]/page.tsx`

**Correção:** remover `fullName={...}` dessas chamadas. Onde `fullName` só servia ao header, remover também a chamada a `getHeaderFullName` (em `/visitas/[id]` o nome continua sendo usado no texto de cópia da visita).

### 2. ✅ A home do promotor sempre mostra lista vazia (resolvido em FIUFIU-31)

`components/home/home-page-content.tsx` passou a usar `visits = []` fixo, sem chamar `listVisitsReportByPromotorId`. Se a intenção for só trocar o header, é preciso restaurar a busca paginada. Também sobrou `getRoleLabel` sem uso (aviso do lint).

### 3. ✅ Rotas do frontend que não existem na `fiu-fiu-api` (resolvido em FIUFIU-32)

> Resolvido em 11/11/2026: a API publicou `GET/POST /commercial-visits` e `GET/PUT /commercial-visits/{id}` (tabela `commercial_submissions`), o app passou a usá-las e `createPromotorAgendaEntry` chama `POST /promotors/agenda`. Contrato no README da API.

> `PATCH /promotor/agenda/:id` foi publicado na API em FIUFIU-30.

Comparação com o `serverless.yml` da API (commit `82e4190`):

| Frontend chama | Backend expõe | Onde |
| --- | --- | --- |
| `POST /comercial/visit` | não existe | `createCommercialVisit` |
| `GET /comercial/visit/:id` | não existe | `listCommercialVisitsByComercialId` |
| `GET /comercial/visits` | `GET /commercial-visits` | `listAllCommercialVisits` |
| `PUT /promotor/visit/:id` (para comercial) | é a rota de **visita de promotor** | `updateCommercialVisit`: pode sobrescrever uma visita de promotor com o mesmo ID |
| `POST /promotor/agenda` | `POST /promotors/agenda` | `createPromotorAgendaEntry` |
| `PATCH /promotor/agenda/:id` | handler existe, rota não está no yml | `updatePromotorAgendaEntry` |

**Ação:** confirmar o que está de fato publicado (o deploy pode estar à frente do repositório) e alinhar um dos dois lados. O caso mais urgente é `updateCommercialVisit`.

### 4. ✅ Erros de tipo nos testes (resolvido em FIUFIU-31)

- `tests/lib/file-utils.test.ts` não importa `describe/it/expect`. Importar de `vitest` ou adicionar `"types": ["vitest/globals"]` ao `tsconfig`.
- `tests/lib/actions.test.ts:153` chama `searchClients({ clientName })`. O tipo de entrada deveria ser `z.input<typeof clientSearchSchema>` em vez de `z.infer` (os campos têm `default`).
- `tests/lib/api-client.test.ts:48` usa `toMatchObject` sobre um tipo que exige todos os campos. Basta tipar o objeto esperado de forma parcial.

---

## P1: risco de bug ou segurança

5. ✅ (FIUFIU-33) **Qualquer pessoa pode se cadastrar como `comercial`.** O `signup-form` oferece o perfil e `signUp` grava a role escolhida na sessão. O perfil comercial vê e edita a agenda de todos os promotores. A role deveria vir só da API (`/promotor/me`), nunca do formulário.
6. ✅ (FIUFIU-33: a API agora autoriza cada rota pelo perfil lido do banco; o cookie só afeta a tela) **A sessão confia em cookie com JSON do usuário.** `ff_user` e `ff_role` são httpOnly, mas não assinados. A role usada para autorização no frontend (por exemplo, `isAdminView`) vem desse cookie. Recomendações: derivar a role do JWT ou de `/promotor/me` e garantir que a API valide permissões em cada rota.
7. **PWA sem service worker em produção.** `PwaRegister` registra `/sw.js`, mas `next-pwa` não está configurado no `next.config.ts` e `public/sw.js` está no `.gitignore`. No deploy, o registro dá 404. Escolha uma opção: configurar `next-pwa` (ou `@serwist/next`) ou remover o registro e a dependência.
8. **Logs de toda requisição em produção.** `lib/api/client.ts` faz `console.log` de método e URL em cada chamada. Proteger com `process.env.NODE_ENV !== 'production'` ou uma flag `DEBUG_API`.
9. **`skipWeeklyVehicleCheck` envia imagem falsa** (`'b2zDoSA='`, que é "olá" em base64) e quilometragem 0. Isso polui os relatórios. O ideal é a API aceitar um campo `skipped: true`.
10. **`lib/db.ts` exige `DATABASE_URL` na importação.** Como `lib/actions.ts` importa o pool, qualquer action quebra sem banco, mesmo usando só a API. Migrar os 3 usos restantes para a API (busca geral de clientes → `GET /clients`; nome → `/promotor/me`; ID → JWT) e remover `@neondatabase/serverless`.
11. ✅ (usa `GET /commercial-visits/{id}`) **Busca de detalhe do comercial baixa a lista inteira** (`app/comercial/[id]` e `/editar`) e filtra em memória. Criar ou usar um endpoint `GET /commercial-visits/:id`.

---

## P2: limpeza e organização

### Duplicação a centralizar

12. **Regra de validade indefinida** está em 5 arquivos. Criar `lib/visit-products.ts` com `PRODUCT_OPTIONS`, `INDEFINITE_EXPIRATION_PRODUCTS`, `normalizeProductName`, `shouldUseIndefiniteExpiration`, `isExpirationWithinVisitWindow` e reutilizar no form, nas actions, na normalização da API e nas páginas.
13. **JWT e token.** `decodeJwtPayload` está em `lib/auth.ts`, `lib/actions.ts` e `lib/weekly-vehicle-check-api.ts`, e a normalização de "Bearer" em `auth.ts`, `api/client.ts` e `api/promotor.ts`. Criar `lib/jwt.ts` e exportar dali.
14. **Conversores** (`toNumber`, `toStringValue`, `toNullableString`...) estão repetidos em `lib/api/promotor.ts` e `lib/api/comercial.ts`. Mover para `lib/api/normalize.ts`.
15. **Normalização de texto para busca** (NFD + lowercase) aparece em `actions.ts`, `agenda-options.ts`, `comercial/page.tsx` e no form. Criar `lib/text.ts`.
16. **Tratamento de `ApiError` nas actions** se repete cerca de 12 vezes. Um helper `toActionError(error, fallback)` que já faça `clearSession` no 401 reduziria bastante o `actions.ts`.
17. **Route Handlers de visita** (`app/api/promotor/visit/route.ts` e `[visitId]/route.ts`) duplicam `extractVisitId`, `revalidateVisitPaths` e o tratamento de erro.
18. **Layout das telas.** O fundo em gradiente e o card das telas de login se repetem em várias páginas. Extrair para componentes (`AppBackground`, `AuthCard`).

### Arquivos grandes

19. `components/visits/new-visit-form.tsx` (~1700 linhas) pode ser dividido em `client-search`, `product-list`, `image-gallery-field` e `visit-submit` (lógica de upload).
20. `lib/actions.ts` (~1200 linhas) pode ser dividido por domínio em `lib/actions/{auth,visits,agenda,commercial,mileage}.ts`, cada um com `'use server'`.

### Código morto

21. Remover:
    - `components/home/middleware.ts`: fora da raiz, o Next nunca carrega. Se a proteção global de rotas for desejada, criar `proxy.ts` na raiz (Next 16).
    - `lib/forgot-password-flow.tsx`: não é importado; o fluxo real está em `components/auth/forgot-password-form.tsx`.
    - `lambda/`: cópia dos handlers que vivem na `fiu-fiu-api`.
    - `lib/weekly-vehicle-check.ts` → `hasWeeklyVehicleCheckForWeek` (SQL direto, sem uso).
    - `lib/commercial.ts` → `getCommercialSubmissions` e `getCommercialSubmissionById` (sem uso).
    - `lib/api/promotor.ts` → `listPromotorVisitsByPromotorId`, `listAllPromotorVisits` e os aliases `createVisit`/`updateVisit`.
    - `lib/auth.ts` → `requireSessionUser`. `getPromotorIdFromSession` volta a ser usado se a home for restaurada.
    - `mapGalleryToLegacyPayload` e `shouldUseLegacyVisitFallback` no form, se a API antiga não for mais suportada.
22. `app/testes/quilometragem-sem-foto/` está versionado, mas também no `.gitignore`. Decidir se fica (e tirar do ignore) ou sai do git (`git rm --cached`).
23. `database/*.sql` não reflete o schema atual (as migrations Drizzle da API são a fonte). Mover para `docs/legacy-sql/` ou remover.

### Configuração

24. `package.json` tem `"name": "my-app"`. Renomear para `app-promotores-fiu-fiu`, adicionar `"typecheck": "tsc --noEmit"` e incluir o typecheck no CI.
25. `.env.example`: adicionar `FIU_FIU_API_BASE_URL` e remover `OPENAI_*` (não usados).
26. `next-pwa` em `dependencies` sem uso (ver item 7).
27. Faltam testes para: Route Handlers de visita, `lib/visit-copy.ts`, `lib/weekly-vehicle-check.ts` (virada de semana e fuso) e o fluxo de recuperação de senha.

---

## Ordem sugerida

1. P0 itens 1, 2 e 4 → `tsc` verde.
2. P0 item 3 com o time da API.
3. Itens 5, 6 e 10 (segurança e independência do banco).
4. Centralizações 12 e 13 (baixo risco, cobertas por testes).
5. Remoção de código morto (21 a 23) e configuração (24 a 26).
6. Quebra dos arquivos grandes (19 e 20) com testes antes.
