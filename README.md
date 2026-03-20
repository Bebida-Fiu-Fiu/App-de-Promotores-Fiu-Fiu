# App de Promotores Fiu Fiu

Aplicativo web para promotores registrarem visitas em estabelecimentos e acompanharem produtos e datas de validade.

## Visao Geral

O projeto foi construido com `Next.js 16`, `React 19`, `TypeScript` e `PostgreSQL` via `@neondatabase/serverless`.

Fluxo principal:

- cadastro e login de promotores
- listagem das visitas do promotor autenticado
- busca de estabelecimentos por filtros
- cadastro de visita com produtos, quantidade, unidade e validade
- visualizacao dos detalhes de uma visita
- suporte basico a PWA

## Tecnologias

- `Next.js 16`
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`
- `React Hook Form`
- `Zod`
- `PostgreSQL / Neon`
- `bcrypt` para hash de senha

## Estrutura

```text
app/
  login/               Tela de login
  signup/              Tela de cadastro
  visitas/nova/        Cadastro de visita
  visitas/[id]/        Detalhes da visita
components/
  auth/                Formularios de autenticacao
  home/                Header e lista de visitas
  visits/              Formulario de nova visita
lib/
  actions.ts           Server Actions do app
  auth.ts              Sessao via cookie httpOnly
  db.ts                Conexao com PostgreSQL
database/
  create_promotors_table.sql
  add_promotor_id_to_visits.sql
```

## Requisitos

- `Node.js` 20 ou superior
- `npm`
- acesso a um banco PostgreSQL

## Configuracao

1. Instale as dependencias:

```bash
npm install
```

2. Crie o arquivo `.env` com base no exemplo:

```bash
cp .env.example .env
```

3. Configure a variavel de ambiente:

```env
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"
```

## Banco de Dados

O projeto usa PostgreSQL e depende das tabelas de autenticacao e visitas.

Scripts incluidos no repositorio:

- `database/create_promotors_table.sql`: cria a tabela `promotors`
- `database/add_promotor_id_to_visits.sql`: adiciona `promotor_id` em `visits`

Observacoes importantes:

- a tabela `visits` ja precisa existir no banco
- a busca de estabelecimentos depende da tabela `clients`
- o formulario de visitas espera que `visits` tenha, no minimo, as colunas `id`, `promotor_id`, `establishment`, `visit_date` e `products`
- a tabela `clients` precisa conter os campos usados na busca, como `client_name`, `fantasy_name`, `document`, `city`, `address`, `address_number`, `neighborhood` e `state`

Exemplo de ordem de execucao:

1. execute `database/create_promotors_table.sql`
2. garanta que a tabela `visits` ja exista
3. execute `database/add_promotor_id_to_visits.sql`

## Como Rodar

Ambiente de desenvolvimento:

```bash
npm run dev
```

Build de producao:

```bash
npm run build
npm run start
```

Lint:

```bash
npm run lint
```

## Scripts Disponiveis

- `npm run dev`: inicia o app em desenvolvimento
- `npm run build`: gera o build de producao
- `npm run start`: sobe a aplicacao em modo producao
- `npm run lint`: valida o codigo com ESLint

## Autenticacao

O fluxo de autenticacao atual funciona assim:

- o cadastro salva a senha com hash `bcrypt`
- o login valida a senha com `bcrypt`
- contas antigas com senha em texto puro sao migradas automaticamente no primeiro login
- a sessao e mantida por cookie `httpOnly` chamado `ff_session`

Limitacao atual:

- o cookie de sessao guarda o email do usuario, sem assinatura criptografica via JWT

Se o projeto evoluir em seguranca, um proximo passo recomendado e trocar a sessao atual por cookie assinado ou token de sessao no servidor.

## Funcionalidades

### Cadastro e login

- cadastro de promotores com nome, email e senha
- validacao de formulario no cliente e no servidor
- redirecionamento para a home apos autenticacao

### Home

- carrega o nome do promotor autenticado
- lista as visitas vinculadas ao promotor logado

### Cadastro de visita

- busca de estabelecimento por filtros
- selecao de cliente encontrado
- definicao da data da visita
- cadastro de um ou mais produtos
- armazenamento dos produtos em `jsonb`

### Detalhe da visita

- exibe estabelecimento e data
- exibe todos os produtos cadastrados na visita

## PWA

O projeto possui estrutura basica de PWA:

- `app/manifest.ts`
- registro de service worker em `components/pwa/pwa-register.tsx`

## Validacao

Validacoes importantes do app:

- autenticacao com `Zod`
- busca de clientes com sanitizacao de documento
- data de visita no formato `dd/mm/aaaa`
- produtos com quantidade minima e unidade controlada

## Melhorias Recomendadas

- assinar a sessao com JWT ou trocar para sessao server-side
- adicionar migrations versionadas
- documentar o schema completo de `visits` e `clients`
- adicionar testes para login, cadastro e criacao de visitas
- padronizar mensagens de erro em portugues no backend

## Status

Estado atual validado localmente:

- `npm run lint` passando
- `npm run build` passando
