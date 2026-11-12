// API simulada da fiu-fiu-api para os testes de navegador (Playwright).
// Só dados fictícios: nenhum teste toca a API real.
//
// Endpoints de controle (usados pelos testes, não existem na API real):
//   POST /__reset    restaura os dados iniciais e o comportamento normal
//   POST /__control  muda o comportamento, ex.: { "visitsStatus": 500 }
//   GET  /__requests lista as requisições recebidas desde o último reset
import http from 'node:http';

const PORT = Number(process.env.MOCK_API_PORT ?? 4010);

// Senha das contas fictícias acima (repetida em tests/e2e/fixtures.ts).
const TEST_PASSWORD = 'senha-teste';

const users = {
  'ana@teste.local': { id: 42, email: 'ana@teste.local', fullName: 'Ana Promotora (teste)', role: 'promotor' },
  'carlos@teste.local': { id: 7, email: 'carlos@teste.local', fullName: 'Carlos Comercial (teste)', role: 'comercial' },
};
const usersById = Object.fromEntries(Object.values(users).map((user) => [user.id, user]));

const DEFAULT_CONTROL = { visitsStatus: 200, agendaPatchRouteExists: true };

const dateKey = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(date);
const daysAgo = (days) => dateKey(new Date(Date.now() - days * 86_400_000));

function initialVisits() {
  // 23 visitas da Ana, mais recentes primeiro: as 2 primeiras são rascunhos.
  return Array.from({ length: 23 }, (_, index) => ({
    id: 1000 + 23 - index,
    promotorId: 42,
    establishment: `Loja Teste ${String(23 - index).padStart(2, '0')}`,
    establishmentId: 500 + (index % 3),
    visitDate: daysAgo(index),
    isDraft: index < 2,
    canEdit: true,
    observation: index === 0 ? 'Gôndola reorganizada; falta etiqueta de preço.' : null,
    products: [
      { name: 'Produto A', quantity: 12, unit: 'un', expirationDate: daysAgo(-60) },
      { name: 'Produto B', quantity: 4, unit: 'cx', expirationDate: 'indefinido' },
    ],
    beforeImages: [],
    afterImages: [],
  }));
}

function initialStores() {
  const ana = { promotorId: 42, promotorName: 'Ana Promotora (teste)', promotorEmail: 'ana@teste.local' };
  return [
    { id: 900, ...ana, clientId: 500, clientName: 'Mercado Teste Centro LTDA', fantasyName: 'Mercado Centro', nickname: 'Centro', city: 'Goiânia', state: 'GO', document: '00000000000100', address: 'Rua Teste', addressNumber: '10', neighborhood: 'Centro', daysBetweenVisits: 7, lastVisitDate: daysAgo(0), notes: null },
    { id: 901, ...ana, clientId: 501, clientName: 'Supermercado Teste Norte LTDA', fantasyName: 'Super Norte', nickname: 'Norte', city: 'Goiânia', state: 'GO', document: '00000000000200', address: 'Av. Teste', addressNumber: '200', neighborhood: 'Norte', daysBetweenVisits: 7, lastVisitDate: daysAgo(12), notes: 'Entrega às terças' },
    { id: 902, promotorId: null, promotorName: null, promotorEmail: null, clientId: null, clientName: '', fantasyName: '', nickname: 'Loja Independente', city: '', state: '', document: '', address: '', addressNumber: null, neighborhood: '', daysBetweenVisits: 14, lastVisitDate: null, notes: null },
  ];
}

let state;
function reset() {
  state = { control: { ...DEFAULT_CONTROL }, visits: initialVisits(), stores: initialStores(), commercialVisits: [], requests: [] };
}
reset();

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const makeJwt = (user) =>
  [
    base64url({ alg: 'HS256', typ: 'JWT' }),
    base64url({ sub: String(user.id), email: user.email, role: user.role, exp: Math.floor(Date.now() / 1000) + 86_400 }),
    'assinatura-de-teste',
  ].join('.');

function userFromAuth(req) {
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return usersById[Number(payload.sub)] ?? null;
  } catch {
    return null;
  }
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json', 'x-request-id': `mock-${Date.now()}` });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return raw;
  }
}

