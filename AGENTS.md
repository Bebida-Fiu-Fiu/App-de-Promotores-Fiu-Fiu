# AGENTS.md

Guia para agentes de IA (e humanos) que trabalham neste repositório. Leia antes de alterar código.

## O que é o projeto

Frontend (PWA) do app de promotores e comerciais da Fiu Fiu, feito em Next.js 16 (App Router), React 19, TypeScript strict e Tailwind 4.

O app é um **BFF (backend-for-frontend)**: as páginas e Server Actions rodam no servidor Next e conversam com a API externa `fiu-fiu-api` (AWS Lambda + API Gateway, repositório separado). O navegador nunca chama a API externa diretamente, exceto no upload de imagens para URLs S3 pré-assinadas.

```
Navegador ──> Next (Server Components / Server Actions / Route Handlers) ──> fiu-fiu-api ──> Postgres/S3
                                     └──> Postgres direto (LEGADO, ver "Débitos")
```

Perfis de usuário (`types/auth.ts`):

- `promotor`: check-in semanal de quilometragem → lista de visitas → agenda de lojas atendidas → cadastro/edição de visitas (com rascunho e fotos antes/depois).
- `comercial`: cadastro e relatório de clientes comerciais; na agenda vê todos os promotores e pode editar lojas.

## Comandos

```bash
npm install
npm run dev            # http://localhost:3001 (webpack)
npm test               # vitest run
npm run lint           # eslint
npm run typecheck      # tsc --noEmit
npm run build          # build de produção (webpack)
npm run test:e2e       # testes de navegador (Playwright) contra a API simulada
npm run verify         # tudo acima, na ordem do CI (e2e no build de produção)
```

**Antes de concluir qualquer tarefa:** `npm run verify` precisa passar. É o mesmo que o CI (`.github/workflows/ci.yml`) roda em todo push e PR.

## Mapa do código

| Caminho | Responsabilidade |
| --- | --- |
| `app/` | Rotas (Server Components). Cada página chama `getSession()` e faz `redirect('/login')` se não houver sessão. |
| `app/api/promotor/visit/**` | Route Handlers que repassam `multipart/form-data` de visitas e pedem URLs de upload. Usados pelo `new-visit-form` via `fetch('/api/...')`. |
| `components/<domínio>/` | Componentes de UI por domínio: `auth`, `home`, `agenda`, `visits`, `commercial`, `pwa`. |
| `lib/actions.ts` | **Todas** as Server Actions (`'use server'`): auth, visitas, agenda, comercial, quilometragem, recuperação de senha. |
| `lib/api/client.ts` | `apiRequest` / `apiRequestWithMeta`, `ApiError`, helpers `isRecord` e `readArrayPayload`. Único lugar que faz `fetch` para a API externa. |
| `lib/api/promotor.ts`, `lib/api/comercial.ts` | Um função por endpoint + `normalize*` que converte o payload (camelCase/snake_case, formatos variados) para os tipos de `types/`. |
| `lib/auth.ts` | Sessão em cookies httpOnly (`ff_access_token`, `ff_user`, `ff_role`, `ff_session`), helpers de rota por perfil e de ID do promotor. |
| `lib/agenda-frequency.ts` | Regras de status da agenda (em dia / prazo próximo / vencido / primeira visita). Coberto por testes. |
| `lib/file-utils.ts` | Validação e compressão de imagens no cliente. |
| `lib/weekly-vehicle-check*.ts` | Janela semanal (fuso `America/Sao_Paulo`) e checagem de quilometragem. |
| `types/` | Tipos de domínio compartilhados (`auth`, `promotor`, `comercial`). |
| `tests/` | Vitest; espelha `lib/` e `components/`. `tests/stubs/server-only.ts` substitui o pacote `server-only`. |
| `database/` | SQL histórico. **Não é fonte de verdade**: o schema vive nas migrations Drizzle da `fiu-fiu-api`. |
| `lambda/` | Cópia antiga dos handlers de recuperação de senha. **Não é usada** (excluída do `tsconfig`); a versão real está na `fiu-fiu-api`. |

## Convenções obrigatórias

### Acesso a dados

1. Dados novos vêm **sempre da API externa**, via função em `lib/api/*.ts` usando `apiRequest`. Não use `fetch` direto em páginas e componentes, e não importe `lib/db.ts` em código novo.
2. Toda resposta da API passa por uma função `normalize*` que tolera camelCase/snake_case e devolve um tipo de `types/`. Componentes nunca leem payload cru.
3. Arquivos que usam token ou segredos começam com `import 'server-only';`.
4. Antes de criar ou alterar uma chamada, confira se a rota existe no `serverless.yml` da `fiu-fiu-api` (método + path). Há divergências conhecidas; veja "Débitos".

### Server Actions (`lib/actions.ts`)

- Validam a entrada com Zod (`safeParse`) e nunca lançam erro para o cliente.
- Retornam sempre `{ success: boolean; error?: string; shouldRedirectToLogin?: boolean; ...dados }`.
- Tratamento padrão de erro:
  - `ApiError` com status 401 → `await clearSession()` e `shouldRedirectToLogin: true`.
  - `ApiError` com outro status → `error.message` ou uma mensagem padrão em português.
  - Qualquer outro erro → mensagem padrão; detalhes só em `console.error`.
