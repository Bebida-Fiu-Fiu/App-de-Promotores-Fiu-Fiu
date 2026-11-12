# App de Promotores Fiu Fiu

PWA para promotores e comerciais da Fiu Fiu registrarem visitas em lojas, controlarem a agenda de lojas atendidas e informarem a quilometragem semanal do veículo.

> Para regras de código e arquitetura, veja [AGENTS.md](AGENTS.md). Para débitos e próximos passos, veja [docs/MELHORIAS.md](docs/MELHORIAS.md).

## Stack

- Next.js 16 (App Router, Server Actions), React 19, TypeScript strict
- Tailwind CSS 4, lucide-react
- React Hook Form + Zod
- Vitest + jsdom
- Backend: `fiu-fiu-api` (Serverless/AWS Lambda, repositório separado)

## Arquitetura em uma frase

O Next roda no servidor como **BFF**: as páginas e Server Actions leem a sessão dos cookies, chamam a `fiu-fiu-api` com o token do usuário e normalizam as respostas. O navegador só fala com o Next e, no upload de fotos, com URLs S3 pré-assinadas.

## Funcionalidades

| Perfil | Rota | O que faz |
| --- | --- | --- |
| todos | `/login`, `/promotor/signin`, `/signup`, `/forgot-password` | Login, cadastro e recuperação de senha em 3 etapas (e-mail → código de 6 dígitos → nova senha) |
| promotor | `/checkin` | Registro semanal de quilometragem com foto (semana de domingo a sábado, fuso de São Paulo). Pulado se já houver registro na semana. |
| promotor | `/promotor` | Lista paginada das visitas |
| promotor | `/visitas/nova`, `/visitas/[id]`, `/visitas/[id]/editar` | Cadastro de visita com produtos, validade, observação e fotos antes/depois. Suporta rascunho, cópia do resumo e exclusão de rascunho. |
| ambos | `/agenda`, `/agenda/novo` | Lojas atendidas com frequência de visita e status (em dia, prazo próximo, vencido, primeira visita). O comercial vê todos os promotores e pode editar. |
| comercial | `/comercial`, `/comercial/novo`, `/comercial/[id]`, `/comercial/[id]/editar` | Cadastro e relatório de clientes comerciais |

Depois do login, o promotor vai para `/checkin` e o comercial para `/comercial` (`getAppEntryPath` em `lib/auth.ts`).

## Estrutura

```text
app/                    Rotas (Server Components) e Route Handlers em app/api/
components/             UI por domínio: auth, home, agenda, visits, commercial, pwa
lib/actions.ts          Server Actions
lib/api/                Cliente HTTP da fiu-fiu-api e normalizadores (promotor, comercial)
lib/auth.ts             Sessão em cookies httpOnly
lib/*.ts                Regras de domínio (agenda, imagens, quilometragem, cópia de visita)
types/                  Tipos compartilhados
tests/                  Testes Vitest (espelham lib/ e components/) e tests/e2e/ (Playwright)
database/               SQL histórico (o schema atual vive na fiu-fiu-api)
public/                 Ícones, logo e texturas
```

## Configuração

Requisitos: Node.js 20+ e npm.

```bash
npm install
cp .env.example .env
```

Variáveis:

```env
# URL da fiu-fiu-api (obrigatória). FIU_FIU_API_BASE_URL tem prioridade sobre BASE_URL.
BASE_URL="https://api.fiu-fiu.com"

# Postgres. Ainda obrigatório porque lib/db.ts é carregado pelas Server Actions
# (busca geral de clientes e fallbacks de usuário). Ver docs/MELHORIAS.md, item 10.
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"
```

`OPENAI_API_KEY` e `OPENAI_VISIT_MODEL` aparecem no `.env.example`, mas não são usadas hoje.

## Scripts

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Desenvolvimento em http://localhost:3001 |
| `npm run build` / `npm run start` | Build e servidor de produção |
| `npm run lint` | ESLint |
| `npm test` | Testes (Vitest) |
| `npm run test:watch` | Testes em modo watch |
| `npm run test:coverage` | Cobertura de `lib/` |
| `npm run typecheck` | Typecheck (`tsc --noEmit`) |
| `npm run test:e2e` | Testes de navegador (Playwright) com a API simulada, servidor em modo dev |
| `npm run test:e2e:prod` | Os mesmos testes contra o build de produção (faz o build antes) |
| `npm run verify` | Typecheck, lint, testes unitários e testes de navegador no build de produção: o mesmo que o CI |

Antes de abrir PR: `npm run verify`.

## Testes automáticos

Todo push e pull request roda o workflow [CI](.github/workflows/ci.yml) no GitHub Actions: typecheck, lint, testes unitários, build e testes de navegador. Se algo falhar, o relatório do Playwright (com screenshots e trace) fica disponível como artefato da execução.

Os testes de navegador (`tests/e2e/`) sobem sozinhos uma API simulada (`tests/e2e/mock-api.mjs`, só dados fictícios) e o app na porta 3101, então não interferem no `npm run dev` da porta 3001 e nunca usam a API real. Na primeira vez, instale o navegador: `npx playwright install chromium`.

## Autenticação

- Login e cadastro chamam `POST /promotor/signin` e `POST /promotor/signup` na API. Hash de senha e emissão do JWT ficam no backend.
- O frontend guarda o JWT e os dados do usuário em cookies httpOnly (`ff_access_token`, `ff_user`, `ff_role`) por 7 dias. A sessão é descartada quando o `exp` do JWT vence.
- Se a API responder 401, a action limpa a sessão e devolve `shouldRedirectToLogin: true`.
- Recuperação de senha: `POST /password-recovery/{request,verify,reset}`. O código vale 15 minutos e o reenvio libera após 30 segundos.

## PWA

Manifesto em `app/manifest.ts` e registro do service worker em `components/pwa/pwa-register.tsx`, só em produção. Hoje o `/sw.js` não é gerado no build (ver `docs/MELHORIAS.md`, item 7).

## Estado atual

Veja a seção "Estado na data" em [docs/MELHORIAS.md](docs/MELHORIAS.md).