function route(method, path, body, req, url) {
  if (path === '/__reset' && method === 'POST') {
    reset();
    return [200, { ok: true }];
  }
  if (path === '/__control' && method === 'POST') {
    Object.assign(state.control, body);
    return [200, state.control];
  }
  if (path === '/__requests' && method === 'GET') return [200, state.requests];

  if (path === '/promotor/signin' && method === 'POST') {
    const user = users[body?.email];
    if (!user || body?.password !== TEST_PASSWORD) return [401, { message: 'Credenciais inválidas' }];
    // Igual à fiu-fiu-api: o login devolve só o token; o perfil vem de GET /promotor/me.
    return [200, { accessToken: makeJwt(user) }];
  }

  const user = userFromAuth(req);
  if (!user) return [401, { message: 'Invalid access token' }];

  if (path === '/promotor/me' && method === 'GET') return [200, { promotor: user }];

  // Permissões iguais às da fiu-fiu-api (src/lib/auth.ts): rotas de gestão só para a equipe
  // (aqui, o perfil comercial); o promotor comum só enxerga os próprios dados.
  const isStaff = user.role === 'comercial';
  const STAFF_ONLY = ['/promotors', '/promotors/agendas', '/promotor/monitor', '/visits', '/promotor/visits'];
  if ((STAFF_ONLY.includes(path) || path.startsWith('/commercial-visits')) && !isStaff) {
    return [403, { message: 'Você não tem permissão para acessar este recurso.' }];
  }

  if (path === '/promotor/mileage' && method === 'GET') {
    // Check-in da semana já feito, para o login seguir direto para a home.
    return [200, { checks: [{ id: 1, promotorId: user.id, mileage: 12345, checkDate: dateKey(new Date()), imageUrl: null }] }];
  }

  if (path === '/visits/report' && method === 'GET') {
    const { visitsStatus } = state.control;
    if (visitsStatus === 401) return [401, { message: 'Invalid access token' }];
    if (visitsStatus !== 200) return [visitsStatus, { message: 'Internal server error' }];

    const promotorId = isStaff ? Number(url.searchParams.get('promotorId')) : user.id;
    const page = Number(url.searchParams.get('page') ?? 1);
    const limit = Number(url.searchParams.get('limit') ?? 10);
    const mine = state.visits.filter((visit) => visit.promotorId === promotorId);
    return [200, {
      visits: mine.slice((page - 1) * limit, page * limit),
      pagination: { page, pageSize: limit, total: mine.length, totalPages: Math.ceil(mine.length / limit) },
    }];
  }

  let match = path.match(/^\/visits\/(\d+)$/);
  if (match && method === 'GET') {
    const visit = state.visits.find((item) => item.id === Number(match[1]));
    const visible = visit && (isStaff || visit.promotorId === user.id);
    return visible ? [200, { visit }] : [404, { message: 'Visit not found' }];
  }

  match = path.match(/^\/promotor\/visit\/(\d+)$/);
  if (match && method === 'DELETE') {
    const index = state.visits.findIndex((item) => item.id === Number(match[1]));
    if (index === -1) return [404, { message: 'Visit not found' }];
    if (!state.visits[index].isDraft) return [409, { message: 'Only drafts can be deleted' }];
    const [removed] = state.visits.splice(index, 1);
    return [200, { deletedVisitId: removed.id }];
  }

  if (path === '/promotors/agendas' && method === 'GET') return [200, { agendas: state.stores }];

  match = path.match(/^\/promotors\/agenda\/(\w+)$/);
  if (match && method === 'GET') {
    if (!isStaff && match[1] !== String(user.id)) return [403, { message: 'Você não tem permissão para acessar este recurso.' }];
    return [200, { agendas: state.stores.filter((store) => String(store.promotorId) === match[1]) }];
  }

  match = path.match(/^\/promotor\/agenda\/(\d+)$/);
  if (match && method === 'PATCH') {
    // Simula o serverless.yml sem a rota: o API Gateway responde 404.
    if (!state.control.agendaPatchRouteExists) return [404, { message: 'Not Found' }];
    const store = state.stores.find((item) => item.id === Number(match[1]));
    if (!store) return [404, { message: 'Attended store not found' }];
    Object.assign(store, body);
    return [200, { attendedStore: store }];
  }

  if (path === '/promotors' && method === 'GET') {
    return [200, { promotors: Object.values(users).filter((item) => item.role === 'promotor') }];
  }
  // Visitas comerciais: mesmo contrato da fiu-fiu-api (README, "Visitas comerciais").
  if (path === '/commercial-visits' && method === 'GET') return [200, { commercialVisits: state.commercialVisits }];
  if (path === '/commercial-visits' && method === 'POST') {
    const commercialVisit = {
      ...body,
      id: state.commercialVisits.length + 1,
      totalValue: body?.value ?? 0,
      submittedByEmail: user.email,
      createdAt: new Date().toISOString(),
    };
    state.commercialVisits.push(commercialVisit);
    return [201, { commercialVisit }];
  }
  match = path.match(/^\/commercial-visits\/(\d+)$/);
  if (match && (method === 'GET' || method === 'PUT')) {
    const commercialVisit = state.commercialVisits.find((item) => item.id === Number(match[1]));
    if (!commercialVisit) return [404, { message: 'Commercial visit not found' }];
    if (method === 'PUT') Object.assign(commercialVisit, body, { totalValue: body?.value ?? commercialVisit.totalValue });
    return [200, { commercialVisit }];
  }
  if (path === '/clients' && method === 'GET') return [200, { clients: [] }];

  return [404, { message: `Mock sem rota para ${method} ${path}` }];
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const body = await readBody(req);

  if (!url.pathname.startsWith('/__')) {
    state.requests.push({ method: req.method, path: url.pathname, search: url.search, body });
  }

  const [status, payload] = route(req.method, url.pathname, body, req, url);
  send(res, status, payload);
});

server.listen(PORT, () => console.log(`mock-api ouvindo em http://localhost:${PORT}`));