- Depois de mutações, chamam `revalidatePath` para todas as rotas afetadas (`/promotor`, `/agenda`, `/visitas/[id]`, `/comercial`...).

### Páginas (App Router, Next 16)

- `params` e `searchParams` são `Promise`: use `await`.
- Proteja cada página com `getSession()`. Não existe middleware/proxy ativo (o arquivo `components/home/middleware.ts` não é carregado pelo Next).
- Use `getHomePath(role)` (home) e `getAppEntryPath(role)` (pós-login, passa pelo `/checkin` do promotor) em vez de paths fixos.

### UI e textos

- Interface em português do Brasil. Mensagens de erro ao usuário ficam nas actions ou nos componentes, nunca vêm da API sem fallback.
- Tailwind com as cores da marca (`#009c6c`, `#0c2432`, variáveis em `app/globals.css`). Siga o padrão visual da tela vizinha.
- Componentes interativos têm `'use client'` no topo. Formulários usam `react-hook-form` + `zod`.

### Regras de negócio sensíveis

- **Validade "indefinido"**: produtos `Cajazinha`, `Abacaxi Cortelã`, `Tangerina com Acerola`, `Pomar`, `Pitaya com Melancia`, ou qualquer produto com quantidade 0, usam validade `indefinido`. Nos demais, a validade é obrigatória e no máximo 18 meses após a visita. **Hoje essa lista está duplicada** em `lib/actions.ts`, `lib/api/promotor.ts`, `components/visits/new-visit-form.tsx`, `app/visitas/[id]/page.tsx` e `app/visitas/[id]/editar/page.tsx`. Ao mudar a regra, altere todos (ou faça antes a centralização descrita em `docs/MELHORIAS.md`).
- **Rascunho de visita**: `saveVisitDraft` aceita campos vazios e descarta produtos incompletos; `createVisit` exige estabelecimento, data e produtos válidos.
- **Check-in semanal**: semana de domingo a sábado no fuso de São Paulo; promotor sem registro na semana é levado a `/checkin`.

### Testes

- Lógica nova em `lib/` precisa de teste em `tests/lib/<arquivo>.test.ts`.
- Para mockar a API, use `vi.mock('@/lib/api/client')` ou `vi.stubGlobal('fetch', ...)`, como em `tests/lib/api-promotor.test.ts`.
- Componentes React: `// @vitest-environment jsdom` no topo do arquivo de teste.
- Fluxos de tela (navegação, formulários, estados de erro): teste de navegador em `tests/e2e/*.spec.ts`, importando `test`/`expect` de `tests/e2e/fixtures.ts`. A fixture reinicia a API simulada a cada teste e reprova o teste se houver erro de console ou resposta HTTP de erro inesperada.
- A API simulada fica em `tests/e2e/mock-api.mjs`, só com dados fictícios. Endpoint novo usado pelo app precisa de rota lá. Para forçar cenários (API fora do ar, sessão expirada), use `mockApi.control(...)`.

## Variáveis de ambiente

| Variável | Uso |
| --- | --- |
| `FIU_FIU_API_BASE_URL` ou `BASE_URL` | URL base da `fiu-fiu-api` (obrigatória). |
| `DATABASE_URL` (ou `POSTGRES_URL`...) | Acesso direto ao Postgres. **Legado**: hoje só a busca geral de clientes, o fallback de nome do usuário e o fallback de ID do promotor usam. Como `lib/db.ts` lança erro na importação se a variável faltar, ela ainda é obrigatória. |
| `OPENAI_API_KEY`, `OPENAI_VISIT_MODEL` | Constam no `.env.example` mas não são usadas pelo código atual. |

Nunca commite `.env` (já está no `.gitignore`).

## Débitos conhecidos (não "corrija" sem combinar)

Lista completa e priorizada em [`docs/MELHORIAS.md`](docs/MELHORIAS.md). O que mais afeta quem altera código:

- O perfil (`promotor`/`comercial`) da sessão vem só de `GET /promotor/me` (`lib/session-role.ts`); o cadastro não oferece escolha de perfil. A autorização real é da API: o cookie `ff_role` só decide o que a tela mostra.
- Visitas comerciais usam somente `/commercial-visits` (GET, GET `/{id}`, POST, PUT). Datas vão para a API como `AAAA-MM-DD` (`lib/commercial-dates.ts`).
- `lib/actions.ts` (~1200 linhas) e `components/visits/new-visit-form.tsx` (~1700 linhas) concentram muita coisa: prefira extrair helpers para módulos novos a crescer esses arquivos.
- Decode de JWT e normalização de token estão duplicados em `lib/auth.ts`, `lib/actions.ts`, `lib/api/client.ts`, `lib/api/promotor.ts` e `lib/weekly-vehicle-check-api.ts`.
- `lib/api/client.ts` faz `console.log` de toda requisição, inclusive em produção.
